const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function resolveBaseDir(app) {
  // 1) Explicit override (absolute or relative to CWD)
  if (process.env.TM_DB_DIR) {
    return path.isAbsolute(process.env.TM_DB_DIR)
      ? process.env.TM_DB_DIR
      : path.resolve(process.cwd(), process.env.TM_DB_DIR);
  }

  // 2) Production: packaged app's userData
  const isProd = app?.isPackaged || process.env.NODE_ENV === 'production';
  if (isProd && app?.getPath) {
    return app.getPath('userData');
  }

  // 3) Dev/CI: keep within the repo so it's easy to inspect/commit migrations
  // __dirname = apps/frontend/electron/backend/db
  // -> ../..../ to apps/frontend, then /data
  return path.resolve(__dirname, '../../../data');
}

function openDatabase(app) {
  const baseDir = resolveBaseDir(app);
  const dbDir = baseDir;
  ensureDir(dbDir);

  const dbPath = path.join(dbDir, 'time_manager.db');
  const db = new Database(dbPath);

  // Pragmas tuned for desktop apps
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  return { db, dbPath };
}

module.exports = { openDatabase, resolveBaseDir };
