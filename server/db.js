const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'karaoke.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS pin_sessions (
      id         TEXT    PRIMARY KEY,
      pin        TEXT    NOT NULL UNIQUE,
      name       TEXT    NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      closed_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id    TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      thumbnail   TEXT    NOT NULL DEFAULT '',
      reserved_by TEXT    NOT NULL,
      session_id  TEXT    NOT NULL,
      room_id     TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      played      INTEGER NOT NULL DEFAULT 0,
      played_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_played_created ON reservations (played, created_at);
  `);

  // Migration: add room_id to existing installs that predate this column
  try { d.exec('ALTER TABLE reservations ADD COLUMN room_id TEXT'); } catch {}
}

// ── PIN Sessions ──────────────────────────────────────────────────────────────

function createPinSession({ name, pin }) {
  const id = crypto.randomUUID();
  getDb().prepare('INSERT INTO pin_sessions (id, pin, name) VALUES (?, ?, ?)').run(id, pin, name);
  return getDb().prepare('SELECT * FROM pin_sessions WHERE id=?').get(id);
}

function getPinSessionByPin(pin) {
  return getDb().prepare('SELECT * FROM pin_sessions WHERE pin=? AND active=1').get(pin) || null;
}

function getPinSessionById(id) {
  return getDb().prepare('SELECT * FROM pin_sessions WHERE id=?').get(id) || null;
}

function getActivePinSessions() {
  return getDb().prepare('SELECT * FROM pin_sessions WHERE active=1 ORDER BY created_at ASC').all();
}

function closePinSession(id) {
  getDb().prepare('UPDATE pin_sessions SET active=0, closed_at=unixepoch() WHERE id=?').run(id);
}

// ── Queue / Reservations ──────────────────────────────────────────────────────

function getActiveQueue(roomId) {
  if (roomId) {
    return getDb()
      .prepare('SELECT * FROM reservations WHERE played=0 AND room_id=? ORDER BY created_at ASC')
      .all(roomId);
  }
  return getDb()
    .prepare('SELECT * FROM reservations WHERE played=0 ORDER BY created_at ASC')
    .all();
}

function countActiveForSession(sessionId, roomId) {
  if (roomId) {
    return getDb()
      .prepare('SELECT COUNT(*) as cnt FROM reservations WHERE played=0 AND session_id=? AND room_id=?')
      .get(sessionId, roomId).cnt;
  }
  return getDb()
    .prepare('SELECT COUNT(*) as cnt FROM reservations WHERE played=0 AND session_id=?')
    .get(sessionId).cnt;
}

function addReservation({ videoId, title, thumbnail, reservedBy, sessionId, roomId }) {
  const stmt = getDb().prepare(`
    INSERT INTO reservations (video_id, title, thumbnail, reserved_by, session_id, room_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(videoId, title, thumbnail, reservedBy, sessionId, roomId || null);
  return getDb().prepare('SELECT * FROM reservations WHERE id=?').get(info.lastInsertRowid);
}

// Returns { ok, reason?, roomId? } — roomId is included so caller can broadcast to the right room
function removeReservation(id, sessionId) {
  const row = getDb()
    .prepare('SELECT * FROM reservations WHERE id=? AND played=0')
    .get(id);
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.session_id !== sessionId) return { ok: false, reason: 'forbidden' };
  getDb().prepare('DELETE FROM reservations WHERE id=?').run(id);
  return { ok: true, roomId: row.room_id || null };
}

function advance(roomId) {
  let row;
  if (roomId) {
    row = getDb()
      .prepare('SELECT * FROM reservations WHERE played=0 AND room_id=? ORDER BY created_at ASC LIMIT 1')
      .get(roomId);
  } else {
    row = getDb()
      .prepare('SELECT * FROM reservations WHERE played=0 ORDER BY created_at ASC LIMIT 1')
      .get();
  }
  if (!row) return null;
  getDb().prepare('UPDATE reservations SET played=1, played_at=unixepoch() WHERE id=?').run(row.id);
  return row;
}

function getNowPlaying(roomId) {
  if (roomId) {
    return getDb()
      .prepare('SELECT * FROM reservations WHERE played=0 AND room_id=? ORDER BY created_at ASC LIMIT 1')
      .get(roomId) || null;
  }
  return getDb()
    .prepare('SELECT * FROM reservations WHERE played=0 ORDER BY created_at ASC LIMIT 1')
    .get() || null;
}

module.exports = {
  createPinSession,
  getPinSessionByPin,
  getPinSessionById,
  getActivePinSessions,
  closePinSession,
  getActiveQueue,
  countActiveForSession,
  addReservation,
  removeReservation,
  advance,
  getNowPlaying,
};
