/* FAB lanceur de dés flottant — bouton circulaire (d12 doré + d12 indigo),
   bouton Historique, menu vertical déployable : Dualité rapide, dés individuels
   (accumulateur multi-dés avec badge compteur), LANCER ! et vider la sélection. */
import { $, $$, el, esc, getState, toast } from './core.js';
import { rollDuality, rollDice, isRolling } from './dice3d.js';

import { t, getLang } from './i18n.js';
/* icônes SVG : d12 stylisé (pentagone) + horloge */
const D12 = (fill, stroke) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
  <polygon points="12,1.8 21,8.3 17.6,18.6 6.4,18.6 3,8.3" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
  <text x="12" y="14.8" text-anchor="middle" font-size="8.5" font-weight="800" fill="#fff" font-family="inherit">12</text>
</svg>`;
const D12_SM = (fill, num) => `<svg viewBox="0 0 24 24" aria-hidden="true">
  <polygon points="12,1.8 21,8.3 17.6,18.6 6.4,18.6 3,8.3" fill="${fill}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
  <text x="12" y="15" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15" font-family="inherit">${num}</text>
</svg>`;
const CLOCK = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`;

const DICE = [20, 12, 10, 8, 6, 4];
let sel = {};   /* { faces: qty } */

let root = null;
let currentRoute = 'home';
let dockCollapsed = false;

const DOCK_CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
const DOCK_EXPAND = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`;

function applyFabState() {
  if (!root) return;
  root.classList.toggle('on-dice', currentRoute === 'dice');
  root.classList.toggle('on-create', currentRoute === 'create');
  root.classList.toggle('collapsed', dockCollapsed);
  const tbtn = $('#d3d-dock-toggle', root);
  if (tbtn) {
    tbtn.setAttribute('aria-expanded', String(!dockCollapsed));
    tbtn.innerHTML = dockCollapsed
      ? `${DOCK_EXPAND}<span class="d3d-dock-mini" aria-hidden="true">🎲</span>`
      : DOCK_CHEVRON_RIGHT;
  }
}

export function setFabRoute(path) {
  currentRoute = path || 'home';
  if (!root) return;
  $('#d3d-menu', root)?.classList.remove('open');
  $('#d3d-hist', root)?.classList.remove('open');
  applyFabState();
}

export function initFab() {
  if (root) return;
  try { dockCollapsed = localStorage.getItem('dh-fab-collapsed') === '1'; } catch (e) { /* noop */ }
  root = el(`<div class="d3d-fab-wrap">
    <button type="button" class="d3d-dock-toggle" id="d3d-dock-toggle" title="${esc(t('fabToggleDock'))}" aria-label="${esc(t('fabToggleDock'))}" aria-expanded="${!dockCollapsed}"></button>
    <button type="button" class="d3d-fab-hist" id="d3d-hist-btn" title="${t('fabHistoryTitle')}">${CLOCK}</button>
    <div class="d3d-fab-dice-slot" style="position:relative">
      <div class="d3d-menu" id="d3d-menu">
        <button class="d3d-quick" id="d3d-quick">
          ${D12('#f59e0b', 'rgba(255,255,255,.5)')}${D12('#2e1065', 'rgba(255,255,255,.5)')}
          <span>${t('fab2d12')}</span>
        </button>
        <div class="d3d-dice-row">
          ${DICE.map(d => `<button class="d3d-dbtn" data-d3d-die="${d}" title="${t('fabAddDie')} d${d}">${D12_SM('#312e81', d)}<span>d${d}</span><span class="cnt"></span></button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="d3d-clear" id="d3d-clear" title="${t('fabClearSel')}" style="display:none">× ${t('fabClear')}</button>
          <button class="d3d-launch" id="d3d-launch" style="flex:1;display:none">${t('diceLaunch')} !</button>
        </div>
      </div>
      <button class="d3d-fab" id="d3d-fab-btn" title="${t('fabLauncher')}" aria-label="${t('fabLauncher')}">
        ${D12('#f59e0b', 'rgba(250,204,21,.9)')}${D12('#2e1065', 'rgba(147,197,253,.5)')}
      </button>
    </div>
    <div class="d3d-hist-list" id="d3d-hist"></div>
  </div>`);
  document.body.appendChild(root);

  const menu = $('#d3d-menu', root);
  const hist = $('#d3d-hist', root);
  const launch = $('#d3d-launch', root);
  const clearBtn = $('#d3d-clear', root);

  const closeAll = () => { menu.classList.remove('open'); hist.classList.remove('open'); };
  const refreshSel = () => {
    const total = Object.values(sel).reduce((a, b) => a + b, 0);
    $$('[data-d3d-die]', root).forEach(b => {
      const n = sel[+b.dataset.d3dDie] || 0;
      b.classList.toggle('sel', n > 0);
      const cnt = b.querySelector('.cnt');
      if (cnt) cnt.textContent = n > 1 ? n : '';
    });
    launch.style.display = total ? 'block' : 'none';
    clearBtn.style.display = total ? 'block' : 'none';
    if (total) launch.textContent = `${t('diceLaunch')} ${total} ${total > 1 ? t('fabDiceMany') : t('fabDiceOne')} !`;
  };

  $('#d3d-dock-toggle', root).addEventListener('click', () => {
    dockCollapsed = !dockCollapsed;
    if (dockCollapsed) closeAll();
    try { localStorage.setItem('dh-fab-collapsed', dockCollapsed ? '1' : '0'); } catch (e) { /* noop */ }
    applyFabState();
  });

  $('#d3d-fab-btn', root).addEventListener('click', () => {
    const wasOpen = menu.classList.contains('open');
    closeAll();
    if (!wasOpen) menu.classList.add('open');
  });
  $('#d3d-quick', root).addEventListener('click', async () => {
    if (isRolling()) return;
    closeAll();
    await rollDuality({ mod: 0, label: 'Dualité' });
  });
  $$('[data-d3d-die]', root).forEach(b => b.addEventListener('click', () => {
    const total = Object.values(sel).reduce((a, b) => a + b, 0);
    if (total >= 12) { toast(t('fabMax12')); return; }
    const d = +b.dataset.d3dDie;
    sel[d] = (sel[d] || 0) + 1;
    refreshSel();
  }));
  clearBtn.addEventListener('click', () => { sel = {}; refreshSel(); });
  launch.addEventListener('click', async () => {
    if (isRolling()) return;
    const notation = Object.entries(sel).filter(([, q]) => q > 0).map(([d, q]) => `${q}d${d}`).join(' + ');
    if (!notation) return;
    sel = {}; refreshSel(); closeAll();
    await rollDice(notation, { label: 'Sélection' });
  });
  $('#d3d-hist-btn', root).addEventListener('click', () => {
    const wasOpen = hist.classList.contains('open');
    closeAll();
    if (wasOpen) return;
    const rolls = getState().rolls.slice(0, 25);
    hist.innerHTML = rolls.length ? rolls.map(r => {
      const time = new Date(r.t).toLocaleTimeString(getLang() === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (r.hope != null) {
        const w = r.result === 'crit' ? t('fabCrit') : r.result === 'hope' ? t('fabHistHope') : t('fabHistFear');
        return `<div class="d3d-hist-item">${esc(time)} · <span class="h">${esc(r.hope)}</span>/<span class="f">${esc(r.fear)}</span>${r.mod ? ` ${r.mod >= 0 ? '+' : ''}${esc(r.mod)}` : ''} = <b>${esc(r.total)}</b> ${esc(w)} · ${esc(r.label || '')}</div>`;
      }
      return `<div class="d3d-hist-item">${esc(time)} · ${esc(r.label || r.notation || '')} = <b>${esc(r.total)}</b></div>`;
    }).join('') : `<div class="d3d-hist-item" style="color:#9a93b8">${t('fabNoRolls')}</div>`;
    hist.classList.add('open');
  });

  /* fermer au tap extérieur */
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) closeAll();
  });
  refreshSel();
  applyFabState();
}

/* Reconstruit le FAB avec la langue courante (le libellé 2d12 est ensuite
   mémorisé par la couche i18n : le reconstruire évite de le figer en EN). */
export function refreshFab() {
  if (root) { root.remove(); root = null; }
  initFab();
}
