// electron/main/ipc/reportsIpc.js
function registerReportsIpc(ipcMain, repos) {
  ipcMain.handle('tm.reports.list', async (_e, opts = {}) => {
    try {
      const result = await repos.reports.list(opts);
      return result; // important: return to renderer
    } catch (err) {
      console.error('[ipc] tm.reports.list failed:', err);
      throw err; // let renderer get the failure
    }
  });
}

module.exports = { registerReportsIpc };
