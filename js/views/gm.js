/* Outils du MJ : pool de Peur, comptes à rebours, tracker d'affrontement actif,
   référence complète des règles SRD 2.0, bestiaire (statblocks complets) et environnements */
import { $, $$, el, esc, go, T, data, toast, uid, getState, setState } from '../core.js';
import {
  RULES_CONDITIONS, RULES_REST, RULES_ENCOUNTER, RULES_MULTICLASS,
  RULES_THRESHOLDS, RULES_DEATH, RULES_TEAMWORK, RULES_HAZARDS, RULES_CAMPAIGN_FRAMES,
} from '../gmRules.js';
import { ADVERSARY_POINT_COST, calcEncounterBudget, calcEncounterSpent, formatAtkBonus } from '../rules.js';
import { rollDice } from '../dice3d.js';

import { t } from '../i18n.js';
let gmUi = { tab: 'fear', tier: null, type: null, q: '', envTier: null, envQ: '' };
const openEncDetails = new Set();
let gmSeq = 0;

const TYPES = ['bruiser', 'horde', 'leader', 'minion', 'ranged', 'skulk', 'social', 'solo', 'standard', 'support'];
const TYPE_LABELS = {
  bruiser: 'Bagarreur', horde: 'Horde', leader: 'Chef', minion: 'Sbire',
  ranged: 'À distance', skulk: 'Rôdeur', social: 'Social', solo: 'Solo', standard: 'Standard', support: 'Soutien',
};
const ADV_CONDS = ['Vulnérable', 'Entravé', 'Caché', 'Empoisonné'];

export async function render(main, params) {
  const seq = ++gmSeq;
  main.classList.add('wide');
  const st = getState();

  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Outils du MJ</h1>
    <p class="page-sub">Pool de Peur, comptes à rebours, tracker d'affrontement, bestiaire SRD 2.0, environnements et référence rapide des règles.</p>

    <div class="filter-row" id="gm-tabs" style="margin:.8rem 0">
      ${[
        ['fear', '⏳ Pool & comptes à rebours'],
        ['encounter', `⚔ Affrontement${st.encounter?.active?.length ? ` (${st.encounter.active.length})` : ''}`],
        ['bestiary', '💀 Bestiaire'],
        ['environments', '🌳 Environnements'],
        ['rules', '📜 Règles'],
      ].map(([id, label]) => `<button class="filter-chip ${gmUi.tab === id ? 'active' : ''}" data-gmtab="${id}">${label}</button>`).join('')}
    </div>
    <div id="gm-body"></div>
  </div>`;

  $$('#gm-tabs [data-gmtab]', main).forEach(b => b.addEventListener('click', () => {
    gmUi.tab = b.dataset.gmtab;
    render(main);
  }));

  const body = $('#gm-body', main);
  if (gmUi.tab === 'fear') await drawFear(body, main, st);
  else if (gmUi.tab === 'encounter') await drawEncounter(body, main, st, seq);
  else if (gmUi.tab === 'bestiary') await drawBestiary(body, main, seq);
  else if (gmUi.tab === 'environments') await drawEnvironments(body, main, seq);
  else if (gmUi.tab === 'rules') await drawRules(body, main);
}

/* ---------- Pool de Peur & comptes à rebours ---------- */
async function drawFear(main, root, st) {
  main.innerHTML = `
    <div class="section-title" style="margin-top:0">Pool de Peur</div>
    <div class="card">
      <div class="fear-pool" id="fear-pool"></div>
      <div style="display:flex;gap:.5rem;margin-top:.9rem;flex-wrap:wrap">
        <button class="btn ghost small" id="fear-add">＋ Peur</button>
        <button class="btn ghost small" id="fear-rem">− Peur</button>
        <button class="btn ghost small" id="fear-reset">${t('gmReset')}</button>
      </div>
      <p class="ch-desc" style="margin-top:.7rem;font-size:.78rem">Les jets avec Peur des joueurs vous donnent une Peur (max recommandé 12). Dépensez-la pour mettre en avant un adversaire (1 Peur) ou déclencher un acte de Peur.</p>
    </div>

    <div class="section-title">${t('gmCountdowns')}</div>
    <div id="cds"></div>
    <div class="card">
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <input type="text" id="cd-new" placeholder="Nom (ex. : Le portail s'ouvre…)" style="flex:1;min-width:180px;background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem .7rem">
        <select id="cd-max" style="background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem">
          ${[3, 4, 5, 6, 8, 10, 12].map(n => `<option>${n}</option>`).join('')}
        </select>
        <button class="btn small" id="cd-add">Ajouter</button>
      </div>
    </div>

    <div class="section-title">${t('gmGmActs')}</div>
    <div class="card">
      <p class="ch-desc"><b style="color:var(--golden)">${t('gmSpotlight')}</b> — un adversaire agit immédiatement après la mise en avant d'un PJ.</p>
      <p class="ch-desc" style="margin-top:.4rem"><b style="color:var(--golden)">Acte de Peur (1+ Peur)</b> — le MJ déclenche une feature de Peur d'un adversaire ou d'un environnement.</p>
      <p class="ch-desc" style="margin-top:.4rem"><b style="color:var(--golden)">${t('gmStandardAct')}</b> — n'importe quel adversaire agit une fois lorsque les projecteurs passent au MJ.</p>
    </div>`;

  const pool = $('#fear-pool', main);
  const HEX = 'M18 1.5 L34.9 11.25 L34.9 30.75 L18 40.5 L1.1 30.75 L1.1 11.25 Z';
  const HEX_IN = 'M18 9.3 L28.1 15.15 L28.1 26.85 L18 32.7 L7.9 26.85 L7.9 15.15 Z';
  const drawFearPips = () => {
    /* gradient partagé par tous les pips (défini une fois, référencé via url(#fg-hex)) */
    let html = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="fg-hex" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b8b1ff"/><stop offset="1" stop-color="#7b71e6"/>
      </linearGradient></defs></svg>`;
    for (let i = 0; i < Math.max(st.fear, 12); i++) {
      const on = i < st.fear;
      html += `<button type="button" class="fear-pip ${on ? 'on' : ''}" data-fear="${i}"
        aria-label="${on ? `Retirer la Peur ${i + 1}` : `Définir la Peur à ${i + 1}`}">
        <svg viewBox="0 0 36 42" focusable="false">
          <path class="hex-body" d="${HEX}"/>
          <path class="hex-inner" d="${HEX_IN}"/>
        </svg></button>`;
    }
    pool.innerHTML = html;
    $$('.fear-pip', pool).forEach(p => p.addEventListener('click', () => {
      const i = +p.dataset.fear;
      setState(s => { s.fear = (i < s.fear) ? i : i + 1; });
      drawFearPips();
    }));
  };
  drawFearPips();
  $('#fear-add', main).addEventListener('click', () => { setState(s => { s.fear = Math.min(30, s.fear + 1); }); drawFearPips(); });
  $('#fear-rem', main).addEventListener('click', () => { setState(s => { s.fear = Math.max(0, s.fear - 1); }); drawFearPips(); });
  $('#fear-reset', main).addEventListener('click', () => { setState(s => { s.fear = 0; }); drawFearPips(); });

  const cds = $('#cds', main);
  const drawCds = () => {
    cds.innerHTML = '';
    if (!st.countdowns.length) {
      cds.innerHTML = '<div class="empty" style="margin:0 0 .8rem"><div class="e-title">' + t('gmNoCountdown') + '</div><div class="e-sub">' + t('gmTrackEvents') + '</div></div>';
    }
    for (const cd of st.countdowns) {
      const box = el(`<div class="card" style="margin-bottom:.6rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
          <span class="li-name">${esc(cd.name)} <span class="tag">${cd.value}/${cd.max}</span></span>
          <button class="icon-btn" style="width:30px;height:30px" data-cd-del="${cd.id}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="pip-track">
          ${Array.from({ length: cd.max }, (_, i) => `<span class="pip ${i < cd.value ? 'on stress' : ''}" data-cd="${cd.id}" data-i="${i}"></span>`).join('')}
        </div>
      </div>`);
      cds.appendChild(box);
    }
    $$('.pip[data-cd]', cds).forEach(p => p.addEventListener('click', () => {
      const cd = st.countdowns.find(x => x.id === p.dataset.cd);
      const i = +p.dataset.i;
      cd.value = (i < cd.value) ? i : i + 1;
      if (cd.value >= cd.max) toast(`⏳ Compte à rebours terminé : « ${cd.name} » !`);
      setState(() => {});
      drawCds();
    }));
    $$('[data-cd-del]', cds).forEach(b => b.addEventListener('click', () => {
      setState(s => { s.countdowns = s.countdowns.filter(x => x.id !== b.dataset.cdDel); });
      drawCds();
    }));
  };
  drawCds();

  $('#cd-add', main).addEventListener('click', () => {
    const name = $('#cd-new', main).value.trim();
    if (!name) { toast(t('gmNameCd')); return; }
    const max = +$('#cd-max', main).value;
    setState(s => { s.countdowns.push({ id: uid(), name, max, value: 0 }); });
    $('#cd-new', main).value = '';
    drawCds();
  });
}

/* ---------- Tracker d'Affrontement & Calculateur de Points de Combat ---------- */
async function drawEncounter(body, main, st, seq = gmSeq) {
  const [adversaries, environments] = await Promise.all([data('adversaries'), data('environments')]);
  if (seq !== gmSeq || !body.isConnected) return;
  st.encounter = st.encounter || { pcCount: 4, adj: {}, active: [], environmentId: null };
  const enc = st.encounter;
  const pcCount = enc.pcCount || 4;
  const adj = enc.adj || {};
  const budget = calcEncounterBudget(pcCount, adj);
  const spent = calcEncounterSpent(enc.active, pcCount);
  const activeEnv = enc.environmentId ? environments.find(e => e.id === enc.environmentId) : null;

  body.innerHTML = `
    <div class="section-title" style="margin-top:0">${t('gmCombatBudget')}</div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.7rem;margin-bottom:.7rem">
        <div style="display:flex;align-items:center;gap:.5rem">
          <span class="li-name">Joueurs (PJ) :</span>
          <button class="btn ghost small" id="enc-pc-dec">−</button>
          <b style="color:var(--golden);font-size:1.1rem;min-width:1.6rem;text-align:center">${pcCount}</b>
          <button class="btn ghost small" id="enc-pc-inc">+</button>
        </div>
        <div class="tag" style="font-size:.85rem;padding:.35rem .7rem;${spent > budget ? 'border-color:#d46868;color:#ffb4b4' : ''}">
          Dépensés : <b>${spent}</b> / <b>${budget}</b> pts
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.45rem;font-size:.76rem">
        ${[
          ['easier', '−1 Combat plus court/facile'],
          ['twoSolos', '−2 ≥2 adversaires Solo'],
          ['extraDmg', '−2 Dégâts adversaires +1d4/+2'],
          ['lowerTier', '+1 Adversaire palier inférieur'],
          ['noHeavy', '+1 Aucun Bagarreur/Horde/Chef/Solo'],
          ['harder', '+2 Combat plus long/difficile'],
        ].map(([k, lbl]) => `
          <label class="filter-chip ${adj[k] ? 'active' : ''}" style="cursor:pointer;display:inline-flex;align-items:center;gap:.35rem">
            <input type="checkbox" data-enc-adj="${k}" ${adj[k] ? 'checked' : ''} style="accent-color:var(--golden)"> ${lbl}
          </label>`).join('')}
      </div>
    </div>

    <div class="section-title">${t('gmActiveEnv')}</div>
    <div class="card">
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        <select id="enc-env-sel" style="flex:1;min-width:200px;background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem .7rem">
          <option value="">${t('gmNoEnv')}</option>
          ${environments.slice().sort((a, b) => a.tier - b.tier || (a.fr || a.en).localeCompare(b.fr || b.en, 'fr')).map(e =>
            `<option value="${esc(e.id)}" ${enc.environmentId === e.id ? 'selected' : ''}>P${e.tier} · ${esc(e.fr || e.en)}${e.difficulty ? ` (Diff ${e.difficulty})` : ''}</option>`
          ).join('')}
        </select>
        ${activeEnv ? `<button class="btn ghost small" id="enc-env-clear">Retirer</button>` : ''}
      </div>
      ${activeEnv ? `
        <div style="margin-top:.7rem;padding-top:.7rem;border-top:1px solid var(--border)">
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            <b style="color:var(--golden)">${esc(activeEnv.fr || activeEnv.en)}</b>
            <span class="tag">${esc(activeEnv.category)}</span>
            <span class="tag">${T.tiers[activeEnv.tier]}</span>
            ${activeEnv.difficulty ? `<span class="tag">Diff. ${activeEnv.difficulty}</span>` : ''}
          </div>
          <p class="ch-desc" style="margin-top:.35rem">${esc(activeEnv.descFr || activeEnv.desc)}</p>
          ${activeEnv.impulsesFr || activeEnv.impulses ? `<p class="ch-desc" style="margin-top:.3rem"><b style="color:var(--golden)">Impulsions :</b> ${esc(activeEnv.impulsesFr || activeEnv.impulses)}</p>` : ''}
          <details style="margin-top:.45rem"><summary style="cursor:pointer;font-size:.8rem;color:var(--golden)">Aptitudes de l'environnement (${activeEnv.features.length})</summary>
            <div style="margin-top:.45rem">${activeEnv.features.map(f => `<p class="ch-desc" style="margin-bottom:.4rem"><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}</div>
          </details>
        </div>` : ''}
    </div>

    <div class="section-title">Adversaires en jeu (${enc.active.length})</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem">
      <button class="btn small" id="enc-pick-adv">＋ Ajouter depuis le Bestiaire</button>
      <button class="btn ghost small" id="enc-add-custom">✎ Adversaire rapide</button>
      ${enc.active.length ? '<button class="btn danger small" id="enc-clear">Vider la scène</button>' : ''}
    </div>
    <div id="enc-list"></div>`;

  const listEl = $('#enc-list', body);
  if (!enc.active.length) {
    listEl.innerHTML = '<div class="empty"><div class="e-title">Scène vide</div><div class="e-sub">Ajoutez des adversaires depuis le Bestiaire (ou ci-dessus) pour suivre leurs PV, Stress, états et lancer leurs jets d\'attaque/dégâts en 1 clic.</div></div>';
  } else {
    for (const inst of enc.active) {
      const def = inst.advId ? adversaries.find(a => a.id === inst.advId) : null;
      const defeated = inst.hpMax > 0 && inst.hpMarked >= inst.hpMax;
      const cost = ADVERSARY_POINT_COST[inst.type] ?? 2;
      const atkHasDice = inst.atkDamage && /\d*d\d+/i.test(String(inst.atkDamage));
      const atkBadge = inst.atkDamage
        ? (atkHasDice
            ? `<button class="btn ghost small" data-enc-dmg="${inst.uid}" title="Lancer les dégâts (${inst.atkDamage})">🎲 ${esc(inst.atkDamage)}</button>`
            : `<span class="tag" style="align-self:center">⚔ ${esc(inst.atkDamage)} (fixe)</span>`)
        : '';
      const atkFmt = formatAtkBonus(inst.atkBonus);
      const card = el(`<div class="card" style="margin-bottom:.75rem;${defeated ? 'opacity:.62;border-color:rgba(212,104,104,.4)' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;flex-wrap:wrap">
          <div>
            <span class="li-name">${esc(inst.name)}</span>
            <span class="tag">${TYPE_LABELS[inst.type] || inst.type} (${inst.type === 'minion' ? `1 pt / groupe de ${pcCount}` : `${cost} pt${cost > 1 ? 's' : ''}`})</span>
            ${defeated ? '<span class="tag" style="background:rgba(166,46,60,.3);border-color:#d46868;color:#ffb4b4">' + t('gmDefeated') + '</span>' : ''}
            <div class="ms-meta" style="margin-top:.2rem">Diff ${inst.difficulty ?? '—'} · Seuils ${inst.major ?? '—'}/${inst.severe ?? '—'}${atkFmt ? ` · ATQ ${esc(atkFmt)}` : ''}</div>
          </div>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap">
            ${atkFmt ? `<button class="btn small" data-enc-atk="${inst.uid}" title="${t('gmAtkRoll20')}">⚔ ATQ ${esc(atkFmt)}</button>` : ''}
            ${atkBadge}
            <button class="icon-btn" style="width:32px;height:32px" data-enc-del="${inst.uid}" title="Retirer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.6rem;margin-top:.65rem">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-dim);margin-bottom:.25rem">
              <span>PV marqués : <b style="color:var(--golden)">${inst.hpMarked}</b> / ${inst.hpMax}</span>
              <span><button class="btn ghost small" style="padding:1px 7px" data-enc-hp="${inst.uid}:-1">−</button> <button class="btn ghost small" style="padding:1px 7px" data-enc-hp="${inst.uid}:1">+</button></span>
            </div>
            <div class="pip-track">${Array.from({ length: Math.min(20, Math.max(1, inst.hpMax)) }, (_, i) => `<span class="pip ${i < inst.hpMarked ? 'on' : ''}" data-enc-hppip="${inst.uid}:${i}"></span>`).join('')}</div>
          </div>
          ${inst.stressMax > 0 ? `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-dim);margin-bottom:.25rem">
              <span>Stress : <b style="color:var(--golden)">${inst.stressMarked}</b> / ${inst.stressMax}</span>
              <span><button class="btn ghost small" style="padding:1px 7px" data-enc-st="${inst.uid}:-1">−</button> <button class="btn ghost small" style="padding:1px 7px" data-enc-st="${inst.uid}:1">+</button></span>
            </div>
            <div class="pip-track">${Array.from({ length: Math.min(12, inst.stressMax) }, (_, i) => `<span class="pip ${i < inst.stressMarked ? 'on stress' : ''}" data-enc-stpip="${inst.uid}:${i}"></span>`).join('')}</div>
          </div>` : ''}
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem">
          ${ADV_CONDS.map(cond => {
            const on = (inst.conditions || []).includes(cond);
            return `<button class="filter-chip ${on ? 'active' : ''}" style="padding:.2rem .55rem;font-size:.72rem" data-enc-cond="${inst.uid}:${esc(cond)}">${cond}</button>`;
          }).join('')}
        </div>

        ${def?.features?.length ? `
          <details style="margin-top:.55rem" data-enc-det="${inst.uid}" ${openEncDetails.has(inst.uid) ? 'open' : ''}>
            <summary style="cursor:pointer;font-size:.76rem;color:var(--text-faint)">Bloc de statistiques &amp; aptitudes (${def.features.length})</summary>
            <div style="margin-top:.4rem">
              ${def.motives ? `<p class="ch-desc" style="font-size:.78rem"><b style="color:var(--golden)">${t('gmMotives')}</b> ${esc(def.motives)}</p>` : ''}
              ${def.features.map(f => `<p class="ch-desc" style="font-size:.78rem;margin-top:.3rem"><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
            </div>
          </details>` : ''}
      </div>`);
      listEl.appendChild(card);
    }
    $$('[data-enc-det]', listEl).forEach(det => det.addEventListener('toggle', () => {
      if (det.open) openEncDetails.add(det.dataset.encDet);
      else openEncDetails.delete(det.dataset.encDet);
    }));
  }

  $('#enc-pc-dec', body).addEventListener('click', () => { setState(s => { s.encounter.pcCount = Math.max(1, (s.encounter.pcCount || 4) - 1); }); render(main); });
  $('#enc-pc-inc', body).addEventListener('click', () => { setState(s => { s.encounter.pcCount = Math.min(10, (s.encounter.pcCount || 4) + 1); }); render(main); });
  $$('[data-enc-adj]', body).forEach(cb => cb.addEventListener('change', () => {
    const k = cb.dataset.encAdj;
    setState(s => { s.encounter.adj = s.encounter.adj || {}; s.encounter.adj[k] = cb.checked; });
    render(main);
  }));
  $('#enc-env-sel', body).addEventListener('change', (e) => {
    setState(s => { s.encounter.environmentId = e.target.value || null; });
    render(main);
  });
  $('#enc-env-clear', body)?.addEventListener('click', () => {
    setState(s => { s.encounter.environmentId = null; });
    render(main);
  });
  $('#enc-pick-adv', body).addEventListener('click', () => { gmUi.tab = 'bestiary'; render(main); });
  $('#enc-add-custom', body).addEventListener('click', () => openCustomAdversaryModal(() => render(main)));
  $('#enc-clear', body)?.addEventListener('click', () => {
    if (!confirm(t('gmClearEncConfirm'))) return;
    openEncDetails.clear();
    setState(s => { s.encounter.active = []; });
    render(main);
  });

  $$('[data-enc-del]', body).forEach(b => b.addEventListener('click', () => {
    openEncDetails.delete(b.dataset.encDel);
    setState(s => { s.encounter.active = s.encounter.active.filter(x => x.uid !== b.dataset.encDel); });
    render(main);
  }));
  $$('[data-enc-hp]', body).forEach(b => b.addEventListener('click', () => {
    const [u, d] = b.dataset.encHp.split(':');
    setState(s => {
      const it = s.encounter.active.find(x => x.uid === u);
      if (it) it.hpMarked = Math.max(0, Math.min(it.hpMax, (it.hpMarked || 0) + Number(d)));
    });
    render(main);
  }));
  $$('[data-enc-hppip]', body).forEach(p => p.addEventListener('click', () => {
    const [u, idx] = p.dataset.encHppip.split(':');
    const i = +idx;
    setState(s => {
      const it = s.encounter.active.find(x => x.uid === u);
      if (it) it.hpMarked = (i < it.hpMarked) ? i : i + 1;
    });
    render(main);
  }));
  $$('[data-enc-st]', body).forEach(b => b.addEventListener('click', () => {
    const [u, d] = b.dataset.encSt.split(':');
    setState(s => {
      const it = s.encounter.active.find(x => x.uid === u);
      if (it) it.stressMarked = Math.max(0, Math.min(it.stressMax, (it.stressMarked || 0) + Number(d)));
    });
    render(main);
  }));
  $$('[data-enc-stpip]', body).forEach(p => p.addEventListener('click', () => {
    const [u, idx] = p.dataset.encStpip.split(':');
    const i = +idx;
    setState(s => {
      const it = s.encounter.active.find(x => x.uid === u);
      if (it) it.stressMarked = (i < it.stressMarked) ? i : i + 1;
    });
    render(main);
  }));
  $$('[data-enc-cond]', body).forEach(b => b.addEventListener('click', () => {
    const [u, cond] = b.dataset.encCond.split(':');
    setState(s => {
      const it = s.encounter.active.find(x => x.uid === u);
      if (!it) return;
      it.conditions = it.conditions || [];
      if (it.conditions.includes(cond)) it.conditions = it.conditions.filter(x => x !== cond);
      else it.conditions.push(cond);
    });
    render(main);
  }));
  $$('[data-enc-atk]', body).forEach(b => b.addEventListener('click', () => {
    const it = st.encounter.active.find(x => x.uid === b.dataset.encAtk);
    if (!it) return;
    const bonus = parseInt(it.atkBonus, 10) || 0;
    const note = bonus ? `1d20${bonus >= 0 ? '+' + bonus : bonus}` : '1d20';
    rollDice(note, { label: `Attaque — ${it.name}${it.atkName ? ' (' + it.atkName + ')' : ''}` });
  }));
  $$('[data-enc-dmg]', body).forEach(b => b.addEventListener('click', () => {
    const it = st.encounter.active.find(x => x.uid === b.dataset.encDmg);
    if (!it || !it.atkDamage) return;
    const m = String(it.atkDamage).match(/\d*d\d+(?:\s*[+-]\s*\d+)?/i);
    if (!m) { toast(`Notation non lançable : ${it.atkDamage}`); return; }
    rollDice(m[0].replace(/\s+/g, ''), { label: `Dégâts — ${it.name}` });
  }));
}

function addAdversaryToEncounter(a) {
  setState(s => {
    s.encounter = s.encounter || { pcCount: 4, adj: {}, active: [], environmentId: null };
    const sameCount = s.encounter.active.filter(x => x.advId === a.id).length;
    s.encounter.active.push({
      uid: uid(),
      advId: a.id,
      name: sameCount ? `${a.en} #${sameCount + 1}` : a.en,
      type: a.type || 'standard',
      tier: a.tier || 1,
      difficulty: a.difficulty ?? 12,
      hpMax: Number(a.hp) || 4,
      hpMarked: 0,
      stressMax: Number(a.stress) || 0,
      stressMarked: 0,
      major: a.major ?? null,
      severe: a.severe ?? null,
      atkBonus: a.atkBonus ?? null,
      atkName: a.atkName || '',
      atkDamage: a.atkDamage || '',
      conditions: [],
    });
  });
  toast(`⚔ « ${a.en} » ajouté à l'affrontement.`);
}

function openCustomAdversaryModal(onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  sheet.innerHTML = `
    <h3>${t('gmNewQuickAdv')}</h3>
    <div class="field"><label>Nom *</label><input type="text" id="ca-name" placeholder="Ex. : Bandit du col"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
      <div class="field"><label>Type</label>
        <select id="ca-type" style="background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.5rem;width:100%">
          ${TYPES.map(t => `<option value="${t}" ${t === 'standard' ? 'selected' : ''}>${TYPE_LABELS[t]}</option>`).join('')}
        </select></div>
      <div class="field"><label>${t('sheetDifficulty')}</label><input type="number" id="ca-diff" value="12" min="1" max="30"></div>
      <div class="field"><label>${t('gmHpMax')}</label><input type="number" id="ca-hp" value="5" min="1" max="40"></div>
      <div class="field"><label>${t('gmStressMax')}</label><input type="number" id="ca-st" value="3" min="0" max="20"></div>
      <div class="field"><label>${t('sheetThM')}</label><input type="number" id="ca-maj" value="7" min="1" max="50"></div>
      <div class="field"><label>${t('sheetTh')}</label><input type="number" id="ca-sev" value="14" min="1" max="80"></div>
      <div class="field"><label>Bonus ATQ</label><input type="number" id="ca-atk" value="2" min="-5" max="20"></div>
      <div class="field"><label>${t('gmDmgEx')}</label><input type="text" id="ca-dmg" value="1d8+2"></div>
    </div>
    <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.7rem">
      <button class="btn ghost small" id="ca-cancel">Annuler</button>
      <button class="btn small" id="ca-ok">Ajouter</button>
    </div>`;
  $('#ca-cancel', sheet).addEventListener('click', () => back.remove());
  $('#ca-ok', sheet).addEventListener('click', () => {
    const name = $('#ca-name', sheet).value.trim();
    if (!name) { toast(t('gmNeedName')); return; }
    setState(s => {
      s.encounter = s.encounter || { pcCount: 4, adj: {}, active: [], environmentId: null };
      s.encounter.active.push({
        uid: uid(), advId: null, name,
        type: $('#ca-type', sheet).value,
        difficulty: parseInt($('#ca-diff', sheet).value, 10) || 12,
        hpMax: parseInt($('#ca-hp', sheet).value, 10) || 5,
        hpMarked: 0,
        stressMax: parseInt($('#ca-st', sheet).value, 10) || 0,
        stressMarked: 0,
        major: parseInt($('#ca-maj', sheet).value, 10) || 7,
        severe: parseInt($('#ca-sev', sheet).value, 10) || 14,
        atkBonus: parseInt($('#ca-atk', sheet).value, 10) || 0,
        atkName: t('sheetAttack'),
        atkDamage: $('#ca-dmg', sheet).value.trim() || '1d8',
        conditions: [],
      });
    });
    back.remove();
    onDone();
  });
}

/* ---------- Bestiaire : statblocks complets SRD 2.0 ---------- */
async function drawBestiary(body, main, seq = gmSeq) {
  const all = (await data('adversaries')).sort((a, b) => a.en.localeCompare(b.en));
  if (seq !== gmSeq || !body.isConnected) return;

  body.innerHTML = `
    <div class="search-bar" style="margin-bottom:.6rem">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="gm-q" placeholder="Rechercher un adversaire…" value="${esc(gmUi.q)}">
    </div>
    <div class="filter-row" style="margin-bottom:.4rem">
      <button class="filter-chip ${gmUi.tier === null ? 'active' : ''}" data-btier="">${t('sheetAllTiers')}</button>
      ${[1, 2, 3, 4].map(t => `<button class="filter-chip ${gmUi.tier === t ? 'active' : ''}" data-btier="${t}">Palier ${t}</button>`).join('')}
    </div>
    <div class="filter-row" style="margin-bottom:.8rem">
      <button class="filter-chip ${gmUi.type === null ? 'active' : ''}" data-btype="">Tous types</button>
      ${TYPES.map(t => `<button class="filter-chip ${gmUi.type === t ? 'active' : ''}" data-btype="${t}">${TYPE_LABELS[t]}</button>`).join('')}
    </div>
    <p class="page-sub" id="gm-adv-count"></p>
    <div id="gm-adv-list"></div>`;

  const renderList = () => {
    const list = all
      .filter(a => (!gmUi.tier || a.tier === gmUi.tier) && (!gmUi.type || a.type === gmUi.type))
      .filter(a => !gmUi.q || (a.en + ' ' + a.desc).toLowerCase().includes(gmUi.q));
    $('#gm-adv-count', body).textContent = `${list.length} adversaire(s) — SRD 2.0 · cliquez pour déplier ou ajouter à l'affrontement`;
    const advList = $('#gm-adv-list', body);
    advList.innerHTML = '';
    for (const a of list) {
      const atkFmt = formatAtkBonus(a.atkBonus);
      const box = el(`<details class="rules-block adv-block">
        <summary><b>${esc(a.en)}</b> <span class="tag">${TYPE_LABELS[a.type] || a.type}</span> <span class="ms-meta" style="display:inline">${T.tiers[a.tier]} · Diff ${a.difficulty ?? '—'} · PV ${a.hp ?? '—'} · Stress ${a.stress ?? '—'}</span></summary>
        <div style="display:flex;gap:.5rem;margin-bottom:.55rem;flex-wrap:wrap">
          <button class="btn small" data-add-enc="${a.id}">${t('gmAddEnc')}</button>
          ${atkFmt ? `<button class="btn ghost small" data-adv-atk="${a.id}">🎲 ATQ ${esc(atkFmt)}</button>` : ''}
        </div>
        <div class="statblock">
          <div class="sb-row"><span class="sb-k">PV</span><span class="sb-v">${a.hp ?? '—'}</span><span class="sb-k">Stress</span><span class="sb-v">${a.stress ?? '—'}</span><span class="sb-k">${t('cmpThresholds')}</span><span class="sb-v">${a.major ?? '—'} / ${a.severe ?? '—'}</span>${a.horde ? `<span class="sb-k">Horde</span><span class="sb-v">${a.horde}/PV</span>` : ''}</div>
          ${a.atkName ? `<div class="sb-row"><span class="sb-k">ATQ</span><span class="sb-v">${esc(atkFmt || '—')}</span><span class="sb-k">Attaque</span><span class="sb-v">${esc(a.atkName)} (${esc(a.atkRange)})</span><span class="sb-k">Dégâts</span><span class="sb-v">${esc(a.atkDamage || '—')}</span></div>` : ''}
          ${a.experience ? `<div class="sb-row"><span class="sb-k">Expérience</span><span class="sb-v">${esc(a.experience)}</span></div>` : ''}
        </div>
        <p class="ch-desc">${esc(a.desc)}</p>
        ${a.motives ? `<p class="ch-desc"><b style="color:var(--golden)">Motivations &amp; tactiques :</b> ${esc(a.motives)}</p>` : ''}
        <div class="section-title" style="margin-top:.6rem">${t('sheetFeatures')}</div>
        ${a.features.map(f => `<p class="ch-desc" style="margin-bottom:.5rem"><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </details>`);
      advList.appendChild(box);
    }
    $$('[data-add-enc]', advList).forEach(b => b.addEventListener('click', () => {
      const a = all.find(x => x.id === b.dataset.addEnc);
      if (a) {
        addAdversaryToEncounter(a);
        const encTab = $('[data-gmtab="encounter"]', main);
        if (encTab) encTab.textContent = `⚔ Affrontement (${getState().encounter.active.length})`;
      }
    }));
    $$('[data-adv-atk]', advList).forEach(b => b.addEventListener('click', () => {
      const a = all.find(x => x.id === b.dataset.advAtk);
      if (!a) return;
      const bonus = parseInt(a.atkBonus, 10) || 0;
      rollDice(bonus ? `1d20${bonus >= 0 ? '+' + bonus : bonus}` : '1d20', { label: `Attaque — ${a.en}` });
    }));
  };
  renderList();

  $('#gm-q', body).addEventListener('input', (e) => { gmUi.q = e.target.value.toLowerCase(); renderList(); });
  $$('[data-btier]', body).forEach(b => b.addEventListener('click', () => {
    gmUi.tier = b.dataset.btier ? +b.dataset.btier : null;
    $$('[data-btier]', body).forEach(x => x.classList.toggle('active', (x.dataset.btier ? +x.dataset.btier : null) === gmUi.tier));
    renderList();
  }));
  $$('[data-btype]', body).forEach(b => b.addEventListener('click', () => {
    gmUi.type = b.dataset.btype || null;
    $$('[data-btype]', body).forEach(x => x.classList.toggle('active', (x.dataset.btype || null) === gmUi.type));
    renderList();
  }));
}

/* ---------- Environnements SRD 2.0 ---------- */
async function drawEnvironments(body, main, seq = gmSeq) {
  const all = (await data('environments')).sort((a, b) => a.tier - b.tier || (a.fr || a.en).localeCompare(b.fr || b.en, 'fr'));
  if (seq !== gmSeq || !body.isConnected) return;

  body.innerHTML = `
    <div class="search-bar" style="margin-bottom:.6rem">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="gm-env-q" placeholder="Rechercher un environnement…" value="${esc(gmUi.envQ)}">
    </div>
    <div class="filter-row" style="margin-bottom:.8rem">
      <button class="filter-chip ${gmUi.envTier === null ? 'active' : ''}" data-etier="">${t('sheetAllTiers')}</button>
      ${[1, 2, 3, 4].map(t => `<button class="filter-chip ${gmUi.envTier === t ? 'active' : ''}" data-etier="${t}">Palier ${t}</button>`).join('')}
    </div>
    <p class="page-sub" id="gm-env-count"></p>
    <div id="gm-env-list"></div>`;

  const renderList = () => {
    const list = all
      .filter(e => (!gmUi.envTier || e.tier === gmUi.envTier))
      .filter(e => !gmUi.envQ || ((e.fr || '') + ' ' + e.en + ' ' + (e.descFr || '') + ' ' + e.desc).toLowerCase().includes(gmUi.envQ));
    $('#gm-env-count', body).textContent = `${list.length} environnement(s) — SRD 2.0`;
    const envList = $('#gm-env-list', body);
    envList.innerHTML = '';
    for (const e of list) {
      const box = el(`<details class="rules-block adv-block">
        <summary><b>${esc(e.fr || e.en)}</b>${e.fr ? ` <span class="ms-meta" style="display:inline">(${esc(e.en)})</span>` : ''} <span class="tag">${esc(e.category)}</span> <span class="ms-meta" style="display:inline">${T.tiers[e.tier]}${e.difficulty ? ' · Difficulté ' + e.difficulty : ''}</span></summary>
        <div style="margin-bottom:.55rem">
          <button class="btn small" data-set-env="${e.id}">${t('gmActivateEnv')}</button>
        </div>
        <p class="ch-desc">${esc(e.descFr || e.desc)}</p>
        ${(e.impulsesFr || e.impulses) ? `<p class="ch-desc"><b style="color:var(--golden)">Impulsions :</b> ${esc(e.impulsesFr || e.impulses)}</p>` : ''}
        ${e.adversaries ? `<p class="ch-desc"><b style="color:var(--golden)">Adversaires potentiels :</b> ${esc(e.adversaries)}</p>` : ''}
        <div class="section-title" style="margin-top:.6rem">${t('sheetFeatures')}</div>
        ${e.features.map(f => `<p class="ch-desc" style="margin-bottom:.5rem"><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </details>`);
      envList.appendChild(box);
    }
    $$('[data-set-env]', envList).forEach(b => b.addEventListener('click', () => {
      const e = all.find(x => x.id === b.dataset.setEnv);
      if (!e) return;
      setState(s => { s.encounter = s.encounter || { pcCount: 4, adj: {}, active: [], environmentId: null }; s.encounter.environmentId = e.id; });
      toast(`🌳 Environnement « ${e.fr || e.en} » activé pour l'affrontement.`);
    }));
  };
  renderList();

  $('#gm-env-q', body).addEventListener('input', (e) => { gmUi.envQ = e.target.value.toLowerCase(); renderList(); });
  $$('[data-etier]', body).forEach(b => b.addEventListener('click', () => {
    gmUi.envTier = b.dataset.etier ? +b.dataset.etier : null;
    $$('[data-etier]', body).forEach(x => x.classList.toggle('active', (x.dataset.etier ? +x.dataset.etier : null) === gmUi.envTier));
    renderList();
  }));
}

/* ---------- Référence complète de règles SRD 2.0 ---------- */
async function drawRules(body, main) {
  body.innerHTML = `
    <details class="rules-block" open>
      <summary>${t('gmThresholdsArmor')}</summary>
      <div class="card"><p class="ch-desc">${esc(RULES_THRESHOLDS.desc)}</p></div>
    </details>

    <details class="rules-block">
      <summary>${t('gmDeathMoves')}</summary>
      ${RULES_DEATH.map(r => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${esc(r.name)}</b> <span class="tag">${esc(r.tag)}</span><p class="ch-desc" style="margin-top:.3rem">${esc(r.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>${t('gmTeamwork')}</summary>
      ${RULES_TEAMWORK.map(r => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${esc(r.name)}</b> <span class="tag">${esc(r.tag)}</span><p class="ch-desc" style="margin-top:.3rem">${esc(r.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>${t('gmConditions')}</summary>
      ${RULES_CONDITIONS.map(c => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${esc(c.name)}</b> <span class="tag">${esc(c.tag)}</span><p class="ch-desc" style="margin-top:.3rem">${esc(c.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>${t('gmRestDowntime')}</summary>
      ${RULES_REST.map(r => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${esc(r.name)}</b> <span class="tag">${esc(r.tag)}</span><p class="ch-desc" style="margin-top:.3rem">${esc(r.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>${t('gmDangers')}</summary>
      ${RULES_HAZARDS.map(r => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${esc(r.name)}</b> <span class="tag">${esc(r.tag)}</span><p class="ch-desc" style="margin-top:.3rem">${esc(r.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>${t('gmBalancedEnc')}</summary>
      <div class="card"><p class="ch-desc">${esc(RULES_ENCOUNTER.points)}</p>
        <ul class="rules-list">${RULES_ENCOUNTER.spend.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="ch-desc" style="margin-top:.4rem">${esc(RULES_ENCOUNTER.defeated)}</p></div>
    </details>

    <details class="rules-block">
      <summary>${t('gmMulticlass')}</summary>
      <div class="card"><p class="ch-desc">${esc(RULES_MULTICLASS.when)}</p>
        <ul class="rules-list">${RULES_MULTICLASS.what.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        <p class="ch-desc" style="margin-top:.4rem">${esc(RULES_MULTICLASS.cards)}</p></div>
    </details>

    <details class="rules-block">
      <summary>${t('gmCampaignFrames')}</summary>
      ${RULES_CAMPAIGN_FRAMES.map(r => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${esc(r.name)}</b> <span class="tag">${esc(r.tag)}</span><p class="ch-desc" style="margin-top:.3rem">${esc(r.desc)}</p></div>`).join('')}
    </details>`;
}
