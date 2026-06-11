import { useState, useRef } from 'react';
import { useLiveQueue } from './useLiveQueue';
import { api, getSessionId } from './api';

export default function ReservedSong() {
  const { queue, max, wsStatus } = useLiveQueue();
  const [removing, setRemoving] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const sessionId = getSessionId();

  function addToast(msg, type = 'success') {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }

  const mine = queue.filter(item => item.session_id === sessionId);

  async function handleRemove(item) {
    setRemoving(item.id);
    try {
      await api.remove({ id: item.id, sessionId });
      addToast('Tinanggal ang kanta.');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setRemoving(null);
    }
  }

  const statusDot = {
    connected: '🟢',
    connecting: '🟡',
    polling: '🔴',
  }[wsStatus] || '🟡';

  return (
    <div className="page">
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {/* My reservations */}
      <section className="section">
        <h2 className="section-title">📋 Mga na-reserve mo</h2>
        <p className="quota-label" style={{ color: mine.length >= max ? 'var(--accent-magenta)' : 'var(--accent-amber)' }}>
          {mine.length}/{max} na-reserve.{' '}
          {mine.length < max
            ? 'Puwede ka pang mag-reserve.'
            : 'Pag may natapos na isa, puwede ka nang mag-reserve ulit.'}
        </p>

        {mine.length === 0 ? (
          <p className="empty-note">Wala ka pang na-reserve. Mag-search o mag-paste ng link sa itaas.</p>
        ) : (
          <ul className="queue-list">
            {mine.map(item => {
              const pos = queue.findIndex(q => q.id === item.id) + 1;
              return (
                <li key={item.id} className="queue-item queue-item--mine">
                  <span className="queue-pos">{pos}</span>
                  <div className="queue-info">
                    {item.thumbnail && <img className="queue-thumb" src={item.thumbnail} alt="" />}
                    <span className="queue-title">{item.title}</span>
                  </div>
                  <button
                    className="btn btn--remove"
                    onClick={() => handleRemove(item)}
                    disabled={removing === item.id}
                  >
                    {removing === item.id ? '...' : 'Tanggalin'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <hr className="divider-line" />

      {/* Full shared queue */}
      <section className="section">
        <h2 className="section-title">
          ♪ Lahat ng nag-reserve (queue){' '}
          <span className="ws-dot" title={wsStatus}>{statusDot}</span>
        </h2>

        {queue.length === 0 ? (
          <p className="empty-note">Walang naka-queue. Maging una!</p>
        ) : (
          <ul className="queue-list">
            {queue.map((item, i) => (
              <li
                key={item.id}
                className={`queue-item ${i === 0 ? 'queue-item--now-playing' : ''}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className={`queue-pos ${i === 0 ? 'queue-pos--active' : ''}`}>{i + 1}</span>
                <div className="queue-info">
                  {item.thumbnail && <img className="queue-thumb" src={item.thumbnail} alt="" />}
                  <div>
                    <span className="queue-title">{item.title}</span>
                    <span className="queue-by">Reserved by: {item.reserved_by}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
