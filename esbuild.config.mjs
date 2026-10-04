import esbuild from 'esbuild';
import process from 'process';
import { builtinModules } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const isProduction = process.argv[2] === 'production';

// Build styles.css with the Material Icons font inlined, since plugins may not load remote stylesheets.
const font = readFileSync('node_modules/material-icons/iconfont/material-icons.woff2').toString('base64');
writeFileSync(
    'styles.css',
    readFileSync('styles.src.css', 'utf8').replace('__MATERIAL_ICONS_WOFF2__', `data:font/woff2;base64,${font}`),
);

const context = await esbuild.context({
    entryPoints: ['main.ts'],
    bundle: true,
    external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
        ...builtinModules,
    ],
    format: 'cjs',
    target: 'es2018',
    logLevel: 'info',
    sourcemap: isProduction ? false : 'inline',
    treeShaking: true,
    outfile: 'main.js',
});

if (isProduction) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
