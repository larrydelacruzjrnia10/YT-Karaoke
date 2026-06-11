import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Reserve from './Reserve';
import ReservedSong from './ReservedSong';
import Display from './Display';

export default function App() {
  const location = useLocation();
  const isDisplay = location.pathname === '/display';

  if (isDisplay) {
    return <Display />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🎤 Karaoke</h1>
        <p className="app-subtitle">Mag-reserve ng kanta gamit ang cellphone mo</p>
      </header>

      <div className="tab-bar">
        <NavLink to="/" end className={({ isActive }) => 'tab' + (isActive ? ' tab--active' : '')}>
          Reserve
        </NavLink>
        <NavLink to="/my" className={({ isActive }) => 'tab' + (isActive ? ' tab--active' : '')}>
          Reserved Song
        </NavLink>
      </div>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Reserve />} />
          <Route path="/my" element={<ReservedSong />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <span>🖥️ Ang listahan ng na-reserve ay makikita sa PC sa:</span>
        <span><strong>/display</strong> — para sa patugtog at current song</span>
        <span><strong>/queue</strong> — para sa buong listahan ng queue (coming soon)</span>
      </footer>
    </div>
  );
}
