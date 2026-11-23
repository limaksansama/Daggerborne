/* Service worker — cache-first PWA for Daggerborne */
const VERSION = 'daggerborne-v63';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/sheet2.css', './css/dice-box.css', './js/app.js', './js/core.js',
  './js/dice3d.js', './js/fab.js', './js/gmRules.js', './js/rules.js', './js/feat-parse.js', './js/en-ui.js', './js/i18n-dom.js',
  './js/vendor/dice-box.es.min.js', './js/vendor/world.offscreen.min.js',
  './js/vendor/world.onscreen.min.js', './js/vendor/world.none.min.js',
  './js/views/home.js', './js/views/chars.js', './js/views/create.js', './js/views/sheet.js',
  './js/views/levelup.js',
  './js/views/dice.js', './js/views/compendium.js', './js/views/gm.js', './js/views/settings.js',
  './data/domains.json', './data/classes.json', './data/subclasses.json', './data/ancestries.json',
  './data/communities.json', './data/domainCards.json', './data/weapons.json', './data/armors.json',
  './data/adversaries.json', './data/generalItems.json', './data/environments.json', './data/transformations.json',
  './data/beastforms.json',
  './data/en/domains.json', './data/en/classes.json', './data/en/subclasses.json', './data/en/ancestries.json',
  './data/en/communities.json', './data/en/domainCards.json', './data/en/weapons.json', './data/en/armors.json',
  './data/en/adversaries.json', './data/en/generalItems.json', './data/en/environments.json', './data/en/transformations.json',
  './data/en/beastforms.json', './js/i18n.js',
  './assets/fonts/Cinzel-VariableFont_wght.ttf', './assets/fonts/cinzel-decorative-bold-latin.woff2',
  './assets/fonts/overpass-regular-latin.woff2', './assets/fonts/overpass-regular-latin-ext.woff2',
  './assets/fonts/overpass-italic-latin.woff2',
  './assets/icons/favicon-64.png',
  './assets/icons/icon-64.png', './assets/icons/icon-96.png', './assets/icons/icon-128.png',
  './assets/icons/icon-192.png', './assets/icons/icon-256.png', './assets/icons/icon-384.png', './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png', './assets/icons/maskable-512.png',
  './assets/icons/domain-card/arcana.png', './assets/icons/domain-card/blade.png',
  './assets/icons/domain-card/bone.png', './assets/icons/domain-card/codex.png',
  './assets/icons/domain-card/dread.png', './assets/icons/domain-card/grace.png',
  './assets/icons/domain-card/midnight.png', './assets/icons/domain-card/sage.png',
  './assets/icons/domain-card/splendor.png', './assets/icons/domain-card/valor.png',
  /* logo communautaire officiel DPCGL (fiole d'alchimie) — requis hors-ligne */
  './public/assets/dpcgl-community-logo.png',
  './public/assets/dpcgl-community-logo-light.png',
  /* ---- moteur de dés 3D : physique WASM + thèmes résine calligraphiés (v40) ---- */
  './assets/dice-box/ammo/ammo.wasm.wasm',
  './assets/dice-box/themes/nebula-gold-v2/theme.config.json', './assets/dice-box/themes/nebula-gold-v2/default.json',
  './assets/dice-box/themes/nebula-gold-v2/diffuse-light.png', './assets/dice-box/themes/nebula-gold-v2/specular.jpg',
  './assets/dice-box/themes/hope-v2/theme.config.json', './assets/dice-box/themes/hope-v2/default.json',
  './assets/dice-box/themes/hope-v2/diffuse-light.png', './assets/dice-box/themes/hope-v2/specular.jpg',
  './assets/dice-box/themes/fear-v2/theme.config.json', './assets/dice-box/themes/fear-v2/default.json',
  './assets/dice-box/themes/fear-v2/diffuse-light.png', './assets/dice-box/themes/fear-v2/specular.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const results = await Promise.allSettled(CORE.map(u => cache.add(u)));
    const failed = CORE.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) {
      /* Précache atomique : une installation partielle donne une PWA « installée »
         mais cassée hors-ligne. On annule et on journalise les URL fautives. */
      await caches.delete(VERSION);
      console.error(`[sw] précache incomplet (${failed.length}/${CORE.length}) — installation annulée :`, failed);
      throw new Error(`Service worker : ${failed.length} ressource(s) non précachée(s)`);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    /* Navigations : réseau d'abord, pour qu'un déploiement soit visible au
       rechargement (le cache-first servait indéfiniment l'ancien index.html),
       avec repli sur le cache en hors-ligne. */
    if (e.request.mode === 'navigate') {
      try {
        const r = await fetch(e.request);
        if (r.ok) cache.put('./index.html', r.clone());
        return r;
      } catch (err) {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
        throw err;
      }
    }
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
      if (e.request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
