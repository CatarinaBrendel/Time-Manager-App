// IPC surface for the mini widget
function registerMiniIpc(ipcMain, repos) {
  // Quick add task
  ipcMain.handle('mini.quickAddTask', async (_e, title) => {
    if (!title || !title.trim()) return { ok: false, error: 'EMPTY_TITLE' };
    const task = await repos.tasks.createQuickTask(title.trim());
    return { ok: true, task };
  });

  // List today's active tasks (not done) ordered by priority DESC, then ETA ASC
  ipcMain.handle('mini.listActiveToday', async (_e, { limit = 20 } = {}) => {
    const tasks = await repos.tasks.listActiveDueToday({ limit });
    return { ok: true, tasks };
  });

  // Timer controls (delegate to your existing timer/session service if present)
  ipcMain.handle('mini.startTimer', async (_e, taskId) => {
    await repos.tasks.startTaskTimer(taskId); // implement below (no-ops if running)
    return { ok: true };
  });
  ipcMain.handle('mini.pauseTimer', async (_e, taskId) => {
    await repos.tasks.pauseTaskTimer(taskId);
    return { ok: true };
  });
  ipcMain.handle('mini.stopTimer', async (_e, taskId) => {
    await repos.tasks.stopTaskTimer(taskId);
    return { ok: true };
  });
}

module.exports = { registerMiniIpc };
