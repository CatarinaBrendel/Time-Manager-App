const { app, BrowserWindow, ipcMain, nativeTheme } = require("electron");
const path = require("node:path");

const {initBackend} = require("./backend/index");
const isDev = !!process.env.VITE_DEV_SERVER_URL; // set by your dev script

let win;

function createWindow() {
  nativeTheme.themeSource = 'light';
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    icon: path.join(__dirname, "../build/icon.png"),
    title: "Time Manager Dashboard",
    backgroundColor: '#fff',
    webPreferences: {
      preload: require('node:path').join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[main] preload path:', preloadPath);

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL); // e.g. http://localhost:5173
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexHtml = path.join(__dirname, "../renderer/dist/index.html");
    win.loadFile(indexHtml);
  }
}

app.whenReady().then( () => {
  try {
    const { dbPath } = initBackend(app, ipcMain);
    console.log("[main] Backend ready at", dbPath);
    createWindow();
  } catch (err) {
    console.error("[main] Failed to init backend:", err);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
