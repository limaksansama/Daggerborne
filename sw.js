/* Service worker — cache-first PWA for Daggervault */
const VERSION = 'daggervault-v28';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/sheet2.css', './css/dice-box.css', './js/app.js', './js/core.js',
  './js/dice3d.js', './js/fab.js',
  './js/vendor/dice-box.es.min.js', './js/vendor/world.offscreen.min.js',
  './js/vendor/world.onscreen.min.js', './js/vendor/world.none.min.js',
  './js/views/home.js', './js/views/chars.js', './js/views/create.js', './js/views/sheet.js',
  './js/views/levelup.js',
  './js/views/dice.js', './js/views/compendium.js', './js/views/gm.js', './js/views/settings.js',
  './data/domains.json', './data/classes.json', './data/subclasses.json', './data/ancestries.json',
  './data/communities.json', './data/domainCards.json', './data/weapons.json', './data/armors.json',
  './data/adversaries.json', './data/generalItems.json',
  './assets/fonts/Cinzel-VariableFont_wght.ttf', './assets/fonts/cinzel-decorative-bold-latin.woff2',
  './assets/fonts/overpass-regular-latin.woff2', './assets/fonts/overpass-regular-latin-ext.woff2',
  './assets/fonts/overpass-italic-latin.woff2',
  './assets/icons/favicon-64.png',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/maskable-192.png', './assets/icons/maskable-512.png',
  /* logo communautaire officiel DPCGL (fiole d'alchimie) — requis hors-ligne */
  './public/assets/dpcgl-community-logo.png',
  './public/assets/dpcgl-community-logo-light.png',
  /* ---- moteur de dés 3D : physique WASM + thèmes ---- */
  './assets/dice-box/ammo/ammo.wasm.wasm',
  './assets/dice-box/themes/default/theme.config.json', './assets/dice-box/themes/default/default.json',
  './assets/dice-box/themes/default/diffuse-light.png', './assets/dice-box/themes/default/diffuse-dark.png',
  './assets/dice-box/themes/default/normal.png', './assets/dice-box/themes/default/specular.jpg',
  './assets/dice-box/themes/nebula-gold/theme.config.json', './assets/dice-box/themes/nebula-gold/default.json',
  './assets/dice-box/themes/nebula-gold/diffuse-dark.png', './assets/dice-box/themes/nebula-gold/diffuse-light.png',
  './assets/dice-box/themes/nebula-gold/normal.png', './assets/dice-box/themes/nebula-gold/specular.jpg',
  './assets/dice-box/themes/hope/theme.config.json', './assets/dice-box/themes/hope/default.json',
  './assets/dice-box/themes/hope/diffuse-dark.png', './assets/dice-box/themes/hope/diffuse-light.png',
  './assets/dice-box/themes/hope/normal.png', './assets/dice-box/themes/hope/specular.jpg',
  './assets/dice-box/themes/fear/theme.config.json', './assets/dice-box/themes/fear/default.json',
  './assets/dice-box/themes/fear/diffuse-dark.png', './assets/dice-box/themes/fear/diffuse-light.png',
  './assets/dice-box/themes/fear/normal.png', './assets/dice-box/themes/fear/specular.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(CORE.map(u => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(e.request, { ignoreSearch: true });
    if (cached) {
      // revalidate in background
      fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const r = await fetch(e.request);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch (err) {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
      throw err;
    }
  })());
});
