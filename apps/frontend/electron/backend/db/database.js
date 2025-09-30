// apps/frontend/electron/backend/db/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const log = require('../../util/logger');

function ensureDir(p) {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  } catch (err) {
    log.error('db_dir_create_failed', 'Failed to create DB dir', { dir: p, err: err.message });
    throw err;
  }
}

function resolveBaseDir(app) {
  // 1) Explicit override (absolute or relative to CWD)
  const override = process.env.TM_DB_DIR;
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  }

  // 2) Production: packaged app's userData
  const isProd = app?.isPackaged || process.env.NODE_ENV === 'production';
  if (isProd && app?.getPath) return app.getPath('userData');

  // 3) Dev/CI: keep within repo for visibility
  // __dirname = apps/frontend/electron/backend/db
  return path.resolve(__dirname, '../../../data');
}

/**
 * Open the SQLite database with sensible defaults.
 * Returns { db, dbPath }.
 */
function openDatabase(app, opts = {}) {
  const baseDir = resolveBaseDir(app);
  ensureDir(baseDir);

  const fileName = opts.fileName || 'time_manager.db';
  const dbPath = path.join(baseDir, fileName);

  let db;
  try {
    db = new Database(dbPath); // throws on open failure
  } catch (err) {
    log.error('db_open_failed', 'Failed to open SQLite file', { dbPath, err: err.message, code: err.code });
    throw err;
  }

  try {
    // Pragmas tuned for desktop apps
    db.pragma('journal_mode = WAL');          // improves concurrency
    db.pragma('foreign_keys = ON');           // ensure FK constraints enforced
    db.pragma('synchronous = NORMAL');        // durability/perf balance
    if (typeof db.pragma === 'function') {
      // Optional extra hygiene
      // db.pragma('wal_autocheckpoint = 1000'); // pages; uncomment if desired
    }

    // Make BUSY states less noisy (wait up to 2s by default)
    const busyMs = Number.isFinite(opts.busyTimeoutMs) ? opts.busyTimeoutMs : 2000;
    if (typeof db.defaultSafeIntegers === 'function') db.defaultSafeIntegers();
    if (typeof db.unsafeMode === 'function' && opts.unsafeMode === true) db.unsafeMode(true);
    if (typeof db.pragma === 'function') db.pragma('cache_size = -20000'); // ~20MB page cache (optional)
    if (typeof db.busyTimeout === 'function') db.busyTimeout(busyMs);

    // Read back actual settings to log truth
    const journal_mode = firstCol(db.pragma('journal_mode', { simple: true }));
    const foreign_keys = firstCol(db.pragma('foreign_keys', { simple: true }));
    const synchronous = firstCol(db.pragma('synchronous', { simple: true }));
    const page_size = Number(firstCol(db.pragma('page_size', { simple: true })));
    const user_version = Number(firstCol(db.pragma('user_version', { simple: true })));

    // Quick integrity check in dev (non-fatal)
    let integrity = 'skipped';
    if (process.env.NODE_ENV !== 'production') {
      try {
        const res = db.pragma('quick_check', { simple: true });
        integrity = Array.isArray(res) ? res.join(',') : String(res);
      } catch (e) {
        integrity = 'quick_check_failed';
        log.warn('db_integrity_check_warn', 'quick_check failed', { err: e.message });
      }
    }

    log.info('db_opened', 'SQLite opened', {
      dbPath,
      journal_mode,
      foreign_keys,
      synchronous,
      page_size,
      schema_version: user_version,
      busy_timeout_ms: busyMs,
      integrity
    });
  } catch (err) {
    log.error('db_init_failed', 'Failed to init pragmas', { dbPath, err: err.message });
    db.close();
    throw err;
  }

  return { db, dbPath };
}

/**
 * Helper to wrap mutating statements and log SQLITE_BUSY / IO errors consistently.
 * Usage:
 *   safeWrite(() => db.prepare('INSERT ...').run(...), { op:'INSERT tasks', params_count:2 })
 */
function safeWrite(runFn, meta = {}) {
  try {
    const result = runFn();
    return result;
  } catch (err) {
    const code = err && err.code; // e.g., SQLITE_BUSY, SQLITE_IOERR, SQLITE_FULL
    const errno = err && err.errno;
    const message = err && err.message;
    if (code === 'SQLITE_BUSY') {
      log.warn('db_busy_warn', 'SQLite busy', { ...meta, code, errno, message });
    } else {
      log.error('db_write_failed', 'SQLite write failed', { ...meta, code, errno, message });
    }
    throw err; // rethrow so callers can handle UX/rollback
  }
}

function firstCol(val) {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0];
  return val;
}

module.exports = { openDatabase, resolveBaseDir, safeWrite };
