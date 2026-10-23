import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    protocol,
    net,
    Tray,
    Menu,
    shell,
} from 'electron';
import fs from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const supported = /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico)$/i;
let win: BrowserWindow;
let tray: Tray | undefined;
let quitting = false;
let closePromptOpen = false;
let trayCloseConfirmed = false;
let currentFolder: string | undefined;
let folderWatcher: FSWatcher | undefined;
let watchTimer: ReturnType<typeof setTimeout> | undefined;
function watchFolder(folder: string) {
    if (currentFolder === folder && folderWatcher) return;
    folderWatcher?.close();
    clearTimeout(watchTimer);
    currentFolder = folder;
    try {
        folderWatcher = watch(folder, () => {
            clearTimeout(watchTimer);
            watchTimer = setTimeout(() => {
                if (!win.isDestroyed()) win.webContents.send('folder-changed');
            }, 250);
        });
        folderWatcher.on('error', () => {
            folderWatcher?.close();
            folderWatcher = undefined;
        });
    } catch {
        folderWatcher = undefined;
    }
}
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
        tray.setContextMenu(
            Menu.buildFromTemplate([
                { label: '打开 Glimpse', click: showWindow },
                { type: 'separator' },
                { label: '退出程序', click: () => app.quit() },
            ]),
        );
        tray.on('double-click', showWindow);
        tray.on('click', showWindow);
    }
    win.hide();
}
app.on('before-quit', () => {
    quitting = true;
});
app.on('will-quit', () => {
    tray?.destroy();
    folderWatcher?.close();
    clearTimeout(watchTimer);
});
let pending = process.argv
    .slice(1)
    .find((p) => supported.test(p) && path.isAbsolute(p));
const allowed = new Set<string>();
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'preview',
        privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
]);
async function collection(input: string, observe = true) {
    const stat = await fs.stat(input);
    const dir = stat.isDirectory() ? input : path.dirname(input);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries
            .filter((e) => e.isFile() && supported.test(e.name))
            .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true }),
            )
            .map(async (e) => {
                const absolute = path.join(dir, e.name);
                allowed.add(absolute);
                const meta = await fs.stat(absolute);
                return {
                    name: e.name,
                    path: absolute,
                    url: `preview://image/${encodeURIComponent(absolute)}`,
                    size: meta.size,
                    modified: meta.mtimeMs,
                };
            }),
    );
    if (observe) watchFolder(dir);
    return {
        files,
        selected: stat.isDirectory()
            ? 0
            : Math.max(
                  0,
                  files.findIndex((f) => f.path === input),
              ),
        folder: dir,
    };
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on('second-instance', async (_, argv) => {
        if (!win) return;
        showWindow();
        const file = argv.find((p) => path.isAbsolute(p) && supported.test(p));
        if (file) {
            try {
                win.webContents.send('open-collection', await collection(file));
            } catch {}
        }
    });
    app.whenReady().then(() => {
        protocol.handle('preview', (request) => {
            const file = decodeURIComponent(
                new URL(request.url).pathname.slice(1),
            );
            if (!allowed.has(file))
                return new Response('Forbidden', { status: 403 });
            return net.fetch(pathToFileURL(file).href);
        });
        win = new BrowserWindow({
            width: 1380,
            height: 900,
            minWidth: 850,
            minHeight: 600,
            backgroundColor: '#151719',
            title: 'Glimpse',
            icon: iconPath,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
            },
        });
        win.on('close', (event) => {
            if (quitting) return;
            if (trayCloseConfirmed) {
                event.preventDefault();
                minimizeToTray();
                return;
            }
            event.preventDefault();
            if (closePromptOpen) return;
            closePromptOpen = true;
            win.webContents.send('confirm-close');
        });
        win.loadFile(path.join(__dirname, '../src/index.html'));
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.on('will-navigate', (event) => event.preventDefault());
        win.webContents.once('did-finish-load', async () => {
            if (pending) {
                try {
                    win.webContents.send(
                        'open-collection',
                        await collection(pending),
                    );
                } catch {}
                pending = undefined;
            }
        });
    });
}
ipcMain.handle('open', async (_, folder) => {
    const result = await dialog.showOpenDialog(win, {
        properties: [folder ? 'openDirectory' : 'openFile'],
        filters: [
            {
                name: 'Images',
                extensions: [
                    'png',
                    'jpg',
                    'jpeg',
                    'webp',
                    'gif',
                    'bmp',
                    'svg',
                    'avif',
                    'ico',
                ],
            },
        ],
    });
    return result.canceled ? null : collection(result.filePaths[0]);
});
ipcMain.handle('drop', (_, file) => collection(file));
ipcMain.handle('refresh', () =>
    currentFolder ? collection(currentFolder, false) : null,
);
ipcMain.handle('close-choice', (_, choice) => {
    if (!closePromptOpen) return;
    closePromptOpen = false;
    if (choice === 'tray') {
        trayCloseConfirmed = true;
        minimizeToTray();
    }
    else if (choice === 'quit') app.quit();
});
ipcMain.handle('trash', async (_, file) => {
    if (typeof file !== 'string' || !allowed.has(file))
        throw new Error('只能删除已打开的图片');
    await shell.trashItem(file);
    allowed.delete(file);
});
ipcMain.handle('rename', async (_, file, requestedName) => {
    if (typeof file !== 'string' || !allowed.has(file))
        throw new Error('只能重命名已打开的图片');
    if (typeof requestedName !== 'string') throw new Error('文件名无效');
    const extension = path.extname(file);
    const base = path.basename(file, extension);
    const nextBase = requestedName.trim();
    if (!nextBase || /[\\/:*?"<>|\u0000-\u001f]/.test(nextBase) || nextBase === '.' || nextBase === '..')
        throw new Error('文件名包含无效字符');
    if (nextBase.toLowerCase() !== base.toLowerCase() && path.extname(nextBase))
        throw new Error('不能修改文件扩展名');
    const destination = path.join(path.dirname(file), `${nextBase}${extension}`);
    if (destination.toLowerCase() !== file.toLowerCase()) {
        try {
            await fs.access(destination);
            throw new Error('同名文件已存在');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        await fs.rename(file, destination);
    }
    allowed.delete(file);
    allowed.add(destination);
    const stat = await fs.stat(destination);
    return {
        name: path.basename(destination),
        path: destination,
        url: `preview://image/${encodeURIComponent(destination)}?v=${randomUUID()}`,
        size: stat.size,
        modified: stat.mtimeMs,
    };
});
ipcMain.handle('fullscreen', () => {
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
});
app.on('window-all-closed', () => app.quit());
