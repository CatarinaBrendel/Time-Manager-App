const { TaskCreate, TaskUpdate } = require('../models/task');

function registerTasksIpc(ipcMain, repos) {
ipcMain.handle('tm.tasks.create', (_e, payload) => {
const data = TaskCreate.parse(payload);
const id = repos.tasks.create(data);
return repos.tasks.get(Number(id));
});

ipcMain.handle('tm.tasks.update', (_e, payload) => {
const data = TaskUpdate.parse(payload);
repos.tasks.update(data);
return repos.tasks.get(data.id);
});

ipcMain.handle('tm.tasks.get', (_e, id) => repos.tasks.get(Number(id)));
ipcMain.handle('tm.tasks.list', (_e, { limit = 50, offset = 0 } = {}) => repos.tasks.list(limit, offset));
ipcMain.handle('tm.tasks.delete', (_e, id) => { repos.tasks.delete(Number(id)); return { ok: true }; });
}

module.exports = { registerTasksIpc };