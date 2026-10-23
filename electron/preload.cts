import { contextBridge, ipcRenderer, webUtils } from 'electron';
const viewer: ViewerAPI = {
    open: (folder) => ipcRenderer.invoke('open', folder),
    drop: (file) => ipcRenderer.invoke('drop', webUtils.getPathForFile(file)),
    fullscreen: () => ipcRenderer.invoke('fullscreen'),
    trash: (file) => ipcRenderer.invoke('trash', file),
    rename: (file, name) => ipcRenderer.invoke('rename', file, name),
    refresh: () => ipcRenderer.invoke('refresh'),
    closeChoice: (choice) => ipcRenderer.invoke('close-choice', choice),
    onClose: (callback) => ipcRenderer.on('confirm-close', callback),
    onFolderChanged: (callback) => ipcRenderer.on('folder-changed', callback),
    onOpen: (callback) =>
        ipcRenderer.on('open-collection', (_, data) => callback(data)),
};
contextBridge.exposeInMainWorld('viewer', viewer);
