module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      API_KEY: 'notifwa-secret-key-123', // Ubah ini di production!
      PORT: 5008
    },
    env_production: {
      NODE_ENV: 'production',
      API_KEY: 'MASUKKAN_KUNCI_RAHASIA_ANDA_DISINI', // WAJIB DIUBAH!
      PORT: 5008
    }
  }]
};
