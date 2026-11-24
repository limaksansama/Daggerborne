/* App bootstrap: router + shell + service worker + IndexedDB hydration */
import { $, $$, esc, go, parseHash, registerRoute, T, initStorage, toast } from './core.js';
import { getLang, setLang } from './i18n.js';
import { initUiTranslation } from './i18n-dom.js';
import * as home from './views/home.js';
import * as chars from './views/chars.js';
import * as create from './views/create.js';
import * as sheet from './views/sheet.js';
import * as dice from './views/dice.js';
import * as compendium from './views/compendium.js';
import * as gm from './views/gm.js';
import * as settings from './views/settings.js';
import { initFab, refreshFab, setFabRoute } from './fab.js';

registerRoute('home', home.render);
registerRoute('chars', chars.render);
registerRoute('create', create.render);
registerRoute('sheet', sheet.render);
registerRoute('dice', dice.render);
registerRoute('compendium', compendium.render);
registerRoute('gm', gm.render);
registerRoute('settings', settings.render);

const NAV_ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  chars: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"/></svg>',
  compendium: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2V5z"/><path d="M8 7h7M8 11h7"/></svg>',
  gm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z"/></svg>',
};
const NAV_PATHS = ['home', 'chars', 'dice', 'compendium', 'gm', 'settings'];
const NAV_LABELS = () => ({ home: T.pageHome, chars: T.pageChars, dice: T.pageDice, compendium: T.pageCompendium, gm: T.pageGM, settings: T.pageSettings });

function buildShell() {
  const app = $('#app');
  const labels = NAV_LABELS();
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <img src="assets/dpcgl-community-logo-light.png" alt="Daggerborne — Daggerheart Compatible">
        <span class="brand-copy">
          <span class="t">Daggerborne<span class="brand-badge" title="${getLang() === 'en' ? 'Daggerheart™ Compatible' : 'Compatible avec Daggerheart™'}">${getLang() === 'en' ? 'Daggerheart™ Compatible' : 'Compatible avec Daggerheart™'}</span></span>
          <span class="brand-ver" title="Version 0.7.0-beta">v.0.7.0-beta</span>
        </span>
      </div>
      <span class="page-title" id="top-title"></span>
      <button class="lang-btn" id="top-lang" title="Français / English" aria-label="Switch language">
        <span class="lang-opt ${getLang() === 'fr' ? 'on' : ''}" data-l="fr">FR</span>
        <span class="lang-sep"></span>
        <span class="lang-opt ${getLang() === 'en' ? 'on' : ''}" data-l="en">EN</span>
      </button>
      <button class="icon-btn" id="top-dice" title="${getLang() === 'en' ? 'Duality Dice' : 'Dés de Dualité'}">
        <svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"/></svg>
      </button>
    </header>
    <main id="main"></main>
    <nav class="bottomnav" id="nav">
      ${NAV_PATHS.map(p => `<button data-nav="${p}">${NAV_ICONS[p]}<span>${labels[p]}</span></button>`).join('')}
    </nav>`;
  $$('[data-nav]', app).forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  $('#top-dice', app).addEventListener('click', () => go('dice'));
  $('#top-lang', app).addEventListener('click', (e) => {
    const opt = e.target.closest('[data-l]');
    if (!opt) return;
    const l = opt.dataset.l;
    if (l !== getLang()) switchLanguage(l);
  });
}

/* Bascule de langue : persiste, reconstruit le shell et re-rend la vue courante */
function switchLanguage(l) {
  setLang(l);
  document.documentElement.lang = l;
  buildShell();
  initUiTranslation();
  refreshFab();
  route();
  toast(l === 'en' ? 'English interface — SRD content' : 'Interface française — contenu du SRD');
}

/* La page Réglages bascule la langue via cet événement : le shell (nav, titre)
   doit être reconstruit, pas seulement le contenu de la page. */
window.addEventListener('dh:langchange', (e) => {
  const l = e.detail?.lang;
  if (l === 'fr' || l === 'en') switchLanguage(l);
});

const TITLES = () => ({ home: '', chars: T.pageChars, create: getLang() === 'en' ? 'Creation' : 'Création', sheet: getLang() === 'en' ? 'Sheet' : 'Fiche', dice: T.pageDice, compendium: T.pageCompendium, gm: T.pageGM, settings: T.pageSettings });
const routes = { home: home.render, chars: chars.render, create: create.render, sheet: sheet.render, dice: dice.render, compendium: compendium.render, gm: gm.render, settings: settings.render };

let lastRouteKey = null;

async function route() {
  /* ferme d'éventuelles modales orphelines lors d'une navigation directe */
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const { path, param } = parseHash();
  const nextKey = `${path}:${param || ''}`;
  if (lastRouteKey !== null && lastRouteKey !== nextKey) window.scrollTo?.(0, 0);
  lastRouteKey = nextKey;
  if (document.body?.dataset) document.body.dataset.route = path;
  setFabRoute(path);
  const main = $('#main');
  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === path));
  const titles = TITLES();
  $('#top-title').textContent = titles[path] || '';
  try {
    await (routes[path])(main, param);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="view"><div class="empty"><div class="e-title">${getLang() === 'en' ? 'Error' : 'Erreur'}</div><div class="e-sub">${esc(String(err.message || err))}</div></div></div>`;
  }
}

buildShell();
initUiTranslation();
initFab(); /* lanceur de dés flottant (d12 Espoir/Peur) */
document.documentElement.lang = getLang();
window.addEventListener('hashchange', route);

(async () => {
  await initStorage();
  await route();
  document.getElementById('splash')?.classList.add('hide');
})();

setTimeout(() => document.getElementById('splash')?.classList.add('hide'), 900);

// PWA
if ('serviceWorker' in navigator) {
  /* Si un nouveau service worker prend le contrôle, on recharge une seule fois
     pour que le CSS/JS mis à jour soit réellement affiché. */
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.update?.().catch(() => {});
    if (reg.waiting && navigator.serviceWorker.controller) {
      reg.waiting.postMessage('SKIP_WAITING');
      return;
    }
    const promptReload = (worker) => {
      if (!worker) return;
      const msg = getLang() === 'en'
        ? 'Update available — tap here to reload'
        : 'Mise à jour disponible — cliquez pour actualiser';
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'toast';
      node.style.cursor = 'pointer';
      node.textContent = msg;
      node.addEventListener('click', () => {
        node.remove();
        worker.postMessage('SKIP_WAITING');
      });
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 8000);
    };
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          promptReload(nw);
        }
      });
    });
  }).catch(() => {});
}
