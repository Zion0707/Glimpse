import { build } from 'esbuild';
import less from 'less';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
    await mkdir('dist/src', { recursive: true });
    await Promise.all([
        build({
            entryPoints: ['electron/main.cts', 'electron/preload.cts'],
            outdir: 'dist/electron',
            outExtension: { '.js': '.cjs' },
            platform: 'node',
            format: 'cjs',
            target: 'node22',
            bundle: true,
            external: ['electron'],
        }),
        build({
            entryPoints: ['src/app.ts'],
            outfile: 'dist/src/app.js',
            platform: 'browser',
            target: 'chrome140',
            bundle: true,
        }),
        cp('src/index.html', 'dist/src/index.html'),
        cp('src/assets', 'dist/src/assets', { recursive: true }),
    ]);
    const filename = path.resolve('src/style.less');
    const result = await less.render(await readFile(filename, 'utf8'), {
        filename,
    });
    await writeFile('dist/src/style.css', result.css);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
