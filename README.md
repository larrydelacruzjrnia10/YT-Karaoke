# 🎤 Karaoke Reservation System

Guests use their phones to search YouTube karaoke videos and reserve songs into a shared queue. One PC connected to a TV runs `/display`, which auto-plays the queue in order using the YouTube IFrame Player.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **A free YouTube Data API v3 key** — follow these steps:
  1. Go to [console.cloud.google.com](https://console.cloud.google.com)
  2. Create a new project (or select one)
  3. Navigate to **APIs & Services → Library**, search for **YouTube Data API v3**, click **Enable**
  4. Navigate to **APIs & Services → Credentials**, click **Create Credentials → API Key**
  5. Copy the key and paste it in `server/.env` (see below)

---

## Run locally

### 1. Server

```bash
cd server
npm install
cp .env.example .env
# Edit .env — paste your YouTube API key
npm run dev
```

Server starts on **http://localhost:3001**.

### 2. Client

```bash
cd client
npm install
cp .env.example .env
# For local dev leave VITE_API_URL blank (the Vite proxy handles it)
npm run dev
```

Client starts on **http://localhost:5173**.

Open `http://localhost:5173` on your phone (same Wi-Fi) or browser to reserve songs.  
Open `http://localhost:5173/display` on the TV PC.

---

## LAN setup (phones as remotes)

1. On your PC, find your local IP:
   - Windows: run `ipconfig` — look for **IPv4 Address** under your Wi-Fi adapter (e.g. `192.168.1.42`)
2. In `client/.env`, set:
   ```
   VITE_API_URL=http://192.168.1.42:3001
   ```
3. Rebuild the client: `npm run build` (or keep `npm run dev` running)
4. Connect phones to the same Wi-Fi and open `http://192.168.1.42:5173`

---

## YouTube quota math

| Action | Quota cost |
|--------|-----------|
| Search (per unique query) | ~100 units |
| Reserve via link (meta fetch) | ~1 unit |
| Daily free limit | 10,000 units |

That's ~100 unique searches/day. Tips:
- Search results are **cached for 10 minutes** — five people searching "Bamboo" costs 100 units, not 500.
- For big events, have guests **paste YouTube links** instead of searching (1 unit each).

---

## Playback & ads

This project uses the official **YouTube IFrame Player** and runs entirely on YouTube's free tier.  
Occasional ads may appear before or during videos — that's normal and expected.  
No YouTube Premium or ad-blocker is needed or built in.

---

## Song limit note

Each device can reserve up to 3 songs at a time (configurable via `MAX_RESERVATIONS_PER_USER` in `server/.env`). The limit is tied to a browser session ID stored in localStorage. It's easily gameable (open a new tab, or change your name) — that's fine for a friendly crowd; it's a convenience throttle, not security.
