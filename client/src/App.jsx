import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Reserve from './Reserve';
import ReservedSong from './ReservedSong';
import Display from './Display';
import PinEntry from './PinEntry';
import HostLogin from './HostLogin';
import HostDashboard from './HostDashboard';
import { getRoomData, clearRoomData, api } from './api';

export default function App() {
  const location = useLocation();
  const [roomData, setRoomData] = useState(() => getRoomData());

  // On mount, verify the stored room is still active on the server
  useEffect(() => {
    const rd = getRoomData();
    if (!rd) return;
    api.queue(rd.roomId)
      .then(data => {
        if (data.sessionActive === false) {
          clearRoomData();
          setRoomData(null);
        }
      })
      .catch(() => {});
  }, []);

  // Host-only pages — no PIN gate needed
  if (location.pathname === '/host') return <HostLogin />;
  if (location.pathname === '/host/dashboard') return <HostDashboard />;

  // Display screen — operator's TV, accepts ?room= query param
  if (location.pathname === '/display') return <Display />;

  // Guest pages — require a valid PIN session
  if (!roomData) {
    return <PinEntry onJoin={rd => setRoomData(rd)} />;
  }

  function handleChangeSession() {
    clearRoomData();
    setRoomData(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🎤 Karaoke</h1>
        <p className="app-subtitle">{roomData.sessionName} — Mag-reserve ng kanta</p>
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
          <Route path="/" element={<Reserve roomId={roomData.roomId} />} />
          <Route path="/my" element={<ReservedSong roomId={roomData.roomId} />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <span>🖥️ Ang listahan ng na-reserve ay makikita sa PC sa:</span>
        <span><strong>/display</strong> — para sa patugtog at current song</span>
        <span>
          <button
            onClick={handleChangeSession}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
          >
            Change session / PIN
          </button>
        </span>
      </footer>
    </div>
  );
}
