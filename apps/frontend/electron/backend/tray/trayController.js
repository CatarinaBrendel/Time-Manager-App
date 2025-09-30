// apps/frontend/electron/backend/tray/trayController.js
const path = require('path');
const { Tray, Menu, app } = require('electron');
const { toggleMiniWindow, showMiniWindow, hideMiniWindow } = require('../widget/miniWindow');

let tray;


function trayIconPath() {
  if (process.platform === 'darwin') {
    const p = app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'trayTemplate.png')
      : path.join(__dirname, '../../build/trayTemplate.png');
    return p;
  } else {
    const p = app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'tray.png')
      : path.join(__dirname, '../../build/tray.png');
    return p;
  }
}

function createTray() {
  if (tray) return tray;

  tray = new Tray(trayIconPath());
  tray.setToolTip('Time Manager');

  const menu = Menu.buildFromTemplate([
    { label: 'Show Mini Widget', click: () => showMiniWindow() },
    { label: 'Hide Mini Widget', click: () => hideMiniWindow() },
    { type: 'separator' },
    { label: 'Open Dashboard', click: () => app.emit('open-main-window') },
    { type: 'separator' },
    { role: 'quit', label: 'Quit Time Manager' },
  ]);

  const isMac = process.platform === 'darwin';

  if (isMac) {
    // DO NOT setContextMenu on macOS, or left-click will also open it.
    tray.on('click', (_e, bounds) => {
      tray.closeContextMenu();        // ensure no stray menu stays open
      toggleMiniWindow(bounds);       // show mini only
    });
    tray.on('right-click', () => {
      // Show the menu only on right-click
      tray.popUpContextMenu(menu);
    });
    // Optional: avoid double-click surprises
    tray.setIgnoreDoubleClickEvents(true);
  } else {
    // Windows/Linux: left-click toggles, right-click shows menu, and persistent menu is fine
    tray.setContextMenu(menu);
    tray.on('click', (_e, bounds) => toggleMiniWindow(bounds));
    tray.on('right-click', () => tray.popUpContextMenu(menu));
  }

  return tray;
}

module.exports = { createTray };


