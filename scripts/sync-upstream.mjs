import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.MINERADIO_SOURCE_DIR || path.join(root, '.upstream', 'Mineradio'));
const sourcePublic = path.join(sourceRoot, 'public');
const webDir = path.join(root, 'www');

await access(path.join(sourcePublic, 'index.html'));
await mkdir(path.dirname(webDir), { recursive: true });
await rm(webDir, { recursive: true, force: true });
await cp(sourcePublic, webDir, { recursive: true });

const packageJson = JSON.parse(await readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
const metadata = {
  repository: 'XxHuberrr/Mineradio',
  sourceRoot,
  upstreamVersion: packageJson.version || null,
  syncedAt: new Date().toISOString()
};
await writeFile(path.join(webDir, 'mineradio-upstream.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
console.log(`[upstream] synced Mineradio ${metadata.upstreamVersion ?? 'unknown'} to www/`);
