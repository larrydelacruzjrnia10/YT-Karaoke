import { useState, useEffect, useRef } from 'react';
import { api, getWsUrl } from './api';

const POLL_INTERVAL = 4000;
const RECONNECT_DELAY = 3000;

// Opens a WebSocket to receive live queue snapshots.
// Falls back to polling /api/queue every 4 s if the socket is down.
// Returns { queue, nowPlaying, max, wsStatus: 'connected'|'connecting'|'polling' }
export function useLiveQueue() {
  const [state, setState] = useState({ queue: [], nowPlaying: null, max: 3 });
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
        const data = await api.queue();
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
    const ws = new WebSocket(getWsUrl());
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
      // Attempt reconnect after a delay
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
  }, []);

  return { ...state, wsStatus };
}
