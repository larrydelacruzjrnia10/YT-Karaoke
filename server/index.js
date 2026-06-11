require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const db = require('./db');
const { parseVideoId, searchYouTube, fetchVideoMeta } = require('./youtube');

const PORT = process.env.PORT || 3001;
const MAX_PER_USER = parseInt(process.env.MAX_RESERVATIONS_PER_USER || '3', 10);

const app = express();
app.use(cors());
app.use(express.json());

// ── Helpers ──────────────────────────────────────────────────────────────────

function queueSnapshot() {
  const queue = db.getActiveQueue();
  return {
    queue,
    nowPlaying: queue[0] || null,
    max: MAX_PER_USER,
  };
}

// Broadcast the current queue state to every connected WebSocket client
function broadcast() {
  const payload = JSON.stringify({ type: 'snapshot', data: queueSnapshot() });
  wss.clients.forEach(client => {
    if (client.readyState === 1 /* OPEN */) client.send(payload);
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: !!process.env.YOUTUBE_API_KEY });
});

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    const results = await searchYouTube(q);
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/queue', (_req, res) => {
  res.json(queueSnapshot());
});

app.post('/api/reserve', async (req, res) => {
  const { name, sessionId, videoId, title, thumbnail, link } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Pangalan mo ay kailangan.' });
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  // Enforce per-session cap
  const count = db.countActiveForSession(sessionId);
  if (count >= MAX_PER_USER) {
    return res.status(429).json({
      error: `${MAX_PER_USER} na ang iyong na-reserve. Hintayin matapos ang isa bago mag-reserve ulit.`,
    });
  }

  let resolvedId = videoId;
  let resolvedTitle = title || '';
  let resolvedThumb = thumbnail || '';

  // Link-based reserve: parse the ID then optionally fetch meta
  if (link && !resolvedId) {
    resolvedId = parseVideoId(link);
    if (!resolvedId) return res.status(400).json({ error: 'Hindi ma-parse ang YouTube link.' });

    if (!resolvedTitle) {
      const meta = await fetchVideoMeta(resolvedId);
      resolvedTitle = meta.title;
      resolvedThumb = meta.thumbnail;
    }
  }

  if (!resolvedId) return res.status(400).json({ error: 'Walang videoId o link.' });
  if (!resolvedTitle) resolvedTitle = `Video (${resolvedId})`;

  const row = db.addReservation({
    videoId: resolvedId,
    title: resolvedTitle,
    thumbnail: resolvedThumb,
    reservedBy: name.trim(),
    sessionId,
  });

  broadcast();
  res.json({ ok: true, item: row, queue: queueSnapshot() });
});

app.post('/api/remove', (req, res) => {
  const { id, sessionId } = req.body || {};
  if (!id || !sessionId) return res.status(400).json({ error: 'Missing id or sessionId' });

  const result = db.removeReservation(Number(id), sessionId);
  if (!result.ok) {
    const status = result.reason === 'forbidden' ? 403 : 404;
    return res.status(status).json({ error: result.reason });
  }

  broadcast();
  res.json({ ok: true, queue: queueSnapshot() });
});

app.post('/api/advance', (_req, res) => {
  const played = db.advance();
  broadcast();
  res.json({ ok: true, played, queue: queueSnapshot() });
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', ws => {
  // Send full snapshot immediately on connect
  ws.send(JSON.stringify({ type: 'snapshot', data: queueSnapshot() }));
});

server.listen(PORT, () => {
  console.log(`Karaoke server running on port ${PORT}`);
  console.log(`YouTube API key: ${process.env.YOUTUBE_API_KEY ? 'SET' : 'NOT SET — search will fail'}`);
});
