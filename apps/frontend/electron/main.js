// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initBackend } = require('./backend/index');

function createWindow () {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // 👈 add this
    }
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}
app.whenReady(
  initBackend(app, ipcMain)
).then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
