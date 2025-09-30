const { ipcMain, dialog } = require('electron');
const path = require('path');
const logger = require('../util/logger');
const { exportDiagnosticsZip } = require('../util/diagnostics');
const { CH_LOG_WRITE, CH_LOG_GET_PATH, CH_DIAG_EXPORT } = require('./channels');



function registerLoggingIpc() {
  ipcMain.handle(CH_LOG_WRITE, (_ev, line) => {
    // line is a JSON object from renderer; enforce minimal schema + sanitize a bit
    try {
      const obj = {
        ts: new Date().toISOString(),
        level: line.level || 'INFO',
        proc: 'renderer',
        version: line.version || '0.0.0-dev',
        session_id: line.session_id || logger.getSessionId(),
        trace_id: line.trace_id || null,
        event: String(line.event || 'renderer_log'),
        message: String(line.message || ''),
        context: line.context || {}
      };
      // route by level
      switch (obj.level) {
        case 'ERROR': logger.error(obj.event, obj.message, obj.context, obj.trace_id); break;
        case 'WARN':  logger.warn(obj.event, obj.message, obj.context, obj.trace_id); break;
        case 'DEBUG': logger.debug(obj.event, obj.message, obj.context, obj.trace_id); break;
        default:      logger.info(obj.event, obj.message, obj.context, obj.trace_id);
      }
      return { ok: true };
    } catch (err) {
      logger.error('ipc_log_write_failed', err?.message || 'IPC write failed', { stack: err?.stack });
      return { ok: false, error: 'write_failed' };
    }
  });

  ipcMain.handle(CH_LOG_GET_PATH, () => {
    return { dir: logger.getLogDir() };
  });

  ipcMain.handle(CH_DIAG_EXPORT, async (ev) => {
    // Ask user where to save (in main so it works in sandboxed renderer)
    const win = ev?.sender?.getOwnerBrowserWindow?.() ?? null;
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Diagnostics',
      defaultPath: `TimeManager_Diagnostics_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    try {
      const res = await exportDiagnosticsZip(filePath);
      logger.info('diagnostics_exported', 'Diagnostics ZIP created', { zipPath: filePath, files: res.files });
      return { ok: true, zipPath: filePath };
    } catch (err) {
      logger.error('diagnostics_export_failed', err?.message || 'Export failed', { stack: err?.stack });
      return { ok: false, error: 'export_failed' };
    }
  });
}

module.exports = { registerLoggingIpc};
