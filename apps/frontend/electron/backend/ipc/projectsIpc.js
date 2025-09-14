 function registerProjectsIpc(ipcMain, repos) {
   ipcMain.handle('tm.projects.list',   () =>
     (repos.projects ? repos.projects.list() : [])
   );
   ipcMain.handle('tm.projects.ensure', (_e, name) =>
     (repos.projects ? repos.projects.ensure(name) : null)
   );
 }
 module.exports = { registerProjectsIpc };
