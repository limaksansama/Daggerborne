const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self';"
  );
  next();
});

for (const dir of ['css', 'js', 'data', 'assets', 'public']) {
  app.use(`/${dir}`, express.static(path.join(__dirname, dir), { dotfiles: 'ignore' }));
}

const ROOT_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/manifest.webmanifest': 'manifest.webmanifest',
  '/sw.js': 'sw.js',
};

app.get(Object.keys(ROOT_FILES), (req, res) => {
  const file = ROOT_FILES[req.path];
  if (!file) return res.status(404).end();
  if (file === 'manifest.webmanifest') res.type('application/manifest+json');
  if (file === 'sw.js') res.type('application/javascript');
  return res.sendFile(path.join(__dirname, file));
});

app.use((req, res) => {
  /* Repli SPA réservé aux navigations HTML : une URL inconnue demandée par
     fetch() (en-tête Accept générique) ne reçoit plus index.html. */
  const wantsHtml = req.method === 'GET'
    && !path.extname(req.path)
    && (req.get('accept') || '').includes('text/html');
  if (wantsHtml) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  return res.status(404).end();
});

app.listen(PORT, HOST, () => {
  console.log(`Daggerborne listening on http://${HOST}:${PORT}`);
});
