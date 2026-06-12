import { useState } from 'react';
import { api, setRoomData } from './api';

export default function PinEntry({ onJoin }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.pinJoin(pin.trim());
      setRoomData(data.roomId, data.sessionName);
      onJoin({ roomId: data.roomId, sessionName: data.sessionName });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🎤 Karaoke</h1>
        <p className="app-subtitle">I-enter ang PIN para makapag-reserve</p>
      </header>

      <main className="app-main">
        <div className="page">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">PIN (hihingiin sa host):</label>
              <input
                className="input"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Hal. 1234"
                maxLength={8}
                inputMode="numeric"
                autoFocus
              />
            </div>
            {error && (
              <p style={{ color: 'var(--accent-magenta)', fontSize: '14px', margin: '-4px 0 12px' }}>
                {error}
              </p>
            )}
            <button
              className="btn btn--block btn--primary"
              type="submit"
              disabled={loading || !pin.trim()}
            >
              {loading ? 'Checking...' : 'Pumasok'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
