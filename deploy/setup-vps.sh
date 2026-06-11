#!/bin/bash
# One-time VPS setup script for Ubuntu 22.04 / 24.04
# Usage: bash setup-vps.sh YOUR_DOMAIN
# Example: bash setup-vps.sh karaoke.mysite.com
#
# Run as root (or prefix with sudo).
# After this script finishes, manually create server/.env with your API key.

set -e

DOMAIN="${1:?Usage: $0 YOUR_DOMAIN}"
REPO="https://github.com/larrydelacruzjrnia10/YT-Karaoke.git"
APP_DIR="/var/www/karaoke"

echo "=== [1/8] Updating system packages ==="
apt-get update -y && apt-get upgrade -y

echo "=== [2/8] Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "=== [3/8] Installing PM2 ==="
npm install -g pm2

echo "=== [4/8] Installing Nginx + Certbot ==="
apt-get install -y nginx certbot python3-certbot-nginx

echo "=== [5/8] Cloning repo ==="
mkdir -p /var/www
git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"

echo "=== [6/8] Installing dependencies & building client ==="
cd server && npm install --omit=dev && cd ..
cd client && npm install && npm run build && cd ..

echo "=== [7/8] Configuring Nginx ==="
cp deploy/nginx.conf /etc/nginx/sites-available/karaoke
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/karaoke
ln -sf /etc/nginx/sites-available/karaoke /etc/nginx/sites-enabled/karaoke
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "=== [8/8] Setting up SSL with Let's Encrypt ==="
# Certbot will automatically edit the Nginx config to add the HTTPS block
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  --register-unsafely-without-email
systemctl reload nginx

echo "=== Starting server with PM2 ==="
cd "$APP_DIR/server"
pm2 start ecosystem.config.cjs
pm2 save
# Make PM2 start on reboot
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo ""
echo "============================================================"
echo " Setup complete!"
echo "============================================================"
echo " IMPORTANT: Create the environment file before using the app:"
echo ""
echo "   nano /var/www/karaoke/server/.env"
echo ""
echo " Paste the following (replace the key with your real one):"
echo ""
echo "   YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_V3_KEY"
echo "   PORT=3001"
echo "   MAX_RESERVATIONS_PER_USER=3"
echo ""
echo " Then restart the server:"
echo "   pm2 restart karaoke-server"
echo ""
echo " Your app is live at: https://$DOMAIN"
echo " Display page:        https://$DOMAIN/display"
echo "============================================================"
