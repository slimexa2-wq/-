import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'www');
const indexPath = path.join(webDir, 'index.html');

let html = await readFile(indexPath, 'utf8');
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">';
if (html.includes('name="viewport"')) {
  html = html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, viewport);
} else {
  html = html.replace('<head>', `<head>\n  ${viewport}`);
}

const styleTag = '<link rel="stylesheet" href="./mineradio-ipad.css">';
const scriptTag = '<' + 'script src="./mineradio-ipad-bootstrap.js"></' + 'script>';
if (!html.includes('mineradio-ipad.css')) {
  html = html.replace('</head>', `  ${styleTag}\n  ${scriptTag}\n</head>`);
}

await cp(path.join(root, 'mobile', 'ipad.css'), path.join(webDir, 'mineradio-ipad.css'));
await cp(path.join(root, 'mobile', 'bootstrap.js'), path.join(webDir, 'mineradio-ipad-bootstrap.js'));
await writeFile(indexPath, html, 'utf8');
console.log('[mobile] injected iPad viewport, styles and API bridge');
