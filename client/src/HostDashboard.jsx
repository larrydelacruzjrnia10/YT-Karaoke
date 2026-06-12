import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getHostToken, clearHostToken } from './api';

export default function HostDashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const token = getHostToken();

  useEffect(() => {
    if (!token) { navigate('/host', { replace: true }); return; }
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await api.host.getSessions(token);
      setSessions(data.sessions || []);
    } catch (err) {
      if (err.message === 'Unauthorized') {
        clearHostToken();
        navigate('/host', { replace: true });
      }
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim() || !newPin.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.host.createSession(token, { name: newName.trim(), pin: newPin.trim() });
      setNewName('');
      setNewPin('');
      await loadSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleClose(id, name) {
    if (!window.confirm(`I-close ang session "${name}"? Hindi na makakapag-reserve ang mga bisita nito.`)) return;
    try {
      await api.host.closeSession(token, id);
      await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function logout() {
    clearHostToken();
    navigate('/host');
  }

  return (
    <div className="app">
      <header className="app-header" style={{ position: 'relative' }}>
        <h1 className="app-title">🎤 Host Dashboard</h1>
        <p className="app-subtitle">Manage karaoke sessions</p>
        <button
          className="btn"
          onClick={logout}
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        >
          Logout
        </button>
      </header>

      <main className="app-main">
        <div className="page">

          {/* Create new session */}
          <section className="section">
            <h2 className="section-title">➕ Bagong Session</h2>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label className="field-label">Session name:</label>
                <input
                  className="input"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Hal. Birthday Party, Table 1"
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label className="field-label">PIN (4-8 digits):</label>
                <input
                  className="input"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Hal. 1234"
                  maxLength={8}
                  inputMode="numeric"
                />
              </div>
              {error && (
                <p style={{ color: 'var(--accent-magenta)', fontSize: '14px', marginBottom: '8px' }}>
                  {error}
                </p>
              )}
              <button
                className="btn btn--primary btn--block"
                type="submit"
                disabled={creating || !newName.trim() || !newPin.trim()}
              >
                {creating ? 'Creating...' : 'Gumawa ng Session'}
              </button>
            </form>
          </section>

          <hr className="divider-line" />

          {/* Active sessions list */}
          <section className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 className="section-title" style={{ margin: 0 }}>📋 Active Sessions</h2>
              <button className="btn" onClick={loadSessions} style={{ fontSize: '13px' }}>
                Refresh
              </button>
            </div>

            {sessions.length === 0 ? (
              <p className="empty-note">Walang active session. Gumawa ng bago sa itaas.</p>
            ) : (
              <ul className="queue-list">
                {sessions.map(s => {
                  const displayUrl = `${window.location.origin}/display?room=${s.id}`;
                  return (
                    <li
                      key={s.id}
                      className="queue-item"
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '14px' }}
                    >
                      {/* Row 1: name + close button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <span className="queue-title">{s.name}</span>
                        <button className="btn btn--remove" onClick={() => handleClose(s.id, s.name)}>
                          Close
                        </button>
                      </div>

                      {/* Row 2: PIN + queue count */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="queue-by">
                          PIN:{' '}
                          <strong style={{ fontSize: '18px', letterSpacing: '3px', color: 'var(--accent-amber)' }}>
                            {s.pin}
                          </strong>
                          <button
                            className="btn"
                            style={{ marginLeft: '6px', padding: '2px 8px', fontSize: '12px' }}
                            onClick={() => copyText(s.pin, `pin-${s.id}`)}
                          >
                            {copied === `pin-${s.id}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </span>
                        <span className="queue-by">
                          {s.queueCount} kanta sa queue
                        </span>
                      </div>

                      {/* Row 3: Display URL */}
                      <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Display URL:</span>
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent-magenta)', fontSize: '12px' }}
                        >
                          /display?room={s.id.slice(0, 8)}…
                        </a>
                        <button
                          className="btn"
                          style={{ padding: '1px 6px', fontSize: '11px' }}
                          onClick={() => copyText(displayUrl, `url-${s.id}`)}
                        >
                          {copied === `url-${s.id}` ? '✓ Copied' : 'Copy URL'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
