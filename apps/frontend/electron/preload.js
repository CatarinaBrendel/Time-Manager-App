const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload] loaded');

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
    _debug: () => 'preload-ok'
  });
  console.log('[preload] exposed window.tm');
} catch(error) {
  console.error('[preload] expose failed:', error);
}
