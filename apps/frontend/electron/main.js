// apps/frontend/electron/main.js
const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut } = require('electron');
const path = require('node:path');

const isDev =
  !!process.env.VITE_DEV_SERVER_URL ||
  process.env.NODE_ENV === 'development';

const { initBackend } = require('./backend/index');
const { createTray } = require('./backend/tray/trayController');
const { createMiniWindow, toggleMiniWindow } = require('./backend/widget/miniWindow');

// ---- Logging (unchanged)
require('./util/logger');
const { registerLoggingIpc } = require('./ipc/loggingIpc');
registerLoggingIpc();

// ---- Optional: ensure single instance (recommended for tray apps)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus existing window (or open one)
    app.emit('open-main-window');
  });
}

// ---- Windows: better notifications/taskbar identity
if (process.platform === 'win32') {
  app.setAppUserModelId('Time Manager Dashboard');
}

let mainWindow;

// ---- URL helpers
function getIndexUrl() {
  // Dev: served by Vite at /
  const devBase =
    process.env.VITE_DEV_SERVER_URL ||
    process.env.ELECTRON_RENDERER_URL ||
    (isDev ? 'http://localhost:5173/' : null);

  if (devBase) return devBase;

  // Prod: dist/index.html is bundled under app.asar
  const html = path.join(app.getAppPath(), 'dist', 'index.html');
  return `file://${html.replace(/\\/g, '/')}`;
}

function createMainWindow() {
  nativeTheme.themeSource = 'light';

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 905,
    title: 'Time Manager Dashboard',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '../build/icon.png'),
    show: false, // show when ready-to-show for smoother UX
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
    },
  });

  // Load
  const url = getIndexUrl();
  if (url.startsWith('http')) {
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadURL(url); // file://
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(() => {
  try {
    const { dbPath } = initBackend(app, ipcMain);
    console.log('[main] Backend ready at', dbPath);

    // Main window
    createMainWindow();

    // Mini widget window (created hidden; toggled by tray/shortcut)
    createMiniWindow();

    // Tray / Menu bar
    createTray();

    // Global shortcut: toggle mini (Cmd/Ctrl + Shift + Space)
    const accelerator = process.platform === 'darwin'
      ? 'Command+Option+Space'
      : 'Control+Alt+Space';

    const ok = globalShortcut.register(accelerator, () => {
      try { toggleMiniWindow(); } catch (_) {}
    });
    if (!ok) {
      console.warn('[main] Global shortcut registration failed');
    }

    // Let tray invoke focusing the main window
    app.on('open-main-window', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });

    // macOS: re-create main window on dock click if none open
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });

  } catch (err) {
    console.error('[main] Failed to init backend:', err);
  }
});

// Quit when all windows closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up global shortcuts
app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch (_) {}
});
