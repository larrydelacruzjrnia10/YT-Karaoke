// PM2 process config — used both by the deploy workflow and manual starts.
// Place this file at /var/www/karaoke/server/ on the VPS.
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
        PORT: 3001,
      },
    },
  ],
};
