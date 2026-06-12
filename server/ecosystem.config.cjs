// PM2 process config. Explicitly reads .env so env vars survive auto-deploys.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'karaoke-server',
      script: './index.js',
      cwd: '/var/www/karaoke/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
        MAX_RESERVATIONS_PER_USER: process.env.MAX_RESERVATIONS_PER_USER || '3',
        HOST_PASSWORD: process.env.HOST_PASSWORD || '',
      },
    },
  ],
};
