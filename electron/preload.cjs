const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('viewer', {
  open: folder => ipcRenderer.invoke('open', folder),
  drop: file => ipcRenderer.invoke('drop', webUtils.getPathForFile(file)),
  fullscreen: () => ipcRenderer.invoke('fullscreen'),
  trash: file => ipcRenderer.invoke('trash', file),
  refresh: () => ipcRenderer.invoke('refresh'),
  closeChoice: choice => ipcRenderer.invoke('close-choice', choice),
  onClose: callback => ipcRenderer.on('confirm-close', callback),
  onOpen: callback => ipcRenderer.on('open-collection', (_, data) => callback(data))
});
