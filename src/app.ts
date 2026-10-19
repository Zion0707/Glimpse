type ElementFor<K extends string> = K extends 'search'
    ? HTMLInputElement
    : K extends 'main-image'
      ? HTMLImageElement
      : K extends
              | 'sort'
              | 'prev'
              | 'next'
              | 'zoom-out'
              | 'zoom-in'
              | 'zoom-level'
              | 'fit'
              | 'actual'
              | 'rotate'
              | 'flip'
              | 'image-fullscreen'
        ? HTMLButtonElement
        : HTMLElement;
const $ = <K extends string>(id: K) =>
    document.getElementById(id)! as ElementFor<K>;
const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
const paths = {
    folder: 'M3 7V5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v12H3Z',
    image: 'M4 3h16v18H4Z M4 16l5-5 4 4 3-3 4 4 M15 8h.01',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    sort: 'M8 4v16l-4-4 M8 20l4-4 M15 5h6 M15 10h4 M15 15h2',
    info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    expand: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5',
    left: 'M15 6l-6 6 6 6',
    right: 'M9 6l6 6-6 6',
    fit: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8Z',
    rotate: 'M3 9a9 9 0 1 1 0 6 M3 3v6h6',
    flip: 'M12 2v20 M8 5L2 19h6Z M16 5l6 14h-6Z',
    sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
};
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[el.dataset.icon as keyof typeof paths] || paths.image}"/></svg>`;
});
let files: ImageFile[] = [],
    index = -1,
    scale = 1,
    rotation = 0,
    flipped = false,
    pan = { x: 0, y: 0 },
    mode = 'fit',
    reversed = false,
    background = 0;
let drag: { x: number; y: number } | null = null;
let toastTimer: ReturnType<typeof setTimeout>;
const img = $('main-image'),
    canvas = $('canvas');
function bytes(n: number) {
    return n < 1024
        ? `${n} B`
        : n < 1048576
          ? `${(n / 1024).toFixed(1)} KB`
          : `${(n / 1048576).toFixed(2)} MB`;
}
function toast(message: string) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('toast').hidden = true), 3000);
}
async function open(folder = false) {
    try {
        if (!window.viewer) {
            toast('请通过 Electron 启动应用以打开本地图片');
            return;
        }
        const data = await window.viewer.open(folder);
        if (data) load(data);
    } catch (e) {
        toast(`无法打开：${errorMessage(e)}`);
    }
}
function load(data: ImageCollection) {
    files = data.files;
    index = -1;
    $('search').value = '';
    $('folder-name').textContent =
        data.folder.split(/[\\/]/).filter(Boolean).pop() || data.folder;
    $('folder-name').title = data.folder;
    $('count').textContent = String(files.length);
    $('library-size').textContent =
        `${files.length} 张图片 · ${bytes(files.reduce((s, f) => s + f.size, 0))}`;
    renderList();
    if (files.length) select(data.selected);
    else {
        img.hidden = true;
        img.removeAttribute('src');
        $('image-error').hidden = true;
        $('filetype').textContent = 'READY';
        $('welcome').hidden = false;
        $('filename').textContent = '图片预览';
        ['dimensions', 'filesize', 'format', 'modified'].forEach(
            (id) => ($(id).textContent = '—'),
        );
        $('position').textContent = '文件夹中没有支持的图片';
        $('status').textContent = '没有图片';
        controls();
        toast('文件夹中没有支持的图片');
    }
}
function renderList() {
    const list = $('file-list');
    list.replaceChildren();
    const entries = files
        .map((f, i) => ({ f, i }))
        .filter(({ f }) =>
            f.name.toLowerCase().includes($('search').value.toLowerCase()),
        );
    if (reversed) entries.reverse();
    for (const { f, i } of entries) {
        const row = document.createElement('div');
        row.className = `file-row${i === index ? ' selected' : ''}`;
        row.dataset.index = String(i);
        const button = document.createElement('button');
        button.className = 'file-open';
        button.title = f.name;
        const thumbnail = document.createElement('img');
        thumbnail.src = f.url;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        const text = document.createElement('span');
        text.className = 'file-text';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = f.name;
        const size = document.createElement('span');
        size.className = 'size';
        size.textContent = bytes(f.size);
        text.append(name, size);
        button.append(thumbnail, text);
        button.onclick = () => select(i);
        const remove = document.createElement('button');
        remove.className = 'file-delete';
        remove.title = '移至回收站';
        remove.setAttribute('aria-label', `将 ${f.name} 移至回收站`);
        remove.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"/></svg>';
        remove.onclick = () => trash(f, remove);
        row.append(button, remove);
        list.append(row);
    }
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-library';
        empty.textContent = files.length
            ? '没有匹配的图片'
            : '打开图片，开始浏览';
        list.append(empty);
    }
}

function controls() {
    (
        [
            'zoom-out',
            'zoom-in',
            'zoom-level',
            'fit',
            'actual',
            'rotate',
            'flip',
            'image-fullscreen',
        ] as const
    ).forEach((id) => ($(id).disabled = index < 0));
    $('prev').disabled = index <= 0;
    $('next').disabled = index < 0 || index >= files.length - 1;
}
function select(i: number) {
    if (i < 0 || i >= files.length) return;
    index = i;
    rotation = 0;
    flipped = false;
    mode = 'fit';
    pan = { x: 0, y: 0 };
    img.hidden = true;
    $('image-error').hidden = true;
    $('welcome').hidden = true;
    const f = files[i];
    $('filename').textContent = f.name;
    $('filetype').textContent = f.name.split('.').pop()!.toUpperCase();
    $('format').textContent = $('filetype').textContent;
    $('filesize').textContent = bytes(f.size);
    $('modified').textContent = new Date(f.modified).toLocaleDateString(
        'zh-CN',
    );
    $('dimensions').textContent = '加载中';
    $('position').textContent = `${i + 1} / ${files.length}`;
    $('status').textContent = f.name;
    document.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
        el.classList.toggle('selected', Number(el.dataset.index) === i);
        if (Number(el.dataset.index) === i)
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    img.src = f.url;
    controls();
}
function fit() {
    if (!img.naturalWidth || index < 0) return;
    const odd = rotation % 180 !== 0;
    const w = odd ? img.naturalHeight : img.naturalWidth,
        h = odd ? img.naturalWidth : img.naturalHeight;
    scale = Math.min(
        (canvas.clientWidth -
            (document.fullscreenElement === canvas ? 0 : 110)) /
            w,
        (canvas.clientHeight -
            (document.fullscreenElement === canvas ? 0 : 170)) /
            h,
        document.fullscreenElement === canvas ? Infinity : 1,
    );
    pan = { x: 0, y: 0 };
    transform();
}
function transform() {
    img.style.width = `${img.naturalWidth}px`;
    img.style.height = `${img.naturalHeight}px`;
    img.style.transform = `translate(${pan.x}px,${pan.y}px) rotate(${rotation}deg) scale(${flipped ? -scale : scale},${scale})`;
    $('zoom-level').textContent = `${Math.round(scale * 100)}%`;
    $('fit').classList.toggle('active', mode === 'fit');
    $('actual').classList.toggle('active', mode === 'actual');
}
function zoom(factor: number) {
    if (index < 0) return;
    mode = 'custom';
    scale = Math.max(0.02, Math.min(16, scale * factor));
    transform();
}
img.onload = () => {
    img.hidden = false;
    $('dimensions').textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    fit();
};
img.onerror = () => {
    img.hidden = true;
    $('image-error').hidden = false;
    $('dimensions').textContent = '无法读取';
};
$('open-file').onclick = () => open();
$('welcome-open').onclick = () => open();
$('open-folder').onclick = () => open(true);
$('search').oninput = renderList;
$('sort').onclick = () => {
    reversed = !reversed;
    renderList();
};
$('prev').onclick = () => select(index - 1);
$('next').onclick = () => select(index + 1);
$('zoom-in').onclick = () => zoom(1.2);
$('zoom-out').onclick = () => zoom(1 / 1.2);
$('fit').onclick = $('zoom-level').onclick = () => {
    mode = 'fit';
    fit();
};
$('actual').onclick = () => {
    mode = 'actual';
    scale = 1;
    pan = { x: 0, y: 0 };
    transform();
};
$('rotate').onclick = () => {
    rotation = (rotation + 90) % 360;
    if (mode === 'fit') fit();
    else transform();
};
$('flip').onclick = () => {
    flipped = !flipped;
    transform();
};
$('background').onclick = () => {
    background = (background + 1) % 3;
    canvas.classList.toggle('light', background === 1);
    canvas.classList.toggle('checker', background === 2);
};
$('info-toggle').onclick = () => {
    $('metadata').hidden = !$('metadata').hidden;
    $('info-toggle').classList.toggle('active', !$('metadata').hidden);
};
$('fullscreen').onclick = async () => {
    if (window.viewer) await window.viewer.fullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
};
$('image-fullscreen').onclick = async () => {
    if (index < 0 || img.hidden) return;
    try {
        if (document.fullscreenElement === canvas)
            await document.exitFullscreen();
        else await canvas.requestFullscreen();
    } catch (error) {
        toast(`无法进入图片全屏：${errorMessage(error)}`);
    }
};
document.addEventListener('fullscreenchange', () => {
    $('image-fullscreen').classList.toggle(
        'active',
        document.fullscreenElement === canvas,
    );
    mode = 'fit';
    fit();
});
$('exit-image-fullscreen').onclick = async () => {
    if (document.fullscreenElement === canvas) await document.exitFullscreen();
};
canvas.addEventListener(
    'wheel',
    (e) => {
        e.preventDefault();
        zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
);
canvas.addEventListener('pointerdown', (e) => {
    if (e.target !== img) return;
    drag = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    pan = { x: e.clientX - drag.x, y: e.clientY - drag.y };
    transform();
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('pointercancel', () => (drag = null));
canvas.addEventListener('dblclick', (e) => {
    if (e.target === img) (mode === 'fit' ? $('actual') : $('fit')).click();
});
new ResizeObserver(() => {
    if (mode === 'fit') fit();
}).observe(canvas);
document.addEventListener('keydown', (e) => {
    if (closeDialog.open) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        open(e.shiftKey);
        return;
    }
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    if (key === 'escape' && document.fullscreenElement) {
        e.preventDefault();
        void document.exitFullscreen();
        return;
    }
    if (key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault();
        const visible = [
            ...document.querySelectorAll<HTMLElement>('.file-row'),
        ];
        const position = visible.findIndex(
            (row) => Number(row.dataset.index) === index,
        );
        const next =
            position < 0
                ? key === 'arrowdown'
                    ? 0
                    : visible.length - 1
                : position + (key === 'arrowdown' ? 1 : -1);
        const row = visible[next];
        if (row) {
            select(Number(row.dataset.index));
            if (
                e.target instanceof HTMLElement &&
                e.target.closest('.file-list')
            )
                row.querySelector<HTMLButtonElement>('.file-open')?.focus();
        }
        return;
    }
    const actions: Record<string, string> = {
        arrowleft: 'prev',
        arrowright: 'next',
        '+': 'zoom-in',
        '=': 'zoom-in',
        '-': 'zoom-out',
        '0': 'fit',
        '1': 'actual',
        r: 'rotate',
        h: 'flip',
        f: 'fullscreen',
    };
    if (actions[key]) {
        e.preventDefault();
        $(actions[key]).click();
    }
    if (key === '/') {
        e.preventDefault();
        $('search').focus();
    }
});
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    $('drop-overlay').hidden = false;
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
        dragDepth = 0;
        $('drop-overlay').hidden = true;
    }
});
document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    $('drop-overlay').hidden = true;
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    try {
        if (window.viewer) load(await window.viewer.drop(file));
    } catch (error) {
        toast(`无法打开：${errorMessage(error)}`);
    }
});
window.viewer?.onOpen(load);
controls();
let refreshing = false;
const refreshButton = document.createElement('button');
refreshButton.id = 'refresh';
refreshButton.className = 'icon-button';
refreshButton.title = '刷新图片列表';
refreshButton.setAttribute('aria-label', '刷新图片列表');
refreshButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths.rotate}"/></svg>`;
$('sort').before(refreshButton);
refreshButton.disabled = true;
const listActions = document.createElement('div');
listActions.className = 'list-actions';
refreshButton.before(listActions);
listActions.append(refreshButton, $('sort'));
window.viewer?.onOpen(() => {
    refreshButton.disabled = false;
});
new MutationObserver(() => {
    refreshButton.disabled = !$('folder-name').title;
}).observe($('folder-name'), { attributes: true });
let refreshPending = false;
async function refreshCollection(manual = false) {
    if (!window.viewer || !$('folder-name').title) return;
    if (deleting || refreshing) {
        refreshPending = true;
        return;
    }
    refreshing = true;
    refreshButton.disabled = true;
    refreshButton.classList.add('refreshing');
    const folder = $('folder-name').title;
    try {
        const data = await window.viewer.refresh();
        if (
            !data ||
            folder !== $('folder-name').title ||
            data.folder !== folder
        )
            return;
        const selected = files[index];
        const nextIndex = data.files.findIndex(
            (file) => file.path === selected?.path,
        );
        const unchanged =
            nextIndex >= 0 &&
            selected.modified === data.files[nextIndex].modified &&
            selected.size === data.files[nextIndex].size;
        const query = $('search').value;
        if (!data.files.length) {
            if (files.length) load(data);
        } else {
            files = data.files;
            index =
                nextIndex >= 0
                    ? nextIndex
                    : Math.max(0, Math.min(index, files.length - 1));
            if (!unchanged) select(index);
            else $('position').textContent = `${index + 1} / ${files.length}`;
        }
        $('search').value = query;
        $('count').textContent = String(files.length);
        $('library-size').textContent =
            `${files.length} 张图片 · ${bytes(files.reduce((sum, file) => sum + file.size, 0))}`;
        renderList();
        controls();
        if (manual) toast(`列表已刷新，共 ${files.length} 张图片`);
    } catch (error) {
        if (manual) toast(`刷新失败：${errorMessage(error)}`);
    } finally {
        refreshing = false;
        refreshButton.disabled = false;
        refreshButton.classList.remove('refreshing');
        if (refreshPending) {
            refreshPending = false;
            void refreshCollection();
        }
    }
}
refreshButton.onclick = () => refreshCollection(true);
window.viewer?.onFolderChanged(() => {
    void refreshCollection();
});
window.addEventListener('focus', () => {
    void refreshCollection();
});
const closeDialog = document.createElement('dialog');
closeDialog.id = 'close-dialog';
closeDialog.setAttribute('aria-labelledby', 'close-title');
closeDialog.setAttribute('aria-describedby', 'close-description');
closeDialog.innerHTML = `<div class="close-heading"><img src="assets/icon.png" alt=""><span>GLIMPSE</span><button class="icon-button" id="close-cancel-icon" aria-label="取消关闭" title="取消关闭">×</button></div><h2 id="close-title">暂时离开 Glimpse？</h2><p id="close-description">保留在托盘，下次继续浏览。也可以直接退出应用。</p><div class="close-actions"><button class="button subtle" id="close-cancel">取消</button><button class="button subtle" id="close-quit">直接退出</button><button class="button primary" id="close-tray" autofocus>最小化到托盘</button></div>`;
document.body.append(closeDialog);
let previousFocus: HTMLElement | null;
function closeChoice(choice: 'tray' | 'quit' | 'cancel') {
    closeDialog.close();
    previousFocus?.focus();
    window.viewer?.closeChoice(choice);
}
window.viewer?.onClose(() => {
    if (closeDialog.open) return;
    previousFocus =
        document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
    closeDialog.showModal();
});
$('close-cancel').onclick = $('close-cancel-icon').onclick = () =>
    closeChoice('cancel');
$('close-quit').onclick = () => closeChoice('quit');
$('close-tray').onclick = () => closeChoice('tray');
closeDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeChoice('cancel');
});
let deleting = false;
async function trash(file: ImageFile, button: HTMLButtonElement) {
    if (deleting || refreshing) return;
    deleting = true;
    button.disabled = true;
    try {
        await window.viewer!.trash(file.path);
        const selectedPath = files[index]?.path;
        const removedIndex = files.findIndex((f) => f.path === file.path);
        files.splice(removedIndex, 1);
        if (!files.length) {
            index = -1;
            img.hidden = true;
            img.removeAttribute('src');
            $('image-error').hidden = true;
            $('welcome').hidden = false;
            $('filename').textContent = '图片预览';
            $('filetype').textContent = 'READY';
            ['dimensions', 'filesize', 'format', 'modified'].forEach(
                (id) => ($(id).textContent = '—'),
            );
            $('position').textContent = '';
            $('status').textContent = '准备就绪';
            controls();
        } else {
            select(
                selectedPath === file.path
                    ? Math.min(removedIndex, files.length - 1)
                    : files.findIndex((f) => f.path === selectedPath),
            );
        }
        $('count').textContent = String(files.length);
        $('library-size').textContent =
            `${files.length} 张图片 · ${bytes(files.reduce((s, f) => s + f.size, 0))}`;
        renderList();
        toast('已移至回收站');
    } catch (error) {
        toast(`删除失败：${errorMessage(error)}`);
    } finally {
        deleting = false;
        button.disabled = false;
        if (refreshPending) {
            refreshPending = false;
            void refreshCollection();
        }
    }
}
const resizer = $('sidebar-resizer');
let resizing = false;
function resizeSidebar(width: number) {
    const max = Math.min(420, window.innerWidth - 520);
    const value = Math.round(Math.max(180, Math.min(max, width)));
    document.documentElement.style.setProperty('--sidebar-width', `${value}px`);
    resizer.setAttribute('aria-valuenow', String(value));
}
resizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    resizing = true;
    resizer.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
});
resizer.addEventListener('pointermove', (e) => {
    if (resizing) resizeSidebar(e.clientX);
});
function stopResize() {
    resizing = false;
    document.body.classList.remove('resizing');
}
resizer.addEventListener('pointerup', stopResize);
resizer.addEventListener('pointercancel', stopResize);
resizer.addEventListener('lostpointercapture', stopResize);
resizer.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    resizeSidebar(
        Number(resizer.getAttribute('aria-valuenow')) +
            (e.key === 'ArrowLeft' ? -10 : 10),
    );
});
window.addEventListener('resize', () =>
    resizeSidebar(Number(resizer.getAttribute('aria-valuenow'))),
);
