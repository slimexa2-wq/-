import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'package.json',
  'capacitor.config.ts',
  'scripts/sync-upstream.mjs',
  'scripts/patch-mobile.mjs',
  'mobile/bootstrap.js',
  'mobile/ipad.css'
];

for (const relative of required) {
  await access(path.join(root, relative));
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (packageJson.dependencies?.['@capacitor/core'] !== '8.4.1') {
  throw new Error('Unexpected Capacitor Core version');
}

console.log('Project scaffold checks passed');
