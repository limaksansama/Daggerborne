/* Outils du MJ : pool de Peur, comptes à rebours, référence des règles SRD 2.0,
   bestiaire (statblocks complets) et environnements */
import { $, $$, el, esc, go, T, data, toast, getState, setState } from '../core.js';
import { RULES_CONDITIONS, RULES_REST, RULES_ENCOUNTER, RULES_MULTICLASS, RULES_THRESHOLDS } from '../gmRules.js';

let gmUi = { tab: 'fear', tier: null, type: null, q: '' };

export async function render(main, params) {
  main.classList.add('wide');
  const st = getState();

  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Outils du MJ</h1>
    <p class="page-sub">Pool de Peur, comptes à rebours, bestiaire SRD 2.0, environnements et référence rapide des règles.</p>

    <div class="filter-row" id="gm-tabs" style="margin:.8rem 0">
      ${[['fear', '⏳ Pool & comptes à rebours'], ['bestiary', '💀 Bestiaire'], ['environments', '🌳 Environnements'], ['rules', '📜 Règles']]
        .map(([id, label]) => `<button class="filter-chip ${gmUi.tab === id ? 'active' : ''}" data-gmtab="${id}">${label}</button>`).join('')}
    </div>
    <div id="gm-body"></div>
  </div>`;

  $$('#gm-tabs [data-gmtab]', main).forEach(b => b.addEventListener('click', () => {
    gmUi.tab = b.dataset.gmtab; render(main);
  }));

  const body = $('#gm-body', main);
  if (gmUi.tab === 'fear') await drawFear(body, main, st);
  else if (gmUi.tab === 'bestiary') await drawBestiary(body, main);
  else if (gmUi.tab === 'environments') await drawEnvironments(body, main);
  else if (gmUi.tab === 'rules') await drawRules(body, main);
}

/* ---------- Pool de Peur & comptes à rebours ---------- */
async function drawFear(main, root, st) {
  main.innerHTML = `
    <div class="section-title" style="margin-top:0">Pool de Peur</div>
    <div class="card">
      <div class="fear-pool" id="fear-pool"></div>
      <div style="display:flex;gap:.5rem;margin-top:.9rem">
        <button class="btn ghost small" id="fear-add">＋ Peur</button>
        <button class="btn ghost small" id="fear-rem">− Peur</button>
        <button class="btn ghost small" id="fear-reset">Réinitialiser</button>
      </div>
      <p class="ch-desc" style="margin-top:.7rem;font-size:.78rem">Les jets avec Peur des joueurs vous donnent une Peur. Dépensez-la pour mettre en avant un adversaire (1 Peur) ou déclencher un acte de Peur.</p>
    </div>

    <div class="section-title">Comptes à rebours</div>
    <div id="cds"></div>
    <div class="card">
      <div style="display:flex;gap:.5rem">
        <input type="text" id="cd-new" placeholder="Nom (ex. : Le portail s'ouvre…)" style="flex:1;background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem .7rem">
        <select id="cd-max" style="background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem">
          ${[3, 4, 5, 6, 8, 10].map(n => `<option>${n}</option>`).join('')}
        </select>
        <button class="btn small" id="cd-add">Ajouter</button>
      </div>
    </div>

    <div class="section-title">Actes du MJ (dépenser la Peur)</div>
    <div class="card">
      <p class="ch-desc"><b style="color:var(--golden)">Mettre en avant (1 Peur)</b> — un adversaire agit immédiatement après la mise en avant d'un PJ.</p>
      <p class="ch-desc" style="margin-top:.4rem"><b style="color:var(--golden)">Acte de Peur (1+ Peur)</b> — le MJ fait agir un adversaire et gagne un avantage ou complique la situation pour les PJ.</p>
      <p class="ch-desc" style="margin-top:.4rem"><b style="color:var(--golden)">Acte standard</b> — n'importe quel adversaire agit une fois.</p>
    </div>`;

  // fear pool
  const pool = $('#fear-pool', main);
  const drawFear = () => {
    pool.innerHTML = Array.from({ length: Math.max(st.fear, 6) }, (_, i) =>
      `<span class="fear-pip ${i < st.fear ? 'on' : ''}" data-fear="${i}"></span>`).join('');
    $$('.fear-pip', pool).forEach(p => p.addEventListener('click', () => {
      const i = +p.dataset.fear;
      setState(s => { s.fear = (i < s.fear) ? i : i + 1; });
      drawFear();
    }));
  };
  drawFear();
  $('#fear-add', main).addEventListener('click', () => { setState(s => { s.fear = Math.min(30, s.fear + 1); }); drawFear(); });
  $('#fear-rem', main).addEventListener('click', () => { setState(s => { s.fear = Math.max(0, s.fear - 1); }); drawFear(); });
  $('#fear-reset', main).addEventListener('click', () => { setState(s => { s.fear = 0; }); drawFear(); });

  // countdowns
  const cds = $('#cds', main);
  const drawCds = () => {
    cds.innerHTML = '';
    if (!st.countdowns.length) {
      cds.innerHTML = '<div class="empty" style="margin:0 0 .8rem"><div class="e-title">Aucun compte à rebours</div><div class="e-sub">Suivez des événements qui avancent : pièges, renforts, rituels…</div></div>';
    }
    for (const cd of st.countdowns) {
      const box = el(`<div class="card" style="margin-bottom:.6rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
          <span class="li-name">${esc(cd.name)}</span>
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
    if (!name) { toast('Donnez un nom au compte à rebours.'); return; }
    const max = +$('#cd-max', main).value;
    setState(s => { s.countdowns.push({ id: Date.now().toString(36), name, max, value: 0 }); });
    $('#cd-new', main).value = '';
    drawCds();
  });
}

/* ---------- Bestiaire : statblocks complets SRD 2.0 ---------- */
const TYPES = ['bruiser', 'horde', 'leader', 'minion', 'ranged', 'skulk', 'social', 'solo', 'standard', 'support'];
const TYPE_LABELS = { bruiser: 'Bagarreur', horde: 'Horde', leader: 'Chef', minion: 'Sbire', ranged: 'À distance', skulk: 'Rôdeur', social: 'Social', solo: 'Solo', standard: 'Standard', support: 'Soutien' };

async function drawBestiary(body, main) {
  const all = (await data('adversaries')).sort((a, b) => a.en.localeCompare(b.en));

  body.innerHTML = `
    <div class="search-bar" style="margin-bottom:.6rem">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="gm-q" placeholder="Rechercher un adversaire…" value="${esc(gmUi.q)}">
    </div>
    <div class="filter-row" style="margin-bottom:.4rem">
      <button class="filter-chip ${gmUi.tier === null ? 'active' : ''}" data-btier="">Tous paliers</button>
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
    $('#gm-adv-count', body).textContent = `${list.length} adversaire(s) — SRD 2.0 · cliquez pour déplier le statblock`;
    const advList = $('#gm-adv-list', body);
    advList.innerHTML = '';
    for (const a of list) {
      const box = el(`<details class="rules-block adv-block">
        <summary><b>${esc(a.en)}</b> <span class="tag">${TYPE_LABELS[a.type] || a.type}</span> <span class="ms-meta" style="display:inline">${T.tiers[a.tier]} · Diff ${a.difficulty ?? '—'} · PV ${a.hp ?? '—'} · Stress ${a.stress ?? '—'}</span></summary>
        <div class="statblock">
          <div class="sb-row"><span class="sb-k">PV</span><span class="sb-v">${a.hp ?? '—'}</span><span class="sb-k">Stress</span><span class="sb-v">${a.stress ?? '—'}</span><span class="sb-k">Seuils</span><span class="sb-v">${a.major ?? '—'} / ${a.severe ?? '—'}</span>${a.horde ? `<span class="sb-k">Horde</span><span class="sb-v">${a.horde}/PV</span>` : ''}</div>
          ${a.atkName ? `<div class="sb-row"><span class="sb-k">ATQ</span><span class="sb-v">${a.atkBonus >= 0 ? '+' : ''}${a.atkBonus}</span><span class="sb-k">Attaque</span><span class="sb-v">${esc(a.atkName)} (${esc(a.atkRange)})</span><span class="sb-k">Dégâts</span><span class="sb-v">${esc(a.atkDamage || '—')}</span></div>` : ''}
          ${a.experience ? `<div class="sb-row"><span class="sb-k">Expérience</span><span class="sb-v">${esc(a.experience)}</span></div>` : ''}
        </div>
        <p class="ch-desc">${esc(a.desc)}</p>
        ${a.motives ? `<p class="ch-desc"><b style="color:var(--golden)">Motivations & tactiques :</b> ${esc(a.motives)}</p>` : ''}
        <div class="section-title" style="margin-top:.6rem">Features</div>
        ${a.features.map(f => `<p class="ch-desc" style="margin-bottom:.5rem"><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </details>`);
      advList.appendChild(box);
    }
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
async function drawEnvironments(body, main) {
  const all = (await data('environments')).sort((a, b) => a.tier - b.tier || a.en.localeCompare(b.en));

  body.innerHTML = `
    <div class="search-bar" style="margin-bottom:.6rem">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="gm-q" placeholder="Rechercher un environnement…" value="${esc(gmUi.q)}">
    </div>
    <div class="filter-row" style="margin-bottom:.8rem">
      <button class="filter-chip ${gmUi.tier === null ? 'active' : ''}" data-btier="">Tous paliers</button>
      ${[1, 2, 3, 4].map(t => `<button class="filter-chip ${gmUi.tier === t ? 'active' : ''}" data-btier="${t}">Palier ${t}</button>`).join('')}
    </div>
    <p class="page-sub" id="gm-env-count"></p>
    <div id="gm-env-list"></div>`;

  const renderList = () => {
    const list = all
      .filter(e => (!gmUi.tier || e.tier === gmUi.tier))
      .filter(e => !gmUi.q || (e.en + ' ' + e.desc).toLowerCase().includes(gmUi.q));
    $('#gm-env-count', body).textContent = `${list.length} environnement(s) — SRD 2.0`;
    const envList = $('#gm-env-list', body);
    envList.innerHTML = '';
    for (const e of list) {
      const box = el(`<details class="rules-block adv-block">
        <summary><b>${esc(e.en)}</b> <span class="tag">${esc(e.category)}</span> <span class="ms-meta" style="display:inline">${T.tiers[e.tier]}${e.difficulty ? ' · Difficulté ' + e.difficulty : ''}</span></summary>
        <p class="ch-desc">${esc(e.desc)}</p>
        ${e.impulses ? `<p class="ch-desc"><b style="color:var(--golden)">Impulsions :</b> ${esc(e.impulses)}</p>` : ''}
        ${e.adversaries ? `<p class="ch-desc"><b style="color:var(--golden)">Adversaires potentiels :</b> ${esc(e.adversaries)}</p>` : ''}
        <div class="section-title" style="margin-top:.6rem">Features</div>
        ${e.features.map(f => `<p class="ch-desc" style="margin-bottom:.5rem"><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </details>`);
      envList.appendChild(box);
    }
  };
  renderList();

  $('#gm-q', body).addEventListener('input', (e) => { gmUi.q = e.target.value.toLowerCase(); renderList(); });
  $$('[data-btier]', body).forEach(b => b.addEventListener('click', () => {
    gmUi.tier = b.dataset.btier ? +b.dataset.btier : null;
    $$('[data-btier]', body).forEach(x => x.classList.toggle('active', (x.dataset.btier ? +x.dataset.btier : null) === gmUi.tier));
    renderList();
  }));
}

/* ---------- Référence de règles ---------- */
async function drawRules(body, main) {
  body.innerHTML = `
    <details class="rules-block" open>
      <summary>Conditions (états) — SRD 2.0</summary>
      ${RULES_CONDITIONS.map(c => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${c.name}</b> <span class="tag">${c.tag}</span><p class="ch-desc" style="margin-top:.3rem">${esc(c.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>Repos &amp; temps morts (Downtime) — SRD 2.0</summary>
      ${RULES_REST.map(r => `<div class="card" style="margin-bottom:.5rem"><b style="color:var(--golden)">${r.name}</b> <span class="tag">${r.tag}</span><p class="ch-desc" style="margin-top:.3rem">${esc(r.desc)}</p></div>`).join('')}
    </details>

    <details class="rules-block">
      <summary>Créer un affrontement équilibré — SRD 2.0</summary>
      <div class="card"><p class="ch-desc">${esc(RULES_ENCOUNTER.points)}</p>
        <ul class="rules-list">${RULES_ENCOUNTER.spend.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="ch-desc" style="margin-top:.4rem">${esc(RULES_ENCOUNTER.defeated)}</p></div>
    </details>

    <details class="rules-block">
      <summary>Seuils de dégâts — SRD 2.0</summary>
      <div class="card"><p class="ch-desc">${esc(RULES_THRESHOLDS.desc)}</p></div>
    </details>

    <details class="rules-block">
      <summary>Multiclassage (niveau 5+) — SRD 2.0</summary>
      <div class="card"><p class="ch-desc">${esc(RULES_MULTICLASS.when)}</p>
        <ul class="rules-list">${RULES_MULTICLASS.what.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        <p class="ch-desc" style="margin-top:.4rem">${esc(RULES_MULTICLASS.cards)}</p></div>
    </details>`;
}
