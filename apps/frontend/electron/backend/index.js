const path = require('path');
const { openDatabase } = require('./db/database');
const { ensureMigrations } = require('./db/migrate');
const { TasksRepo } = require('./repos/tasksRepo');
const { SessionsRepo } = require('./repos/sessionsRepo');
const { registerTasksIpc } = require('./ipc/tasksIpc');
const { registerSessionsIpc } = require('./ipc/sessionsIpc');
const { log } = require('./util/logger');

function initBackend(app, ipcMain) {
const { db, dbPath } = openDatabase(app);
ensureMigrations(db, path.join(__dirname, 'db/migrations'));

const repos = {
tasks: TasksRepo(db),
sessions: SessionsRepo(db)
};

registerTasksIpc(ipcMain, repos);
registerSessionsIpc(ipcMain, repos);

log('Backend ready. DB:', dbPath);
return { dbPath };
}

module.exports = { initBackend };