const { SessionStart, SessionStop, SessionPause, SessionResume } = require('../models/session');

function registerSessionsIpc(ipcMain, repos) {
  ipcMain.handle('tm.sessions.start', (_e, payload) => {
    const { task_id = null, kind = 'focus' } = SessionStart.parse(payload);
    const id = repos.sessions.start({ task_id, kind });
    return { id: Number(id) };
  });

  ipcMain.handle('tm.sessions.stop', (_e, payload) => {
    const { id } = SessionStop.parse(payload);
    repos.sessions.stop(id);
    return { ok: true };
  });

  // NEW
  ipcMain.handle('tm.sessions.pause', (_e, payload) => {
    const { id } = SessionPause.parse(payload);
    repos.sessions.pause(id);                   // will ABORT if a pause is already open (trigger)
    return { ok: true };
  });

  ipcMain.handle('tm.sessions.resume', (_e, payload) => {
    const { id } = SessionResume.parse(payload);
    repos.sessions.resume(id);                  // closes the open pause (if any)
    return { ok: true };
  });

  ipcMain.handle('tm.sessions.current', () => repos.sessions.current());
  ipcMain.handle('tm.sessions.summary', (_e, days = 14) => repos.sessions.summary(days));
}

module.exports = { registerSessionsIpc };
