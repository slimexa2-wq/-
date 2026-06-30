'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const upstreamDir = path.resolve(process.argv[2] || path.join(process.cwd(), '.upstream', 'Mineradio'));
const port = String(process.argv[3] || process.env.PORT || '3000');
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || process.cwd(), 'AppData', 'Roaming');
const dataDir = path.resolve(process.env.MINERADIO_COMPANION_DATA || path.join(appData, 'Mineradio'));
const cookieFile = path.join(dataDir, '.cookie');
const qqCookieFile = path.join(dataDir, '.qq-cookie');
const serverPath = path.join(upstreamDir, 'server.js');

fs.mkdirSync(dataDir, { recursive: true });
for (const file of [cookieFile, qqCookieFile]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '', 'utf8');
}
if (!fs.existsSync(serverPath)) {
  console.error(`[companion] missing upstream server: ${serverPath}`);
  process.exit(1);
}

let child = null;
let restartTimer = null;
let stopping = false;

function start() {
  if (stopping) return;
  child = spawn(process.execPath, [serverPath], {
    cwd: upstreamDir,
    env: {
      ...process.env,
      HOST: '0.0.0.0',
      PORT: port,
      COOKIE_FILE: cookieFile,
      QQ_COOKIE_FILE: qqCookieFile,
      MINERADIO_UPDATE_REPOSITORY: ''
    },
    stdio: 'inherit',
    windowsHide: false
  });
  child.on('exit', (code, signal) => {
    child = null;
    if (!stopping && code !== 0) {
      console.error(`[companion] backend stopped (${signal || code}); restarting in 2 seconds`);
      setTimeout(start, 2000);
    }
  });
}

function restart(reason) {
  if (stopping) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log(`[companion] ${reason}; reloading account session`);
    if (child) {
      child.once('exit', () => start());
      child.kill();
    } else {
      start();
    }
  }, 700);
}

for (const file of [cookieFile, qqCookieFile]) {
  fs.watchFile(file, { interval: 1000 }, (current, previous) => {
    if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) {
      restart(path.basename(file) + ' changed');
    }
  });
}

function shutdown() {
  stopping = true;
  clearTimeout(restartTimer);
  for (const file of [cookieFile, qqCookieFile]) fs.unwatchFile(file);
  if (child) child.kill();
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`[companion] data: ${dataDir}`);
console.log(`[companion] backend: http://0.0.0.0:${port}`);
start();
