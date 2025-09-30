const { contextBridge, ipcRenderer } = require('electron');

// Use literals here to avoid bundler path issues
const CH_LOG_WRITE   = 'log:write';
const CH_LOG_GETPATH = 'log:getPath';
const CH_DIAG_EXPORT = 'diagnostics:export';

const appVersion = process?.env?.npm_package_version || '0.0.0-dev';

try {
  contextBridge.exposeInMainWorld('tm', {
    ping: () => ipcRenderer.invoke('ping'),
    tasks: {
      create: (payload) => ipcRenderer.invoke('tm.tasks.create', payload),
      update: (payload) => ipcRenderer.invoke('tm.tasks.update', payload),
      get: (id) => ipcRenderer.invoke('tm.tasks.get', id),
      list: (opts) => ipcRenderer.invoke('tm.tasks.list', opts),
      delete: (id) => ipcRenderer.invoke('tm.tasks.delete', id),
      start:  (id)      => ipcRenderer.invoke('tm.tasks.start',  id),
      pause:  (id)      => ipcRenderer.invoke('tm.tasks.pause',  id),
      stop:   (id)      => ipcRenderer.invoke('tm.tasks.stop',   id),
    },
    sessions: {
      start:   (payload) => ipcRenderer.invoke('tm.sessions.start', payload),
      stop:    (payload) => ipcRenderer.invoke('tm.sessions.stop', payload),
      pause:   (payload) => ipcRenderer.invoke('tm.sessions.pause', payload),
      resume:  (payload) => ipcRenderer.invoke('tm.sessions.resume', payload),
      current: () => ipcRenderer.invoke('tm.sessions.current'),
      summary: (days) => ipcRenderer.invoke('tm.sessions.summary', days),
    },
    tags: {
      list: () => ipcRenderer.invoke('tm.tags.list'),
    },
    projects: {
      list: () => ipcRenderer.invoke('tm.projects.list'),
      ensure: (name) => ipcRenderer.invoke('tm.projects.ensure', name),
    },
    reports: {
      list: (opts) => ipcRenderer.invoke("tm.reports.list", opts),
    },
    write: (line) => ipcRenderer.invoke(CH_LOG_WRITE, line),
    getLogDir: () => ipcRenderer.invoke(CH_LOG_GETPATH),
    exportDiagnostics: () => ipcRenderer.invoke(CH_DIAG_EXPORT),
    appVersion,
    _debug: () => 'preload-ok'
  });
  console.log('[preload] exposed window.tm');
} catch(error) {
  console.error('[preload] expose failed:', error);
}
