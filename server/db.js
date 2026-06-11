const Database = require('better-sqlite3');
const path = require('path');

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
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id    TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      thumbnail   TEXT    NOT NULL DEFAULT '',
      reserved_by TEXT    NOT NULL,
      session_id  TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      played      INTEGER NOT NULL DEFAULT 0,
      played_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_played_created ON reservations (played, created_at);
  `);
}

// All active (unplayed) songs, oldest first — this is the queue order
function getActiveQueue() {
  return getDb()
    .prepare('SELECT * FROM reservations WHERE played=0 ORDER BY created_at ASC')
    .all();
}

// Count of un-played songs belonging to a session
function countActiveForSession(sessionId) {
  return getDb()
    .prepare('SELECT COUNT(*) as cnt FROM reservations WHERE played=0 AND session_id=?')
    .get(sessionId).cnt;
}

// Insert a new reservation; returns the new row
function addReservation({ videoId, title, thumbnail, reservedBy, sessionId }) {
  const stmt = getDb().prepare(`
    INSERT INTO reservations (video_id, title, thumbnail, reserved_by, session_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(videoId, title, thumbnail, reservedBy, sessionId);
  return getDb()
    .prepare('SELECT * FROM reservations WHERE id=?')
    .get(info.lastInsertRowid);
}

// Remove a reservation — only if it belongs to sessionId and is still unplayed
function removeReservation(id, sessionId) {
  const row = getDb()
    .prepare('SELECT * FROM reservations WHERE id=? AND played=0')
    .get(id);
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.session_id !== sessionId) return { ok: false, reason: 'forbidden' };
  getDb().prepare('DELETE FROM reservations WHERE id=?').run(id);
  return { ok: true };
}

// Mark the first unplayed song as played; returns it (or null if queue empty)
function advance() {
  const row = getDb()
    .prepare('SELECT * FROM reservations WHERE played=0 ORDER BY created_at ASC LIMIT 1')
    .get();
  if (!row) return null;
  getDb()
    .prepare('UPDATE reservations SET played=1, played_at=unixepoch() WHERE id=?')
    .run(row.id);
  return row;
}

// The current "now playing" = first unplayed song
function getNowPlaying() {
  return getDb()
    .prepare('SELECT * FROM reservations WHERE played=0 ORDER BY created_at ASC LIMIT 1')
    .get() || null;
}

module.exports = {
  getActiveQueue,
  countActiveForSession,
  addReservation,
  removeReservation,
  advance,
  getNowPlaying,
};
