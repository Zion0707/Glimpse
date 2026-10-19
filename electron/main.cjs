const { app, BrowserWindow, dialog, ipcMain, protocol, net, Tray, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const supported = /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico)$/i;
let win;
let tray;
let quitting = false;
let closePromptOpen = false;
const iconPath = path.join(__dirname, '../src/assets/icon.ico');
function showWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function minimizeToTray() {
  if (!tray) {
    tray = new Tray(iconPath);
    tray.setToolTip('Glimpse - 图片预览');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开 Glimpse', click: showWindow },
      { type: 'separator' },
      { label: '退出程序', click: () => app.quit() }
    ]));
    tray.on('double-click', showWindow);
    tray.on('click', showWindow);
  }
  win.hide();
}
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { if (tray) tray.destroy(); });
let pending = process.argv.slice(1).find(p => supported.test(p) && path.isAbsolute(p));
const allowed = new Set();
protocol.registerSchemesAsPrivileged([{ scheme: 'preview', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
async function collection(input) {
  const stat = await fs.stat(input);
  const dir = stat.isDirectory() ? input : path.dirname(input);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.filter(e => e.isFile() && supported.test(e.name)).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(async e => {
    const absolute = path.join(dir, e.name);
    allowed.add(absolute);
    const meta = await fs.stat(absolute);
    return { name: e.name, path: absolute, url: `preview://image/${encodeURIComponent(absolute)}`, size: meta.size, modified: meta.mtimeMs };
  }));
  return { files, selected: stat.isDirectory() ? 0 : Math.max(0, files.findIndex(f => f.path === input)), folder: dir };
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', async (_, argv) => {
    if (!win) return;
    showWindow();
    const file = argv.find(p => path.isAbsolute(p) && supported.test(p));
    if (file) { try { win.webContents.send('open-collection', await collection(file)); } catch {} }
  });
  app.whenReady().then(() => {
    protocol.handle('preview', request => {
      const file = decodeURIComponent(new URL(request.url).pathname.slice(1));
      if (!allowed.has(file)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    });
    win = new BrowserWindow({ width: 1380, height: 900, minWidth: 850, minHeight: 600, backgroundColor: '#151719', title: 'Glimpse', icon: iconPath, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.on('close', async event => {
      if (quitting) return;
      event.preventDefault();
      if (closePromptOpen) return;
      closePromptOpen = true;
      try {
        const { response } = await dialog.showMessageBox(win, {
          type: 'question', title: '关闭 Glimpse',
          message: '你希望如何关闭 Glimpse？',
          detail: '最小化到托盘后，应用将在后台运行，可点击托盘图标重新打开。',
          buttons: ['最小化到托盘', '直接退出', '取消'],
          defaultId: 0, cancelId: 2, noLink: true
        });
        if (quitting || win.isDestroyed()) return;
        if (response === 0) minimizeToTray();
        else if (response === 1) app.quit();
      } finally { closePromptOpen = false; }
    });
    win.loadFile(path.join(__dirname, '../src/index.html'));
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.once('did-finish-load', async () => { if (pending) { try { win.webContents.send('open-collection', await collection(pending)); } catch {} pending = null; } });
  });
}
ipcMain.handle('open', async (_, folder) => {
  const result = await dialog.showOpenDialog(win, { properties: [folder ? 'openDirectory' : 'openFile'], filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif','bmp','svg','avif','ico'] }] });
  return result.canceled ? null : collection(result.filePaths[0]);
});
ipcMain.handle('drop', (_, file) => collection(file));
ipcMain.handle('trash', async (_, file) => {
  if (typeof file !== 'string' || !allowed.has(file)) throw new Error('只能删除已打开的图片');
  await shell.trashItem(file);
  allowed.delete(file);
});
ipcMain.handle('fullscreen', () => { win.setFullScreen(!win.isFullScreen()); return win.isFullScreen(); });
app.on('window-all-closed', () => app.quit());
