// Mini widget BrowserWindow: creation, show/hide, positioning
const path = require('path');
const { BrowserWindow, screen, app } = require('electron');

let miniWin = null;


function miniUrl() {
  // 1) DEV: Vite dev server (multi-page) serves mini at /src/mini/mini.html
  const devBase =
    process.env.VITE_DEV_SERVER_URL ||
    process.env.ELECTRON_RENDERER_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173/' : null);

  if (devBase) {
    const base = devBase.endsWith('/') ? devBase : `${devBase}/`;
    return new URL('src/widget/widget.html', base).toString();
  }

  // Helper to make file:// URL
  const fileUrl = (p) => `file://${p.replace(/\\/g, '/')}`;

  // 2) PROD (packaged): dist/mini.html is inside app.asar
  try {
    const packagedHtml = path.join(app.getAppPath(), 'dist', 'widget.html');
    return fileUrl(packagedHtml);
  } catch (_) {
    // fall through to unpackaged
  }

  // 3) PROD (unpackaged local run after `vite build`):
  // from apps/frontend/electron/backend/widget -> apps/frontend/renderer/src/widget/widget.html
  const unpackagedHtml = path.join(__dirname, '../../../renderer/src/widget/widget.html');
  return fileUrl(unpackagedHtml);
}


function createMiniWindow() {
  if (miniWin && !miniWin.isDestroyed()) return miniWin;

  miniWin = new BrowserWindow({
    width: 380,
    height: 440,
    minWidth: 320,
    minHeight: 360,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    }
  });

  // macOS: make it appear over full-screen spaces
  try {
    miniWin.setAlwaysOnTop(true, 'screen-saver');
    miniWin.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
  } catch (_) {}

  miniWin.loadURL(miniUrl());

  // Hide on blur (click outside)
  miniWin.on('blur', () => {
    if (!miniWin) return;
    if (miniWin.webContents.isDevToolsOpened()) return;
    miniWin.hide();
  });

  return miniWin;
}

function positionNearTray(trayBounds) {
  const win = createMiniWindow();
  const { width: w, height: h } = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds?.x || 0, y: trayBounds?.y || 0 });
  const workArea = display.workArea;

  let x = Math.round((trayBounds?.x || (workArea.x + workArea.width - w - 16)));
  let y;

  if (process.platform === 'darwin') {
    // Menu bar at top
    y = Math.max(workArea.y + 28, (trayBounds?.y || workArea.y) + (trayBounds?.height || 0) + 8);
  } else {
    // Windows taskbar is usually bottom; place above it
    y = Math.max(workArea.y + 16, workArea.y + workArea.height - h - 16);
  }
  win.setBounds({ x, y, width: w, height: h });
}

function toggleMiniWindow(trayBounds) {
  const win = createMiniWindow();
  if (win.isVisible()) {
    win.hide();
  } else {
    if (trayBounds) positionNearTray(trayBounds);
    win.showInactive(); // don’t steal focus too aggressively
    win.focus();
  }
}

function showMiniWindow(trayBounds) {
  const win = createMiniWindow();
  if (!win.isVisible()) {
    if (trayBounds) positionNearTray(trayBounds);
    win.show();
    win.focus();
  }
}

function hideMiniWindow() {
  if (miniWin && !miniWin.isDestroyed()) miniWin.hide();
}

module.exports = {
  createMiniWindow,
  toggleMiniWindow,
  showMiniWindow,
  hideMiniWindow
};
