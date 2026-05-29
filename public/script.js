// Navigation
const navItems = document.querySelectorAll('.nav-item');
const pageSections = document.querySelectorAll('.page-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        pageSections.forEach(sec => sec.classList.remove('active'));
        
        // Add active class to clicked
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// WhatsApp API Integration
const qrcodeElement = document.getElementById('qrcode');
const statusText = document.getElementById('statusText');
const connectionBadge = document.getElementById('connectionBadge');
const qrPlaceholder = document.querySelector('.qr-placeholder');
let qrcodeInstance = null;

// Polling status
async function checkStatus() {
    try {
        const response = await fetch('/api/v1/status', {
            headers: { 'x-api-key': 'notifwa-secret-key-123' }
        });
        const data = await response.json();
        
        updateStatusUI(data.status, data.qr);
    } catch (error) {
        console.error('Error fetching status:', error);
        updateStatusUI('Error checking status', null);
    }
}

function updateStatusUI(status, qrString) {
    statusText.innerText = status;
    
    if (status === 'Connected') {
        connectionBadge.innerText = 'Connected';
        connectionBadge.className = 'badge badge-success';
        qrcodeElement.innerHTML = '';
        qrPlaceholder.style.display = 'block';
        qrPlaceholder.innerHTML = '<i class="ph ph-check-circle" style="color: var(--success)"></i><p style="color: var(--success)">Connected</p>';
    } else {
        connectionBadge.innerText = status;
        connectionBadge.className = 'badge badge-error';
        
        if (qrString) {
            qrPlaceholder.style.display = 'none';
            qrcodeElement.innerHTML = '';
            qrcodeInstance = new QRCode(qrcodeElement, {
                text: qrString,
                width: 218,
                height: 218,
                colorDark : "#0f172a",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.M
            });
        } else {
            qrPlaceholder.style.display = 'block';
            qrcodeElement.innerHTML = '';
            qrPlaceholder.innerHTML = '<i class="ph ph-spinner ph-spin"></i><p>Waiting for QR...</p>';
        }
    }
}

// Check status every 3 seconds
setInterval(checkStatus, 3000);
checkStatus();

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if(confirm('Are you sure you want to logout from WhatsApp?')) {
        try {
            await fetch('/api/v1/logout', { 
                method: 'POST',
                headers: { 'x-api-key': 'notifwa-secret-key-123' }
            });
            alert('Logged out successfully');
            checkStatus();
        } catch(e) {
            alert('Failed to logout');
        }
    }
});

// Blast Form
const blastForm = document.getElementById('blastForm');
const logContainer = document.getElementById('logContainer');

function addLog(text, isError = false) {
    const logDiv = document.createElement('div');
    logDiv.className = `log-item ${isError ? 'error' : 'success'}`;
    const time = new Date().toLocaleTimeString();
    logDiv.innerText = `[${time}] ${text}`;
    logContainer.prepend(logDiv);
}

blastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const numbersInput = document.getElementById('numbers').value;
    const messageInput = document.getElementById('message').value;
    
    // Parse numbers
    const numbers = numbersInput.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 5);
    
    if (numbers.length === 0) {
        alert('Please enter valid numbers');
        return;
    }
    
    if (statusText.innerText !== 'Connected') {
        alert('WhatsApp is not connected!');
        return;
    }
    
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('sendBtn').innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Sending...</span>';
    
    addLog(`Starting blast to ${numbers.length} numbers...`);
    
    for (let i = 0; i < numbers.length; i++) {
        const num = numbers[i];
        addLog(`Sending to ${num}...`);
        
        try {
            const response = await fetch('/api/v1/send', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': 'notifwa-secret-key-123'
                },
                body: JSON.stringify({ number: num, message: messageInput })
            });
            
            const data = await response.json();
            
            if (data.status) {
                addLog(`Success: ${num}`);
            } else {
                addLog(`Failed: ${num} - ${data.message}`, true);
            }
        } catch (error) {
            addLog(`Error: ${num} - ${error.message}`, true);
        }
        
        // Small delay between sends to prevent blocking/spam
        if (i < numbers.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    addLog('Blast campaign completed!');
    
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('sendBtn').innerHTML = '<i class="ph ph-paper-plane-right"></i><span>Send Blast</span>';
});
