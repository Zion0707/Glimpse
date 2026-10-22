const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

(async () => {
    const fixtureDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'glimpse-test-'),
    );
    for (const name of ['landscape.svg', 'portrait.svg'])
        await fs.copyFile(
            path.join(__dirname, 'fixtures', name),
            path.join(fixtureDir, name),
        );
    const app = await electron.launch({
        args: [
            path.join(__dirname, '..'),
            path.join(fixtureDir, 'landscape.svg'),
        ],
    });
    try {
        const page = await app.firstWindow();
        assert.equal(await page.locator('.brand, .filmstrip').count(), 0);
        await page.waitForFunction(
            () =>
                document.getElementById('dimensions').textContent ===
                '1200 × 800',
        );
        assert.equal(await page.locator('.file-row').count(), 2);
        await page.locator('.file-open').first().focus();
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(
            () =>
                document.getElementById('filename').textContent ===
                'portrait.svg',
        );
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(
            () =>
                document.getElementById('filename').textContent ===
                'landscape.svg',
        );
        await page.locator('#sort').click();
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(
            () =>
                document.getElementById('filename').textContent ===
                'portrait.svg',
        );
        await page.locator('#sort').click();
        await page.locator('.file-open').first().click();
        await page.locator('#image-fullscreen').click();
        await page.waitForFunction(
            () => document.fullscreenElement?.id === 'canvas',
        );
        await page.waitForFunction(
            () =>
                document.getElementById('canvas').clientWidth === innerWidth &&
                document.getElementById('canvas').clientHeight === innerHeight,
        );
        const viewport = await page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
        }));
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        const toolbar = page.locator('.floating-toolbar');
        const exitFullscreen = page.locator('#exit-image-fullscreen');
        await page.waitForFunction(
            () =>
                getComputedStyle(document.querySelector('.floating-toolbar'))
                    .opacity === '0',
        );
        assert.equal(
            await exitFullscreen.evaluate((el) => getComputedStyle(el).opacity),
            '0',
        );
        assert.equal(await page.locator('#main-image').isVisible(), true);
        await fs.mkdir(path.join(__dirname, '../artifacts'), {
            recursive: true,
        });
        await page.screenshot({
            path: path.join(__dirname, '../artifacts/image-fullscreen.png'),
        });
        await page.mouse.move(viewport.width / 2, viewport.height - 10);
        await page.waitForFunction(
            () =>
                getComputedStyle(document.querySelector('.floating-toolbar'))
                    .opacity === '1',
        );
        await page.locator('#actual').click();
        await page.locator('#zoom-in').click();
        assert.equal(await page.locator('#zoom-level').textContent(), '120%');
        await page.locator('#rotate').click();
        assert.match(
            await page.locator('#main-image').getAttribute('style'),
            /rotate\(90deg\)/,
        );
        await page.locator('#flip').click();
        assert.match(
            await page.locator('#main-image').getAttribute('style'),
            /scale\(-1.2,\s*1.2\)/,
        );
        await page.locator('#fit').click();
        await page.screenshot({
            path: path.join(__dirname, '../artifacts/fullscreen-toolbar.png'),
        });
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        await page.waitForFunction(
            () =>
                getComputedStyle(document.querySelector('.floating-toolbar'))
                    .opacity === '0',
        );
        await page.mouse.move(viewport.width / 2, 10);
        await page.waitForFunction(
            () =>
                getComputedStyle(
                    document.getElementById('exit-image-fullscreen'),
                ).opacity === '1',
        );
        await page.screenshot({
            path: path.join(__dirname, '../artifacts/fullscreen-close.png'),
        });
        await exitFullscreen.click();
        await page.waitForFunction(() => !document.fullscreenElement);
        assert.equal(await toolbar.isVisible(), true);
        assert.equal(await exitFullscreen.isVisible(), false);
        await page.locator('#image-fullscreen').click();
        await page.waitForFunction(
            () => document.fullscreenElement?.id === 'canvas',
        );
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.fullscreenElement);
        assert.equal(await page.locator('.floating-toolbar').isVisible(), true);
        await page.locator('.file-open').first().click();
        await page.locator('#actual').click();
        assert.equal(await page.locator('#zoom-level').textContent(), '100%');
        await page.locator('#zoom-in').click();
        assert.equal(await page.locator('#zoom-level').textContent(), '120%');
        await page.locator('#rotate').click();
        assert.match(
            await page.locator('#main-image').getAttribute('style'),
            /rotate\(90deg\)/,
        );
        await page.locator('#flip').click();
        assert.match(
            await page.locator('#main-image').getAttribute('style'),
            /scale\(-1.2,\s*1.2\)/,
        );
        await page.locator('#next').click();
        await page.waitForFunction(
            () =>
                document.getElementById('filename').textContent ===
                    'portrait.svg' &&
                document.getElementById('dimensions').textContent ===
                    '600 × 900',
        );
        await page.locator('#search').fill('landscape');
        assert.equal(await page.locator('.file-row').count(), 1);
        await page.locator('#search').fill('missing');
        assert.equal(await page.locator('.file-row').count(), 0);
        await page.locator('#search').fill('');
        const sidebar = page.locator('.sidebar');
        const initialWidth = (await sidebar.boundingBox()).width;
        const handle = await page.locator('#sidebar-resizer').boundingBox();
        await page.mouse.move(handle.x + 2, handle.y + 100);
        await page.mouse.down();
        await page.mouse.move(handle.x + 82, handle.y + 100);
        await page.mouse.up();
        assert.ok((await sidebar.boundingBox()).width > initialWidth + 60);
        assert.equal(
            await sidebar.evaluate((el) => el.getBoundingClientRect().top),
            0,
        );
        assert.equal(
            await page
                .locator('footer')
                .evaluate((el) => getComputedStyle(el).fontSize),
            '11px',
        );
        await fs.mkdir(path.join(__dirname, '../docs'), { recursive: true });
        await page.screenshot({
            path: path.join(__dirname, '../docs/ui-preview.png'),
        });
        await fs.mkdir(path.join(__dirname, '../artifacts'), {
            recursive: true,
        });
        await page.screenshot({
            path: path.join(__dirname, '../artifacts/viewer.png'),
        });
        await page.setViewportSize({ width: 900, height: 620 });
        assert.equal(
            await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
        );
        await page.screenshot({
            path: path.join(__dirname, '../artifacts/viewer-compact.png'),
        });
        await app.evaluate(({ shell }) => {
            global.realTrash = shell.trashItem;
            shell.trashItem = async () => {
                throw new Error('test failure');
            };
        });
        await page.locator('.file-row').first().hover();
        await page.locator('.file-delete').first().click();
        await page.waitForFunction(() =>
            document.getElementById('toast').textContent.includes('删除失败'),
        );
        assert.equal(await page.locator('.file-row').count(), 2);
        await app.evaluate(({ shell }) => {
            shell.trashItem = global.realTrash;
        });
        await page.locator('.file-row.selected').hover();
        await page.locator('.file-row.selected .file-delete').click();
        await page.waitForFunction(
            () => document.getElementById('count').textContent === '1',
        );
        assert.equal(
            await fs.stat(path.join(fixtureDir, 'portrait.svg')).then(
                () => true,
                () => false,
            ),
            false,
        );
        await page.waitForFunction(
            () =>
                document.getElementById('filename').textContent ===
                'landscape.svg',
        );
        await page.locator('.file-row').hover();
        await page.locator('.file-delete').click();
        await page.waitForFunction(
            () => document.getElementById('count').textContent === '0',
        );
        assert.equal(await page.locator('#welcome').isVisible(), true);
        await fs.copyFile(
            path.join(__dirname, 'fixtures/portrait.svg'),
            path.join(fixtureDir, 'portrait.svg'),
        );
        await page.waitForFunction(
            () => document.getElementById('count').textContent === '1',
        );
        assert.equal(
            await page.locator('.file-row .name').textContent(),
            'portrait.svg',
        );
        await page.waitForFunction(
            () =>
                document.getElementById('dimensions').textContent ===
                '600 × 900',
        );
        await page.locator('#search').fill('portrait');
        await page.locator('#actual').click();
        await page.locator('#rotate').click();
        await fs.copyFile(
            path.join(__dirname, 'fixtures/landscape.svg'),
            path.join(fixtureDir, 'landscape.svg'),
        );
        await page.waitForFunction(
            () => document.getElementById('count').textContent === '2',
        );
        assert.equal(await page.locator('#search').inputValue(), 'portrait');
        assert.equal(await page.locator('.file-row').count(), 1);
        assert.equal(
            await page.locator('#filename').textContent(),
            'portrait.svg',
        );
        assert.match(
            await page.locator('#main-image').getAttribute('style'),
            /rotate\(90deg\)/,
        );
        assert.equal(await page.locator('#zoom-level').textContent(), '100%');
        await page.locator('#refresh').click();
        await page.waitForFunction(
            () => !document.getElementById('refresh').disabled,
        );
        assert.equal(await page.locator('#search').inputValue(), 'portrait');
        console.log(
            'PASS: automatic folder refresh, manual refresh, selection/search/transform preservation, keyboard navigation and image fullscreen',
        );
        console.log(
            'PASS: real Electron image loading, directory browsing, zoom, rotate, flip, search and compact layout',
        );
        await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].close(),
        );
        await page.locator('#close-dialog').waitFor({ state: 'visible' });
        await page.screenshot({
            path: path.join(__dirname, '../artifacts/close-dialog.png'),
            animations: 'disabled',
        });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#close-dialog').isVisible(), false);
        assert.equal(
            await app.evaluate(({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()[0].isVisible(),
            ),
            true,
        );
        await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].close(),
        );
        await page.locator('#close-tray').click();
        await page.waitForTimeout(150);
        assert.equal(
            await app.evaluate(({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()[0].isVisible(),
            ),
            false,
        );
        for (let attempt = 0; attempt < 3; attempt++) {
            await app.evaluate(({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()[0].close(),
            );
            await page.waitForTimeout(100);
            assert.equal(
                await app.evaluate(({ BrowserWindow }) =>
                    BrowserWindow.getAllWindows()[0].isVisible(),
                ),
                false,
            );
            assert.equal(
                await app.evaluate(({ BrowserWindow }) =>
                    BrowserWindow.getAllWindows().length,
                ),
                1,
            );
        }
        await app.evaluate(({ app }) => app.emit('second-instance', {}, []));
        assert.equal(
            await app.evaluate(({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()[0].isVisible(),
            ),
            true,
        );
        await app.evaluate(({ app }) => app.quit());
        await app.waitForEvent('close');
        console.log(
            'PASS: logo, cancel close, tray hide, repeat close without prompt, second-instance restore and direct exit',
        );
    } finally {
        await app.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
