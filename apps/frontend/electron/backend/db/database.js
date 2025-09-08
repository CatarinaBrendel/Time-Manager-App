const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function openDatabase(app) {
const userData = app.getPath('userData');
const dbDir = path.join(userData, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'time_manager.db');

const db = new Database(dbPath);

// Recommended pragmas for desktop apps
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

return { db, dbPath };
}

module.exports = { openDatabase };