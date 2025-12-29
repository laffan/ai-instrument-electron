const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  loadFile: () => ipcRenderer.invoke('load-file'),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', callback),
  onMenuLoad: (callback) => ipcRenderer.on('menu-load', callback),
  onMenuReset: (callback) => ipcRenderer.on('menu-reset', callback),
  onMenuRandomize: (callback) => ipcRenderer.on('menu-randomize', callback),
  onMenuExportMidi: (callback) => ipcRenderer.on('menu-export-midi', callback)
});
