import { useState, useEffect, useRef } from 'react';
import { api, getSessionId } from './api';

export default function Reserve() {
  const [name, setName] = useState(() => localStorage.getItem('karaoke_name') || '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState('');
  const [linkReserving, setLinkReserving] = useState(false);
  const [reservingId, setReservingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  useEffect(() => {
    localStorage.setItem('karaoke_name', name);
  }, [name]);

  function addToast(msg, type = 'success') {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const data = await api.search(query.trim());
      setResults(data.results || []);
      if (!data.results?.length) addToast('Walang nahanap. Subukan ng ibang keyword.', 'error');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSearching(false);
    }
  }

  async function handleReserve(video) {
    if (!name.trim()) { addToast('Ilagay muna ang iyong pangalan.', 'error'); return; }
    setReservingId(video.videoId);
    try {
      await api.reserve({
        name: name.trim(),
        sessionId: getSessionId(),
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
      });
      addToast(`Na-reserve: ${video.title}`);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setReservingId(null);
    }
  }

  async function handleLinkReserve(e) {
    e.preventDefault();
    if (!name.trim()) { addToast('Ilagay muna ang iyong pangalan.', 'error'); return; }
    if (!link.trim()) { addToast('I-paste ang YouTube link.', 'error'); return; }
    setLinkReserving(true);
    try {
      await api.reserve({ name: name.trim(), sessionId: getSessionId(), link: link.trim() });
      addToast('Na-reserve ang kanta mula sa link!');
      setLink('');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLinkReserving(false);
    }
  }

  return (
    <div className="page">
      {/* Toast container */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {/* Name field */}
      <div className="field">
        <label className="field-label">Pangalan mo:</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Hal. Juan"
          maxLength={40}
        />
      </div>

      {/* Search */}
      <div className="field">
        <label className="field-label">Type ang kanta (o artist):</label>
        <form className="search-row" onSubmit={handleSearch}>
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Hal. Tensionado karaoke"
          />
          <button className="btn btn--primary" type="submit" disabled={searching}>
            {searching ? '...' : 'Hanapin'}
          </button>
        </form>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="results">
          {results.map((v, i) => (
            <div className="result-card" key={v.videoId} style={{ animationDelay: `${i * 60}ms` }}>
              {v.thumbnail && (
                <img className="result-thumb" src={v.thumbnail} alt="" loading="lazy" />
              )}
              <div className="result-info">
                <p className="result-title">{v.title}</p>
                <p className="result-channel">{v.channel}</p>
              </div>
              <button
                className="btn btn--reserve"
                onClick={() => handleReserve(v)}
                disabled={reservingId === v.videoId}
              >
                {reservingId === v.videoId ? '...' : 'I-reserve'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link reserve */}
      <div className="divider">— o i-paste ang YouTube link —</div>
      <form className="field" onSubmit={handleLinkReserve}>
        <label className="field-label">YouTube link:</label>
        <input
          className="input"
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <button className="btn btn--block btn--primary" type="submit" disabled={linkReserving}>
          {linkReserving ? 'Nag-re-reserve...' : 'I-reserve gamit ang link'}
        </button>
      </form>
    </div>
  );
}
