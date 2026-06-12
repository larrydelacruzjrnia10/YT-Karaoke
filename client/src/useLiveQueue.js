import { useState, useEffect, useRef } from 'react';
import { api, getWsUrl } from './api';

const POLL_INTERVAL = 4000;
const RECONNECT_DELAY = 3000;

// Opens a WebSocket scoped to `roomId` (pass null for the legacy global queue).
// Falls back to polling /api/queue every 4 s if the socket is down.
// Returns { queue, nowPlaying, max, sessionActive, wsStatus }
export function useLiveQueue(roomId) {
  const [state, setState] = useState({ queue: [], nowPlaying: null, max: 3, sessionActive: true });
  const [wsStatus, setWsStatus] = useState('connecting');
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const unmountedRef = useRef(false);

  function applySnapshot(data) {
    if (!unmountedRef.current) setState(data);
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.queue(roomId);
        applySnapshot(data);
      } catch {}
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function connect() {
    if (unmountedRef.current) return;
    setWsStatus('connecting');
    const wsUrl = roomId
      ? `${getWsUrl()}?room=${encodeURIComponent(roomId)}`
      : getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      stopPolling();
    };

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'snapshot') applySnapshot(msg.data);
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setWsStatus('polling');
      startPolling();
      setTimeout(connect, RECONNECT_DELAY);
    };
  }

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      stopPolling();
    };
  }, [roomId]);

  return { ...state, wsStatus };
}
