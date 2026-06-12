import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHostToken, getHostToken } from './api';

export default function HostLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (getHostToken()) navigate('/host/dashboard', { replace: true });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.host.login(password);
      setHostToken(data.token);
      navigate('/host/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🎤 Host Login</h1>
        <p className="app-subtitle">Para sa operator ng karaoke</p>
      </header>

      <main className="app-main">
        <div className="page">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Password:</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
              disabled={loading || !password}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
