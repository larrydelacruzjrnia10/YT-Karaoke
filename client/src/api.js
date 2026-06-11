// Stable per-browser identity — ties the 3-song limit to this device/tab.
// Not a security measure; just prevents accidental cross-session collisions.
export function getSessionId() {
  let id = localStorage.getItem('karaoke_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('karaoke_session_id', id);
  }
  return id;
}

const BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  health: () => apiFetch('/api/health'),
  search: q => apiFetch(`/api/search?q=${encodeURIComponent(q)}`),
  suggest: q => apiFetch(`/api/suggest?q=${encodeURIComponent(q)}`),
  queue: () => apiFetch('/api/queue'),
  reserve: body => apiFetch('/api/reserve', { method: 'POST', body: JSON.stringify(body) }),
  remove: body => apiFetch('/api/remove', { method: 'POST', body: JSON.stringify(body) }),
  advance: () => apiFetch('/api/advance', { method: 'POST' }),
};

// Build the correct WebSocket URL regardless of whether we're on http or https
export function getWsUrl() {
  const base = import.meta.env.VITE_API_URL || '';
  if (base) {
    return base.replace(/^http/, 'ws') + '/ws';
  }
  // Vite dev proxy: use same host, upgrade protocol
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}
