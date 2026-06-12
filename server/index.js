require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const db = require('./db');
const { parseVideoId, searchYouTube, fetchVideoMeta, getSuggestions } = require('./youtube');

const PORT = process.env.PORT || 3001;
const MAX_PER_USER = parseInt(process.env.MAX_RESERVATIONS_PER_USER || '3', 10);
const HOST_PASSWORD = process.env.HOST_PASSWORD || '';

const app = express();
app.use(cors());
app.use(express.json());

// ── Host Auth (in-memory token store, cleared on server restart) ──────────────

const hostTokens = new Map(); // token → expiresAt (ms)

function generateHostToken() {
  const token = crypto.randomBytes(32).toString('hex');
  hostTokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}

function isValidHostToken(token) {
  if (!token) return false;
  const exp = hostTokens.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { hostTokens.delete(token); return false; }
  return true;
}

function requireHost(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!isValidHostToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function queueSnapshot(roomId) {
  const queue = db.getActiveQueue(roomId || null);
  let sessionActive = true;
  if (roomId) {
    const session = db.getPinSessionById(roomId);
    sessionActive = session ? !!session.active : false;
  }
  return {
    queue,
    nowPlaying: queue[0] || null,
    max: MAX_PER_USER,
    roomId: roomId || null,
    sessionActive,
  };
}

// Broadcast queue state only to WebSocket clients in the same room
function broadcast(roomId) {
  const payload = JSON.stringify({ type: 'snapshot', data: queueSnapshot(roomId) });
  wss.clients.forEach(client => {
    if (client.readyState !== 1 /* OPEN */) return;
    if (client.roomId === (roomId || null)) client.send(payload);
  });
}

// ── Host Routes ───────────────────────────────────────────────────────────────

app.post('/api/host/login', (req, res) => {
  const { password } = req.body || {};
  if (!HOST_PASSWORD) {
    return res.status(500).json({ error: 'HOST_PASSWORD ay hindi na-configure sa server.' });
  }
  if (!password || password !== HOST_PASSWORD) {
    return res.status(401).json({ error: 'Mali ang password.' });
  }
  const token = generateHostToken();
  res.json({ ok: true, token });
});

app.get('/api/host/sessions', requireHost, (_req, res) => {
  const sessions = db.getActivePinSessions();
  const withCounts = sessions.map(s => ({
    ...s,
    queueCount: db.getActiveQueue(s.id).length,
  }));
  res.json({ sessions: withCounts });
});

app.post('/api/host/sessions', requireHost, (req, res) => {
  const { name, pin } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Kailangan ng session name.' });
  if (!pin || !/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN ay dapat 4-8 digits.' });
  if (db.getPinSessionByPin(pin)) return res.status(409).json({ error: 'Ang PIN na ito ay ginagamit na.' });
  const session = db.createPinSession({ name: name.trim(), pin });
  res.json({ ok: true, session });
});

app.post('/api/host/sessions/:id/close', requireHost, (req, res) => {
  db.closePinSession(req.params.id);
  // Notify guests in this room that their session is closed
  broadcast(req.params.id);
  res.json({ ok: true });
});

// ── Guest PIN Route ───────────────────────────────────────────────────────────

app.post('/api/pin/join', (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'Walang PIN.' });
  const session = db.getPinSessionByPin(pin.trim());
  if (!session) {
    return res.status(404).json({ error: 'Mali o expired na ang PIN. Humingi ng tamang PIN sa host.' });
  }
  res.json({ ok: true, roomId: session.id, sessionName: session.name });
});

// ── Shared Routes (now room-aware) ────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: !!process.env.YOUTUBE_API_KEY });
});

app.get('/api/suggest', async (req, res) => {
  const q = (req.query.q || '').trim();
  const suggestions = await getSuggestions(q);
  res.json({ suggestions });
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

app.get('/api/queue', (req, res) => {
  const roomId = req.query.room || null;
  res.json(queueSnapshot(roomId));
});

app.post('/api/reserve', async (req, res) => {
  const { name, sessionId, videoId, title, thumbnail, link, roomId } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Pangalan mo ay kailangan.' });
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  if (!roomId) return res.status(400).json({ error: 'Kailangan ng PIN session. I-enter muli ang PIN.' });

  const room = db.getPinSessionById(roomId);
  if (!room || !room.active) {
    return res.status(403).json({
      error: 'Ang session na ito ay sarado na. Humingi ng bagong PIN sa host.',
    });
  }

  const count = db.countActiveForSession(sessionId, roomId);
  if (count >= MAX_PER_USER) {
    return res.status(429).json({
      error: `${MAX_PER_USER} na ang iyong na-reserve. Hintayin matapos ang isa bago mag-reserve ulit.`,
    });
  }

  let resolvedId = videoId;
  let resolvedTitle = title || '';
  let resolvedThumb = thumbnail || '';

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
    roomId,
  });

  broadcast(roomId);
  res.json({ ok: true, item: row, queue: queueSnapshot(roomId) });
});

app.post('/api/remove', (req, res) => {
  const { id, sessionId } = req.body || {};
  if (!id || !sessionId) return res.status(400).json({ error: 'Missing id or sessionId' });

  const result = db.removeReservation(Number(id), sessionId);
  if (!result.ok) {
    const status = result.reason === 'forbidden' ? 403 : 404;
    return res.status(status).json({ error: result.reason });
  }

  broadcast(result.roomId);
  res.json({ ok: true, queue: queueSnapshot(result.roomId) });
});

app.post('/api/advance', (req, res) => {
  const roomId = (req.body || {}).roomId || null;
  const played = db.advance(roomId);
  broadcast(roomId);
  res.json({ ok: true, played, queue: queueSnapshot(roomId) });
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `ws://localhost:${PORT}`);
  const roomId = url.searchParams.get('room') || null;
  ws.roomId = roomId;
  ws.send(JSON.stringify({ type: 'snapshot', data: queueSnapshot(roomId) }));
});

server.listen(PORT, () => {
  console.log(`Karaoke server running on port ${PORT}`);
  console.log(`YouTube API key: ${process.env.YOUTUBE_API_KEY ? 'SET' : 'NOT SET — search will fail'}`);
  console.log(`Host password: ${HOST_PASSWORD ? 'SET' : 'NOT SET — host login will fail'}`);
});
