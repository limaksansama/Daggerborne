import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForReady(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch { /* retrying */ }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Server failed to start in time');
}

test('server.js serves allowlisted web assets with security headers and blocks source/config disclosure', async () => {
  const port = await getFreePort();
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    const rootRes = await waitForReady(`${base}/`);
    assert.equal(rootRes.status, 200);
    assert.equal(rootRes.headers.get('x-powered-by'), null);
    assert.equal(rootRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(rootRes.headers.get('referrer-policy'), 'no-referrer');
    assert.ok(rootRes.headers.get('content-security-policy')?.includes("script-src 'self' 'wasm-unsafe-eval'"));

    for (const allowed of ['/js/app.js', '/css/app.css', '/data/classes.json', '/manifest.webmanifest', '/sw.js']) {
      const r = await fetch(`${base}${allowed}`);
      assert.equal(r.status, 200, `Expected 200 for ${allowed}`);
    }

    for (const blocked of ['/server.js', '/package.json', '/bun.lock', '/capacitor.config.json', '/tests/app.test.js', '/scripts/lint.mjs', '/.git/HEAD']) {
      const r = await fetch(`${base}${blocked}`);
      assert.equal(r.status, 404, `Expected 404 for ${blocked}`);
    }
  } finally {
    proc.kill('SIGTERM');
  }
});
