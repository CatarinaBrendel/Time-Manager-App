// apps/frontend/electron/backend/index.js
const path = require('node:path');
const Database = require('better-sqlite3');

const { openDatabase } = require('./db/database');
const { ensureMigrations } = require('./db/migrate');
const { TasksRepo } = require('./repos/tasksRepo');
const { SessionsRepo } = require('./repos/sessionsRepo');
const { registerTasksIpc } = require('./ipc/tasksIpc');
const { registerSessionsIpc } = require('./ipc/sessionsIpc');
const { log } = require('./util/logger');

function initBackend(app, ipcMain) {
  let db, dbPath, volatile = false;

  try {
    ({ db, dbPath } = openDatabase(app));
    ensureMigrations(db, path.join(__dirname, 'db/migrations'));
    log('[backend] persistent DB ready at', dbPath);
  } catch (err) {
    log('[backend] persistent DB failed, using in-memory:', err?.message || err);
    dbPath = ':memory:'; volatile = true;

    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    ensureMigrations(db, path.join(__dirname, 'db/migrations'));
  }

  const repos = {
    tasks: TasksRepo(db),
    sessions: SessionsRepo(db),
  };

  // Avoid duplicates during hot reload
  [
    'tm.tasks.create','tm.tasks.update','tm.tasks.get','tm.tasks.list','tm.tasks.delete',
    'tm.sessions.start','tm.sessions.stop','tm.sessions.pause','tm.sessions.resume',
    'tm.sessions.current','tm.sessions.summary','ping'
  ].forEach(ch => ipcMain.removeHandler(ch));

  registerTasksIpc(ipcMain, repos);
  registerSessionsIpc(ipcMain, repos);
  ipcMain.handle('ping', () => 'pong');

  log('Backend ready. DB:', dbPath, volatile ? '(in-memory)' : '');
  return { dbPath, volatile };
}

module.exports = { initBackend };
