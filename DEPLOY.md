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
