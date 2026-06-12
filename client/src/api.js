// ── Browser session identity (per-device, ties the song limit to this device) ─

export function getSessionId() {
  let id = localStorage.getItem('karaoke_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('karaoke_session_id', id);
  }
  return id;
}

// ── PIN room data ─────────────────────────────────────────────────────────────

export function getRoomData() {
  try {
    return JSON.parse(localStorage.getItem('karaoke_room') || 'null');
  } catch {
    return null;
  }
}

export function setRoomData(roomId, sessionName) {
  localStorage.setItem('karaoke_room', JSON.stringify({ roomId, sessionName }));
}

export function clearRoomData() {
  localStorage.removeItem('karaoke_room');
}

// ── Host token ────────────────────────────────────────────────────────────────

export function getHostToken() {
  return localStorage.getItem('karaoke_host_token') || null;
}

export function setHostToken(token) {
  localStorage.setItem('karaoke_host_token', token);
}

export function clearHostToken() {
  localStorage.removeItem('karaoke_host_token');
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, opts = {}) {
  const { headers: extraHeaders, ...restOpts } = opts;
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    ...restOpts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  health: () => apiFetch('/api/health'),
  search: q => apiFetch(`/api/search?q=${encodeURIComponent(q)}`),
  suggest: q => apiFetch(`/api/suggest?q=${encodeURIComponent(q)}`),
  queue: (roomId) => apiFetch(`/api/queue${roomId ? `?room=${encodeURIComponent(roomId)}` : ''}`),
  reserve: body => apiFetch('/api/reserve', { method: 'POST', body: JSON.stringify(body) }),
  remove: body => apiFetch('/api/remove', { method: 'POST', body: JSON.stringify(body) }),
  advance: (roomId) => apiFetch('/api/advance', { method: 'POST', body: JSON.stringify({ roomId: roomId || null }) }),
  pinJoin: (pin) => apiFetch('/api/pin/join', { method: 'POST', body: JSON.stringify({ pin }) }),
  host: {
    login: (password) => apiFetch('/api/host/login', { method: 'POST', body: JSON.stringify({ password }) }),
    getSessions: (token) => apiFetch('/api/host/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    createSession: (token, data) => apiFetch('/api/host/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
    closeSession: (token, id) => apiFetch(`/api/host/sessions/${id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  },
};

// ── WebSocket URL builder ─────────────────────────────────────────────────────

export function getWsUrl() {
  const base = import.meta.env.VITE_API_URL || '';
  if (base) {
    return base.replace(/^http/, 'ws') + '/ws';
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}
