/* App bootstrap: router + shell + service worker */
import { $, $$, el, go, parseHash, registerRoute, T } from './core.js';
import * as home from './views/home.js';
import * as chars from './views/chars.js';
import * as create from './views/create.js';
import * as sheet from './views/sheet.js';
import * as dice from './views/dice.js';
import * as compendium from './views/compendium.js';
import * as gm from './views/gm.js';
import * as settings from './views/settings.js';
import { initFab } from './fab.js';

registerRoute('home', home.render);
registerRoute('chars', chars.render);
registerRoute('create', create.render);
registerRoute('sheet', sheet.render);
registerRoute('dice', dice.render);
registerRoute('compendium', compendium.render);
registerRoute('gm', gm.render);
registerRoute('settings', settings.render);

const NAV = [
  { path: 'home', label: T.pageHome, icon: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>' },
  { path: 'chars', label: T.pageChars, icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>' },
  { path: 'dice', label: T.pageDice, icon: '<svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"/></svg>' },
  { path: 'compendium', label: T.pageCompendium, icon: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2V5z"/><path d="M8 7h7M8 11h7"/></svg>' },
  { path: 'gm', label: T.pageGM, icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>' },
  { path: 'settings', label: T.pageSettings, icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z"/></svg>' },
];

function buildShell() {
  const app = $('#app');
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <img src="assets/icons/icon-192.png" alt="">
        <span class="t">Daggervault<span class="brand-badge" title="Compatible avec Daggerheart™">Compatible avec Daggerheart™</span></span>
      </div>
      <span class="page-title" id="top-title"></span>
      <button class="icon-btn" id="top-dice" title="Dés de Dualité">
        <svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"/></svg>
      </button>
    </header>
    <main id="main"></main>
    <nav class="bottomnav" id="nav">
      ${NAV.map(n => `<button data-nav="${n.path}">${n.icon}<span>${n.label}</span></button>`).join('')}
    </nav>`;
  $$('[data-nav]', app).forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  $('#top-dice', app).addEventListener('click', () => go('dice'));
}

const TITLES = { home: '', chars: T.pageChars, create: 'Création', sheet: 'Fiche', dice: T.pageDice, compendium: T.pageCompendium, gm: T.pageGM, settings: T.pageSettings };

async function route() {
  const { path, param } = parseHash();
  const main = $('#main');
  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === path));
  $('#top-title').textContent = TITLES[path] || '';
  try {
    await (routes[path])(main, param);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="view"><div class="empty"><div class="e-title">Erreur</div><div class="e-sub">${String(err.message || err)}</div></div></div>`;
  }
}
const routes = { home: home.render, chars: chars.render, create: create.render, sheet: sheet.render, dice: dice.render, compendium: compendium.render, gm: gm.render, settings: settings.render };

buildShell();
initFab(); /* lanceur de dés flottant (d12 Espoir/Peur) */
window.addEventListener('hashchange', route);
route();

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash');
  setTimeout(() => splash?.classList.add('hide'), 400);
});
document.addEventListener('DOMContentLoaded', () => {});
// hide splash once first route rendered
setTimeout(() => document.getElementById('splash')?.classList.add('hide'), 700);
