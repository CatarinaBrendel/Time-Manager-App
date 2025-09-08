const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  ping: () => ipcRenderer.invoke('ping'),
  tasks: {
  create: (payload) => ipcRenderer.invoke('tm.tasks.create', payload),
  update: (payload) => ipcRenderer.invoke('tm.tasks.update', payload),
  get: (id) => ipcRenderer.invoke('tm.tasks.get', id),
  list: (opts) => ipcRenderer.invoke('tm.tasks.list', opts),
  delete: (id) => ipcRenderer.invoke('tm.tasks.delete', id),
  },
  sessions: {
    start:   (payload) => ipcRenderer.invoke('tm.sessions.start', payload),
    stop:    (payload) => ipcRenderer.invoke('tm.sessions.stop', payload),
    pause:   (payload) => ipcRenderer.invoke('tm.sessions.pause', payload),
    resume:  (payload) => ipcRenderer.invoke('tm.sessions.resume', payload),
    current: () => ipcRenderer.invoke('tm.sessions.current'),
    summary: (days) => ipcRenderer.invoke('tm.sessions.summary', days),
  }
});