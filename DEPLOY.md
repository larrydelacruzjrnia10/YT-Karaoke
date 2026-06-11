# Free Deployment Guide

This guide deploys the backend to **Render** (free tier) and the frontend to **Vercel** (free tier).

---

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create karaoke --public --source=. --push
```

---

## 2. Deploy the server → Render

1. Go to [render.com](https://render.com) and sign up / log in.
2. Click **New → Web Service**.
3. Connect your GitHub repo and select it.
4. Settings:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Add **Environment Variables**:
   - `YOUTUBE_API_KEY` → your API key
   - `MAX_RESERVATIONS_PER_USER` → `3`
   - `NODE_ENV` → `production`
6. Click **Create Web Service**.

> Note: Render free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 s. For events, open `/api/health` a minute before guests arrive to wake it up.

Copy the Render URL (e.g. `https://karaoke-server.onrender.com`).

---

## 3. Deploy the client → Vercel

1. Go to [vercel.com](https://vercel.com) and sign up / log in.
2. Click **Add New → Project**, import your GitHub repo.
3. Settings:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL` → `https://karaoke-server.onrender.com` (your Render URL)
5. Click **Deploy**.

Vercel will give you a URL like `https://karaoke-xyz.vercel.app`.

---

## 4. Display page (TV PC)

Open `https://karaoke-xyz.vercel.app/display` on the PC connected to the TV.

---

## 5. WebSocket on Render

Render free tier supports WebSockets on the same port. The client connects to `wss://karaoke-server.onrender.com/ws`. If the WebSocket fails (e.g. cold start), the client automatically falls back to polling `/api/queue` every 4 s and reconnects in the background.

---

## Cost summary

| Service | Plan | Cost |
|---------|------|------|
| Render  | Free tier | $0 |
| Vercel  | Hobby (free) | $0 |
| YouTube Data API | Free quota (10k units/day) | $0 |
| SQLite (file on Render disk) | Built-in | $0 |

> **Important**: Render free tier has ephemeral storage — the SQLite file is wiped on each deploy/restart. For persistent data across restarts, upgrade to a paid Render plan or swap `db.js` to use a free-tier Postgres (e.g. Supabase or Neon). For a one-night event this is fine — the queue resets between sessions anyway.

---

---

# Hostinger VPS Deployment (with Auto-Deploy from GitHub)

This approach runs everything — server + client — on your own VPS. Nginx serves the built React app and proxies API/WebSocket requests to the Node.js process managed by PM2. Every push to `master` triggers GitHub Actions to SSH into the VPS and redeploy automatically.

---

## Architecture on the VPS

```
Internet → Nginx (port 80/443)
             ├── /          → serves client/dist/ (static files)
             ├── /api/*     → proxy → Node.js :3001
             └── /ws        → WebSocket proxy → Node.js :3001
```

---

## Step 1 — One-time VPS setup

SSH into your VPS as root and run the setup script:

```bash
ssh root@YOUR_VPS_IP
bash <(curl -fsSL https://raw.githubusercontent.com/larrydelacruzjrnia10/YT-Karaoke/master/deploy/setup-vps.sh) karaoke.yourdomain.com
```

Or clone the repo first and run it locally:

```bash
git clone https://github.com/larrydelacruzjrnia10/YT-Karaoke.git /var/www/karaoke
bash /var/www/karaoke/deploy/setup-vps.sh karaoke.yourdomain.com
```

The script will:
1. Install Node.js 20, PM2, Nginx, Certbot
2. Clone the repo to `/var/www/karaoke`
3. Build the client
4. Configure Nginx with your domain
5. Obtain a free Let's Encrypt SSL certificate
6. Start the Node.js server via PM2 (auto-restarts on crash, survives reboots)

---

## Step 2 — Add your YouTube API key

After the script finishes, create the `.env` on the VPS (this file is never deployed — it stays put):

```bash
nano /var/www/karaoke/server/.env
```

Paste:
```
YOUTUBE_API_KEY=your_real_api_key_here
PORT=3001
MAX_RESERVATIONS_PER_USER=3
```

Save, then:
```bash
pm2 restart karaoke-server
```

---

## Step 3 — Add GitHub Secrets for auto-deploy

See `deploy/github-secrets.md` for the full guide. In short, go to your GitHub repo →
**Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `karaoke.yourdomain.com` (or bare IP) |
| `VPS_USER` | `root` (Hostinger default) |
| `VPS_SSH_KEY` | Contents of your private key (`~/.ssh/id_ed25519`) |
| `VPS_PORT` | `22` |

---

## Step 4 — Trigger your first auto-deploy

Push any change to `master`:

```bash
git commit --allow-empty -m "trigger deploy"
git push origin master
```

Watch it run: GitHub repo → **Actions** tab → `Deploy to Hostinger VPS`.

---

## Useful VPS commands

```bash
pm2 status                        # check server status
pm2 logs karaoke-server           # live logs
pm2 restart karaoke-server        # manual restart
nginx -t && systemctl reload nginx # test + reload Nginx config
```

## SQLite persistence

Unlike Render, the VPS disk is **persistent** — the SQLite file (`server/karaoke.db`) survives restarts and deploys. The deploy workflow only touches code files; the `.env` and `.db` files are never overwritten.
