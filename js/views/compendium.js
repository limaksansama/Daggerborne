/* Compendium — recherche et navigation dans toutes les données FR */
import { $, $$, el, esc, go, T, data, toast, getChar, saveChar, getState, addToHand } from '../core.js';

const TABS = [
  { id: 'cards', label: 'Cartes de domaine', icon: '🃏' },
  { id: 'items', label: 'Objets', icon: '🎁' },
  { id: 'classes', label: 'Classes', icon: '⚔' },
  { id: 'ancestries', label: 'Ascendances', icon: '🧬' },
  { id: 'communities', label: 'Communautés', icon: '🏘' },
  { id: 'weapons', label: 'Armes', icon: '🗡' },
  { id: 'armors', label: 'Armures', icon: '🛡' },
  { id: 'adversaries', label: 'Adversaires', icon: '💀' },
  { id: 'environments', label: 'Environnements', icon: '🌳' },
  { id: 'transformations', label: 'Transformations', icon: '🐺' },
];
let ui = { tab: 'cards', q: '', domain: null, tier: null, itemType: null };
let advShown = 60; /* pagination des adversaires : 60 par lot, plus de limite cachée */

export async function render(main, params) {
  main.classList.add('wide');
  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Compendium</h1>
    <p class="page-sub">Toutes les données officielles en français — ${210} cartes, 13 classes, 24 ascendances, 15 communautés, 242 objets, équipement et adversaires.</p>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="q" placeholder="Rechercher (nom, description…)" value="${esc(ui.q)}">
    </div>
    <div class="filter-row" id="tabs">
      ${TABS.map(t => `<button class="filter-chip ${ui.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.icon} ${t.label}</button>`).join('')}
    </div>
    <div class="filter-row" id="subfilters"></div>
    <div id="results"></div>
  </div>`;

  $('#q', main).addEventListener('input', (e) => { ui.q = e.target.value.toLowerCase(); listResults(main); });
  $$('#tabs [data-tab]', main).forEach(b => b.addEventListener('click', () => {
    ui.tab = b.dataset.tab; ui.domain = null; ui.tier = null; ui.itemType = null; ui.q = '';
    render(main, params);
  }));
  await drawSubfilters(main);
  await listResults(main);
}

async function drawSubfilters(main) {
  const sf = $('#subfilters', main);
  sf.innerHTML = '';
  if (ui.tab === 'cards') {
    const domains = await data('domains');
    sf.appendChild(el(`<button class="filter-chip ${ui.domain === null ? 'active' : ''}" data-dom="">Tous</button>`));
    for (const [k, d] of Object.entries(domains)) {
      sf.appendChild(el(`<button class="filter-chip ${ui.domain === k ? 'active' : ''}" data-dom="${k}"><img src="assets/icons/domain-card/${k}.png" alt="">${esc(d.fr)}</button>`));
    }
  } else if (ui.tab === 'items') {
    const types = [
      [null, 'Tous les objets'],
      ['loot', '🎁 Butin'],
      ['consumable', '🧪 Consommables'],
    ];
    for (const [v, label] of types) {
      sf.appendChild(el(`<button class="filter-chip ${ui.itemType === v ? 'active' : ''}" data-itype="${v || ''}">${label}</button>`));
    }
    $$('[data-itype]', sf).forEach(b => b.addEventListener('click', () => { ui.itemType = b.dataset.itype || null; render(main); }));
  } else if (ui.tab === 'weapons' || ui.tab === 'armors' || ui.tab === 'adversaries' || ui.tab === 'environments') {
    sf.appendChild(el(`<button class="filter-chip ${ui.tier === null ? 'active' : ''}" data-tier="">Tous paliers</button>`));
    for (const t of [1, 2, 3, 4]) {
      sf.appendChild(el(`<button class="filter-chip ${ui.tier === t ? 'active' : ''}" data-tier="${t}">${T.tiers[t]}</button>`));
    }
  }
  $$('[data-dom]', sf).forEach(b => b.addEventListener('click', () => { ui.domain = b.dataset.dom || null; render(main); }));
  $$('[data-tier]', sf).forEach(b => b.addEventListener('click', () => { ui.tier = b.dataset.tier ? +b.dataset.tier : null; render(main); }));
}

async function listResults(main) {
  const res = $('#results', main);
  res.innerHTML = '';
  const q = ui.q;
  const mk = (item) => {
    const d = el(`<button class="list-item" data-detail="${esc(item.key)}">
      <span class="li-icon">${item.icon || ''}</span>
      <span class="li-body">
        <span class="li-name">${esc(item.name)} ${item.fanTag || ''}</span>
        <span class="li-sub">${item.sub || ''}</span>
      </span>
    </button>`);
    d.addEventListener('click', () => showDetail(main, item.raw, item.type));
    res.appendChild(d);
  };

  if (ui.tab === 'cards') {
    const cards = await data('domainCards');
    const domains = await data('domains');
    let list = cards.filter(c => (!ui.domain || c.domain === ui.domain));
    if (q) list = list.filter(c => (c.fr + ' ' + c.en + ' ' + c.desc).toLowerCase().includes(q));
    list = list.sort((a, b) => a.domain.localeCompare(b.domain) || a.level - b.level);
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${list.length} carte(s)</p>`);
    for (const c of list) {
      mk({
        key: c.id, type: 'card', raw: c, name: c.fr,
        sub: `${domains[c.domain].fr} · Niveau ${c.level} · ${T.cardType[c.type]} · Rappel ${c.recall}`,
        icon: `<img src="assets/icons/domain-card/${c.domain}.png" alt="">`,
        fanTag: c.fan ? '<span class="tag fan">H&F</span>' : '',
      });
    }
  } else if (ui.tab === 'items') {
    const items = await data('generalItems');
    let list = items.filter(i => (!ui.itemType || i.type === ui.itemType));
    if (q) list = list.filter(i => (i.fr + ' ' + i.en + ' ' + (i.descFr || '') + ' ' + (i.descEn || '')).toLowerCase().includes(q));
    list = list.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${list.length} objet(s) — butin magique et consommables du livre de règles${list.some(i => i.fan) ? ' + Hope & Fear' : ''}</p>`);
    for (const i of list) {
      mk({
        key: i.id, type: 'item', raw: i, name: i.fr,
        sub: `${i.type === 'consumable' ? 'Consommable' : 'Butin'}${i.rarity ? ' · ' + i.rarity : ''}${i.fan ? ' · supplément Hope & Fear' : ''}`,
        icon: i.type === 'consumable' ? '🧪' : '🎁',
        fanTag: i.fan ? '<span class="tag fan">H&F</span>' : '',
      });
    }
  } else if (ui.tab === 'classes') {
    const classes = await data('classes');
    const domains = await data('domains');
    let list = [...classes].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    if (q) list = list.filter(c => (c.fr + c.desc).toLowerCase().includes(q));
    for (const c of list) {
      mk({ key: c.id, type: 'class', raw: c, name: c.fr, sub: c.domains.map(d => domains[d].fr).join(' · ') + ` · PV ${c.hp} · Évasion ${c.evasion}`, fanTag: c.fan ? '<span class="tag fan">H&F</span>' : '' });
    }
  } else if (ui.tab === 'ancestries') {
    const list = (await data('ancestries')).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    for (const a of (q ? list.filter(a => (a.fr + a.desc).toLowerCase().includes(q)) : list)) {
      mk({ key: a.id, type: 'ancestry', raw: a, name: a.fr, sub: a.abilities.map(x => x.fr).join(' · '), fanTag: a.fan ? '<span class="tag fan">H&F</span>' : '' });
    }
  } else if (ui.tab === 'communities') {
    const list = (await data('communities')).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    for (const c of (q ? list.filter(c => (c.fr + c.desc).toLowerCase().includes(q)) : list)) {
      mk({ key: c.id, type: 'community', raw: c, name: c.fr, sub: c.ability ? c.ability.fr : '', fanTag: c.fan ? '<span class="tag fan">H&F</span>' : '' });
    }
  } else if (ui.tab === 'weapons') {
    const list = (await data('weapons')).filter(w => (!ui.tier || w.tier === ui.tier));
    const f = q ? list.filter(w => (w.fr + ' ' + w.en).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} arme(s)</p>`);
    for (const w of f.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'))) {
      mk({ key: w.id, type: 'weapon', raw: w, name: w.fr, sub: `${T.tiers[w.tier]} · ${w.secondary ? 'Secondaire' : 'Principale'} · ${T.traits[w.trait] || ''} · ${w.range} · ${w.dice} ${w.dmgType}` });
    }
  } else if (ui.tab === 'armors') {
    const list = (await data('armors')).filter(a => (!ui.tier || a.tier === ui.tier));
    const f = q ? list.filter(a => (a.fr + ' ' + a.en).toLowerCase().includes(q)) : list;
    for (const a of f.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'))) {
      mk({ key: a.id, type: 'armor', raw: a, name: a.fr, sub: `${T.tiers[a.tier]} · Valeur ${a.armorScore} · Seuils ${a.major}/${a.severe}` });
    }
  } else if (ui.tab === 'adversaries') {
    const list = (await data('adversaries')).filter(a => (!ui.tier || a.tier === ui.tier));
    const f = q ? list.filter(a => (a.en + ' ' + a.desc).toLowerCase().includes(q)) : list;
    const sorted = f.sort((a, b) => a.en.localeCompare(b.en));
    const shown = sorted.slice(0, advShown);
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} adversaire(s) — statblocks complets du SRD 2.0 (Paliers 1 à 4)${shown.length < f.length ? ` — ${shown.length} affiché(s)` : ''}</p>`);
    for (const a of shown) {
      mk({ key: a.id, type: 'adversary', raw: a, name: a.en, sub: `${T.tiers[a.tier]} · ${a.typeFr || ''}${a.difficulty ? ' · Difficulté ' + a.difficulty : ''} · PV ${a.hp ?? '—'} · Stress ${a.stress ?? '—'}` });
    }
    if (shown.length < f.length) {
      const more = el(`<button class="btn ghost small" id="adv-more" style="margin:.6rem auto;display:block">Afficher 60 de plus (${f.length - shown.length} restants)</button>`);
      res.appendChild(more);
      more.addEventListener('click', () => { advShown += 60; render(main); });
    }
  } else if (ui.tab === 'environments') {
    const list = (await data('environments')).filter(e => (!ui.tier || e.tier === ui.tier));
    const f = q ? list.filter(e => (e.en + ' ' + e.desc).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} environnement(s) — SRD 2.0 (Paliers 1 à 4)</p>`);
    for (const e of f.sort((a, b) => a.en.localeCompare(b.en))) {
      mk({ key: e.id, type: 'environment', raw: e, name: e.en, sub: `${T.tiers[e.tier]} · ${e.category}${e.difficulty ? ' · Difficulté ' + e.difficulty : ''} · ${e.features.length} features` });
    }
  } else if (ui.tab === 'transformations') {
    const list = (await data('transformations'));
    const f = q ? list.filter(t => (t.fr + ' ' + t.en + ' ' + t.desc).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} transformation(s) — options de personnage optionnelles du SRD 2.0</p>`);
    for (const t of f.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'))) {
      mk({ key: t.id, type: 'transformation', raw: t, name: t.fr, sub: `${t.features.length} features · ${t.questions.length} questions d'identité` });
    }
  }
}

function showDetail(main, raw, type) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  let inner = '';
  if (type === 'card') {
    const domains = data('domains');
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">Carte de domaine · ${T.cardType[raw.type]} · Niveau ${raw.level} · Prix de rappel ${raw.recall} ${raw.fan ? '· <span style="color:#c9a3d3">traduction amateur (Hope & Fear)</span>' : ''}</div>
      <div class="ms-body"><p>${esc(raw.desc)}</p></div>`;
  } else if (type === 'class') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">PV ${raw.hp} · Évasion ${raw.evasion} ${raw.fan ? '· <span style="color:#c9a3d3">Hope & Fear</span>' : ''}</div>
      <div class="ms-body"><p>${esc(raw.desc)}</p><p><b style="color:var(--golden)">✦ ${esc(raw.hopeAbility)} (3 Espoirs) :</b> ${esc(raw.hopeDesc)}</p>
      ${raw.features.map(f => `<p><b>${esc(f.name)} :</b> ${esc(f.desc)}</p>`).join('')}</div>`;
  } else if (type === 'ancestry') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">Ascendance ${raw.fan ? '· <span style="color:#c9a3d3">Hope & Fear</span>' : ''}</div>
      <div class="ms-body"><p>${esc(raw.desc)}</p>${raw.abilities.map(a => `<p><b style="color:var(--golden)">${esc(a.fr)}.</b> ${esc(a.desc)}</p>`).join('')}</div>`;
  } else if (type === 'community') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">Communauté ${raw.fan ? '· <span style="color:#c9a3d3">Hope & Fear</span>' : ''}</div>
      <div class="ms-body"><p>${esc(raw.desc)}</p>${raw.ability ? `<p><b style="color:var(--golden)">${esc(raw.ability.fr)}.</b> ${esc(raw.ability.desc)}</p>` : ''}</div>`;
  } else if (type === 'weapon') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">${T.tiers[raw.tier]} · ${raw.secondary ? 'Arme secondaire' : 'Arme principale'} · ${T.burden[raw.burden]}</div>
      <div class="ms-body"><p>Trait : <b>${T.traits[raw.trait] || '—'}</b> · Portée : <b>${esc(raw.range)}</b></p>
      <p>Dégâts : <b>${raw.dice}</b> (${raw.dmgType === 'mag' ? 'magique' : 'physique'})</p></div>`;
  } else if (type === 'armor') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">${T.tiers[raw.tier]}</div>
      <div class="ms-body"><p>Valeur d'armure : <b>${raw.armorScore}</b></p><p>Seuils de base : <b>${raw.major} / ${raw.severe}</b>${raw.heavy ? ' · Lourd (malus d’Évasion)' : ''}</p></div>`;
  } else if (type === 'item') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">${raw.type === 'consumable' ? 'Consommable' : 'Butin'}${raw.rarity ? ' · ' + raw.rarity : ''}${raw.fan ? ' · <span style="color:#c9a3d3">supplément Hope & Fear</span>' : ''}</div>
      <div class="ms-body">
        ${raw.descFr ? `<p>${esc(raw.descFr)}</p>` : ''}
        ${!raw.descFr && raw.descEn ? `<p style="color:var(--text-faint)">${esc(raw.descEn)}</p><p style="font-size:.75rem;color:var(--text-faint)">(Description originale en anglais — traduction à venir)</p>` : ''}
        ${raw.descFr && raw.descEn ? `<details style="margin-top:.6rem"><summary style="cursor:pointer;font-size:.78rem;color:var(--text-faint)">Version originale (EN)</summary><p style="font-size:.8rem;color:var(--text-faint);margin-top:.4rem">${esc(raw.descEn)}</p></details>` : ''}
      </div>`;
  } else if (type === 'adversary') {
    const a = raw;
    const hordeTxt = a.horde ? ` · ${a.horde}/PV` : '';
    inner = `
      <h3>${esc(a.en)}</h3>
      <div class="ms-meta">${T.tiers[a.tier]} · ${esc(a.typeFr || '')}${hordeTxt}${a.difficulty ? ' · Difficulté ' + a.difficulty : ''}</div>
      <div class="statblock">
        <div class="sb-row"><span class="sb-k">PV</span><span class="sb-v">${a.hp ?? '—'}</span><span class="sb-k">Stress</span><span class="sb-v">${a.stress ?? '—'}</span><span class="sb-k">Seuils</span><span class="sb-v">${a.major ?? '—'} / ${a.severe ?? '—'}</span></div>
        ${a.atkName ? `<div class="sb-row"><span class="sb-k">ATQ</span><span class="sb-v">${a.atkBonus >= 0 ? '+' : ''}${a.atkBonus}</span><span class="sb-k">Attaque</span><span class="sb-v">${esc(a.atkName)} (${esc(a.atkRange)})</span><span class="sb-k">Dégâts</span><span class="sb-v">${esc(a.atkDamage || '—')}</span></div>` : ''}
        ${a.experience ? `<div class="sb-row"><span class="sb-k">Expérience</span><span class="sb-v">${esc(a.experience)}</span></div>` : ''}
      </div>
      <div class="ms-body"><p>${esc(a.desc)}</p>
      ${a.motives ? `<p><b style="color:var(--golden)">Motivations & tactiques :</b> ${esc(a.motives)}</p>` : ''}
      <div class="section-title" style="margin-top:.8rem">Features</div>
      ${a.features.map(f => `<p><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </div>`;
  } else if (type === 'environment') {
    const e = raw;
    inner = `
      <h3>${esc(e.en)}</h3>
      <div class="ms-meta">${T.tiers[e.tier]} · ${esc(e.category)}${e.difficulty ? ' · Difficulté ' + e.difficulty : ''}</div>
      <div class="ms-body"><p>${esc(e.desc)}</p>
      ${e.impulses ? `<p><b style="color:var(--golden)">Impulsions :</b> ${esc(e.impulses)}</p>` : ''}
      ${e.adversaries ? `<p><b style="color:var(--golden)">Adversaires potentiels :</b> ${esc(e.adversaries)}</p>` : ''}
      <div class="section-title" style="margin-top:.8rem">Features</div>
      ${e.features.map(f => `<p><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </div>`;
  } else if (type === 'transformation') {
    const t = raw;
    inner = `
      <h3>${esc(t.fr)} <span class="ms-meta" style="display:inline">(${esc(t.en)})</span></h3>
      <div class="ms-meta">Transformation optionnelle · SRD 2.0 · ne compte pas dans le kit</div>
      <div class="ms-body"><p>${esc(t.desc)}</p>
      <div class="section-title" style="margin-top:.8rem">Features</div>
      ${t.features.map(f => `<p><b style="color:var(--golden)">${esc(f.name)}.</b> ${esc(f.desc)}</p>`).join('')}
      ${t.questions.length ? `<div class="section-title" style="margin-top:.8rem">Questions d'identité</div>${t.questions.map(q => `<p class="q-line">• ${esc(q)}</p>`).join('')}` : ''}
      </div>`;
  }

  sheet.innerHTML = inner + `
    ${type === 'card' ? `<div style="margin-top:1rem"><button class="btn" id="ms-add">＋ Ajouter à un personnage</button></div>` : ''}
    ${type === 'item' ? `<div style="margin-top:1rem"><button class="btn" id="ms-add-item">＋ Ajouter à l'inventaire</button></div>` : ''}
    <div class="modal-close-row"><button class="btn ghost small" id="ms-close">Fermer</button></div>`;
  $('#ms-close', sheet).addEventListener('click', () => back.remove());
  $('#ms-add-item', sheet)?.addEventListener('click', () => {
    const st = getState();
    if (!st.characters.length) { toast('Créez d\'abord un personnage.'); return; }
    if (st.characters.length === 1) { addItem(st.characters[0].id, raw); back.remove(); return; }
    const pick = el(`<div class="modal-back"></div>`);
    const ps = el(`<div class="modal-sheet"><h3>Ajouter à quel personnage ?</h3>
      ${st.characters.map(c => `<button class="choice" data-cid="${c.id}" style="margin-bottom:.5rem;width:100%"><span class="ch-name">${esc(c.name)}</span></button>`).join('')}
      <div class="modal-close-row"><button class="btn ghost small" id="p-close">Annuler</button></div></div>`);
    pick.appendChild(ps);
    document.body.appendChild(pick);
    $('#p-close', ps).addEventListener('click', () => pick.remove());
    $$('[data-cid]', ps).forEach(b => b.addEventListener('click', () => {
      addItem(b.dataset.cid, raw);
      pick.remove(); back.remove();
    }));
  });

  function addItem(charId, item) {
    const c = getChar(charId);
    const existing = (c.inventory || []).find(x => x.name === item.fr);
    if (existing) existing.qty = (existing.qty ?? 1) + 1;
    else (c.inventory = c.inventory || []).push({ name: item.fr, qty: 1, desc: (item.descFr || item.descEn || '').slice(0, 140), itemId: item.id });
    saveChar(c);
    toast(`« ${item.fr} » ajouté à l'inventaire de ${c.name}.`);
  }

  $('#ms-add', sheet)?.addEventListener('click', () => {
    const st = getState();
    if (!st.characters.length) { toast('Créez d\'abord un personnage.'); return; }
    if (st.characters.length === 1) { addCard(st.characters[0].id, raw.id); back.remove(); return; }
    // choose char
    const pick = el(`<div class="modal-back"></div>`);
    const ps = el(`<div class="modal-sheet"><h3>Ajouter à quel personnage ?</h3>
      ${st.characters.map(c => `<button class="choice" data-cid="${c.id}" style="margin-bottom:.5rem;width:100%"><span class="ch-name">${esc(c.name)}</span></button>`).join('')}
      <div class="modal-close-row"><button class="btn ghost small" id="p-close">Annuler</button></div></div>`);
    pick.appendChild(ps);
    document.body.appendChild(pick);
    $('#p-close', ps).addEventListener('click', () => pick.remove());
    $$('[data-cid]', ps).forEach(b => b.addEventListener('click', () => {
      addCard(b.dataset.cid, raw.id);
      pick.remove(); back.remove();
    }));
  });

  function addCard(charId, cardId) {
    const c = getChar(charId);
    if (c.domainCards.some(x => x.cardId === cardId)) { toast('Cette carte est déjà dans la collection.'); return; }
    /* limite de 5 cartes en main : l'excédent part au caveau (Fix 3, cohérent avec la fiche) */
    const toHand = addToHand(c, cardId);
    saveChar(c);
    toast(toHand ? `« ${raw.fr} » ajoutée en main de ${c.name}.` : `« ${raw.fr} » ajoutée au caveau de ${c.name} (5 cartes en main maximum).`);
  }
}
