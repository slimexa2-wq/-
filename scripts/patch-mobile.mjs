import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'www');
const indexPath = path.join(webDir, 'index.html');

let html = await readFile(indexPath, 'utf8');
await cp(path.join(root, 'mobile', 'ipad.css'), path.join(webDir, 'mineradio-ipad.css'));
await cp(path.join(root, 'mobile', 'bootstrap.js'), path.join(webDir, 'mineradio-ipad-bootstrap.js'));
await writeFile(indexPath, html, 'utf8');
console.log('[mobile] copied iPad assets');
