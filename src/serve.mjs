#!/usr/bin/env node
// Local dev server: builds, serves dist/, rebuilds on change, reloads the browser.
// No dependencies: Node 18+ only.  Run with `npm run dev`.

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { dirname, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const BUILD = resolve(ROOT, 'src/build.mjs');
const WATCHED = ['content', 'src', 'public'];
let port = Number(process.env.PORT) || 8080;
const portArg = process.argv.indexOf('--port');
if (portArg > -1) port = Number(process.argv[portArg + 1]);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

/* ---------- build ---------- */

const build = () =>
  new Promise((done) => {
    execFile(process.execPath, [BUILD], { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) {
        console.error('\x1b[31m✗ build failed\x1b[0m\n' + (stderr || err.message));
        done(false);
      } else {
        process.stdout.write(stdout);
        done(true);
      }
    });
  });

/* ---------- live reload ---------- */

const clients = new Set();
const RELOAD_SNIPPET = `<script>
(function () {
  var s = new EventSource('/__reload');
  s.onmessage = function () { location.reload(); };
  s.onerror = function () { setTimeout(function () { location.reload(); }, 1500); };
})();
</script>
</body>`;

/* ---------- server ---------- */

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let file = resolve(DIST, '.' + normalize(url));
  if (!file.startsWith(DIST)) return end(res, 403, 'Forbidden');
  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
  } catch {
    // fall through to the 404 below
  }

  try {
    let body = await readFile(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    if (type.startsWith('text/html')) body = String(body).replace('</body>', RELOAD_SNIPPET);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    end(res, 404, `404 — ${url} is not in dist/`);
  }
});

const end = (res, code, msg) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg);
};

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`port ${port} is taken, trying ${port + 1}…`);
    server.listen(++port);
  } else throw e;
});

/* ---------- watch ---------- */

let timer = null;
const onChange = (dir) => (_event, name) => {
  if (!name || name.startsWith('.')) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    console.log(`\n↻ ${dir}/${name} changed`);
    if (await build()) {
      for (const c of clients) c.write('data: reload\n\n');
      console.log(`  reloaded ${clients.size} browser tab(s)`);
    }
  }, 120);
};

await build();
server.listen(port, () => {
  console.log(`
  \x1b[36m▸ site\x1b[0m   http://localhost:${port}
  \x1b[36m▸ cv\x1b[0m     http://localhost:${port}/cv.html
  \x1b[2mwatching ${WATCHED.join(', ')} — edit content/profile.json and the page reloads itself
  press ctrl-c to stop\x1b[0m
`);
  for (const d of WATCHED) {
    try {
      watch(resolve(ROOT, d), { recursive: true }, onChange(d));
    } catch {
      console.log(`  (could not watch ${d}/)`);
    }
  }
});
