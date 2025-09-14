// apps/frontend/electron/backend/index.js
const path = require('node:path');
const Database = require('better-sqlite3');

const { openDatabase } = require('./db/database');
const { ensureMigrations } = require('./db/migrate');
const { TasksRepo } = require('./repos/tasksRepo');
const { TagsRepo } = require('./repos/tagsRepo');
const { registerTasksIpc } = require('./ipc/tasksIpc');
const { registerProjectsIpc } = require('./ipc/projectsIpc');
const { log } = require('./util/logger');
const { ProjectsRepo } = require('./repos/projectsRepo');

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
    tags: TagsRepo(db),
    projects: ProjectsRepo(db),
  };

  // Avoid duplicates during hot reload
  [
    'tm.tasks.create','tm.tasks.update','tm.tasks.get','tm.tasks.list','tm.tasks.delete',
    'tm.tags.list', 'tm.projects.list', 'tm.projects.ensure', 'ping'
  ].forEach(ch => ipcMain.removeHandler(ch));

  registerTasksIpc(ipcMain, repos);
  registerProjectsIpc(ipcMain, repos);
  ipcMain.handle('ping', () => 'pong');

  log('Backend ready. DB:', dbPath, volatile ? '(in-memory)' : '');
  return { dbPath, volatile };
}

module.exports = { initBackend };
