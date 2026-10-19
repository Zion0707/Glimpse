const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('viewer', {
  open: folder => ipcRenderer.invoke('open', folder),
  drop: file => ipcRenderer.invoke('drop', webUtils.getPathForFile(file)),
  fullscreen: () => ipcRenderer.invoke('fullscreen'),
  trash: file => ipcRenderer.invoke('trash', file),
  onOpen: callback => ipcRenderer.on('open-collection', (_, data) => callback(data))
});
