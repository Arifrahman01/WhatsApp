const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5008;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.error("FATAL ERROR: API_KEY is not defined in environment.");
    process.exit(1);
}

const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ status: false, message: 'Unauthorized: Invalid or missing API Key. Expected: ' + API_KEY + ', Got: ' + apiKey });
    }
    next();
};

let sock;
let qrCode = null;
let status = 'Disconnected';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        generateHighQualityLinkPreview: true,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCode = qr;
            status = 'Disconnected';
            console.log('QR Code updated. Scan QR Code di bawah ini:');
            require('qrcode-terminal').generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Connection closed. You are logged out. Restarting session...');
                status = 'Disconnected';
                qrCode = null;
                // Clear auth info to allow new login
                try {
                    fs.rmSync('auth_info', { recursive: true, force: true });
                    console.log('Auth info cleared');
                } catch (err) {
                    console.error('Failed to clear auth info:', err);
                }
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
            status = 'Connected';
            qrCode = null;
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();

app.get('/api/v1/status', requireApiKey, (req, res) => {
    res.json({ status, qr: qrCode });
});

app.post('/api/v1/send', requireApiKey, async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ status: false, message: 'Number and message are required' });
    }

    if (status !== 'Connected') {
        return res.status(503).json({ status: false, message: 'WhatsApp is not connected' });
    }

    try {
        // Format number: '0812...' -> '62812...@s.whatsapp.net'
        let formattedNumber = number;
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.slice(1);
        }
        if (!formattedNumber.endsWith('@s.whatsapp.net')) {
            formattedNumber = formattedNumber + '@s.whatsapp.net';
        }

        const exactJid = await sock.onWhatsApp(formattedNumber);
        if (exactJid.length === 0) {
            return res.status(404).json({ status: false, message: 'Number not registered on WhatsApp' });
        }

        await sock.sendMessage(exactJid[0].jid, { text: message });
        res.json({ status: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ status: false, message: 'Failed to send message', error: error.message });
    }
});

app.post('/api/v1/logout', requireApiKey, async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            fs.rmSync('auth_info', { recursive: true, force: true });
            status = 'Disconnected';
            connectToWhatsApp(); // Re-initialize to generate new QR for re-login
            res.json({ status: true, message: 'Logged out successfully' });
        } else {
            res.status(400).json({ status: false, message: 'No active session' });
        }
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ status: false, message: 'Failed to logout', error: error.message });
    }
});

app.listen(port, () => {
    console.log(`WhatsApp Gateway running on http://localhost:${port}`);
});
