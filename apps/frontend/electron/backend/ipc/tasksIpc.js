// make sure these handlers RETURN what repos.* returns
const log = require("../../util/logger");

function registerTasksIpc(ipcMain, repos) {
  ipcMain.handle('tm.tasks.create', async (_e, payload) => {
    try {
      // If you use Zod:
      // const data = TaskCreate.parse(payload);
      const row = await repos.tasks.create(payload);
      return row; // ← important
    } catch (err) {
      console.error('[ipc] tm.tasks.create failed:', err);
      log.error('[ipc] tm.tasks.create failed:', err);
      throw err;
    }
  });

  ipcMain.handle('tm.tasks.update', async (_e, payload) => {
    try {
      const row = await repos.tasks.update(payload);
      return row; // ← important
    } catch (err) {
      console.error('[ipc] tm.tasks.update failed:', err);
      log.error('[ipc] tm.tasks.update failed:', err);
      throw err;
    }
  });

  ipcMain.handle('tm.tasks.get', (_e, id) => repos.tasks.get(Number(id)));
  ipcMain.handle('tm.tasks.list', (_e, { limit = 50, offset = 0 } = {}) =>
    repos.tasks.list(limit, offset)
  );
  ipcMain.handle('tm.tasks.delete', (_e, id) => repos.tasks.delete(Number(id)));

  ipcMain.handle('tm.tasks.start', (_e, id) => repos.tasks.start(Number(id)));
  ipcMain.handle('tm.tasks.pause', (_e, id) => repos.tasks.pause(Number(id)));
  ipcMain.handle('tm.tasks.stop',  (_e, id) => repos.tasks.stop (Number(id)));

  ipcMain.handle('tm.tags.list', async () => repos.tags.list());
}
module.exports = { registerTasksIpc };
