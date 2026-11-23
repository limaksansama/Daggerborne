/* Compendium — recherche et navigation dans toutes les données FR */
import { $, $$, el, esc, go, T, data, toast, getChar, saveChar, getState, addToHand } from '../core.js';
import { formatAtkBonus } from '../rules.js';

import { t, getLang } from '../i18n.js';
/* fonction (et non constante) : les libellés doivent suivre la langue courante,
   même si le module a été chargé avant un changement de langue. */
const TABS = () => [
  { id: 'cards', label: t('sheetDomainCards'), icon: '🃏' },
  { id: 'items', label: 'Objets', icon: '🎁' },
  { id: 'classes', label: 'Classes', icon: '⚔' },
  { id: 'ancestries', label: 'Ascendances', icon: '🧬' },
  { id: 'communities', label: 'Communautés', icon: '🏘' },
  { id: 'beastforms', label: 'Formes bestiales', icon: '🐾' },
  { id: 'weapons', label: 'Armes', icon: '🗡' },
  { id: 'armors', label: 'Armures', icon: '🛡' },
  { id: 'adversaries', label: 'Adversaires', icon: '💀' },
  { id: 'environments', label: 'Environnements', icon: '🌳' },
  { id: 'transformations', label: 'Transformations', icon: '🐺' },
];
let ui = { tab: 'cards', q: '', domain: null, tier: null, itemType: null };
let advShown = 60; /* pagination des adversaires : 60 par lot, plus de limite cachée */
let renderSeq = 0;
const CAMPAIGN_LABELS = { everyday: 'Quotidien', western: 'Western', monster: 'Chasse' };
const fmtBonus = (b) => {
  const n = parseInt(b, 10) || 0;
  return n ? (n > 0 ? `+${n}` : `${n}`) : '';
};

/* ============ CARTES « CODEX » ============ */
const CODEX_KINDS = new Set(['card', 'class', 'ancestry', 'community', 'transformation']);
const CODEX_ICONS = { domain: '❖', class: '⚔', ancestry: '✦', community: '⌂', transformation: '☾' };

function codexEmblem({ icons = [], monogram = '', glyph = '✦' }) {
  if (icons.length) {
    return `<div class="cc-emblem cc-emblem-icons">${icons.map(src => `<img src="${esc(src)}" alt="">`).join('')}</div>`;
  }
  return `<div class="cc-emblem cc-emblem-letter"><b>${esc(monogram)}</b><span>${esc(glyph)}</span></div>`;
}

function codexStats(stats) {
  return `<div class="cc-stats">${stats.map(([label, value]) => `<div class="cc-stat"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`).join('')}</div>`;
}

function codexCard({ kind, kicker, title, subtitle = '', stats = [], body = '', footLeft = 'SRD 2.0', footRight = 'Daggerborne', fan = false, icons = [], monogram = '', glyph = CODEX_ICONS[kind] || '✦', badge = '' }) {
  const emblem = codexEmblem({ icons, monogram, glyph });
  const ribbon = icons.length
    ? `<span class="cc-ribbon-icons">${icons.map(src => `<img src="${esc(src)}" alt="">`).join('')}</span>`
    : `<span class="cc-ribbon-glyph">${esc(glyph)}</span>`;
  return `<section class="dh-codex-card" data-kind="${kind}">
    <div class="cc-frame">
      <span class="cc-fleur tl" aria-hidden="true"></span>
      <span class="cc-fleur tr" aria-hidden="true"></span>
      <span class="cc-fleur bl" aria-hidden="true"></span>
      <span class="cc-fleur br" aria-hidden="true"></span>
      <div class="cc-art">
        <span class="cc-halo" aria-hidden="true"></span>
        ${emblem}
        <div class="cc-ribbon">${ribbon}${badge ? `<b class="cc-level">${esc(String(badge))}</b>` : ''}</div>
        <div class="cc-plate">
          <span class="cc-kicker">${esc(kicker)}</span>
          <span class="cc-title">${esc(title)}</span>
          ${subtitle ? `<span class="cc-sub">${esc(subtitle)}</span>` : ''}
          ${fan ? '<span class="cc-fan">Hope &amp; Fear</span>' : ''}
        </div>
      </div>
      <div class="cc-divider" aria-hidden="true"><span>✦</span></div>
      <div class="cc-content">
        ${stats.length ? codexStats(stats) : ''}
        <div class="cc-body">${body}</div>
      </div>
      <footer class="cc-foot"><span>${esc(footLeft)}</span><span>${esc(footRight)}</span></footer>
    </div>
  </section>`;
}

function codexFeature(name, desc) {
  return `<div class="cc-feature"><b>${esc(name)}.</b> <span>${esc(desc)}</span></div>`;
}

function codexTile(item) {
  const emblem = codexEmblem(item);
  const ribbon = item.icons?.length
    ? `<span class="ct-ribbon-icons">${item.icons.map(src => `<img src="${esc(src)}" alt="">`).join('')}</span>`
    : esc(item.glyph || CODEX_ICONS[item.kind] || '✦');
  const btn = el(`<button class="codex-tile" data-kind="${item.kind}">
    <span class="ct-art">
      <span class="ct-halo" aria-hidden="true"></span>
      ${emblem}
      <span class="ct-ribbon">${ribbon}</span>
      <span class="ct-plate">
        <span class="ct-kicker">${esc(item.kicker)}</span>
        <span class="ct-name">${esc(item.name)}</span>
      </span>
    </span>
    <span class="ct-content">
      <span class="ct-sub">${esc(item.sub || '')}</span>
      ${item.fan ? '<span class="ct-fan">H&amp;F</span>' : ''}
      <span class="ct-foot">${esc(item.foot || 'SRD 2.0')}</span>
    </span>
  </button>`);
  btn.addEventListener('click', item.onClick);
  return btn;
}

export async function render(main, params) {
  const seq = ++renderSeq;
  main.classList.add('wide');
  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Compendium</h1>
    <p class="page-sub">Toutes les données du SRD 2.0 en français — 210 cartes, 13 classes, 24 ascendances, 15 communautés, 24 formes bestiales, 246 objets, 400 armes, 85 armures et 264 adversaires.</p>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="q" placeholder="Rechercher (nom, description…)" value="${esc(ui.q)}">
    </div>
    <div class="filter-row" id="tabs">
      ${TABS().map(tab => `<button class="filter-chip ${ui.tab === tab.id ? 'active' : ''}" data-tab="${tab.id}">${tab.icon} ${tab.label}</button>`).join('')}
    </div>
    <div class="filter-row" id="subfilters"></div>
    <div id="results"></div>
  </div>`;

  $('#q', main).addEventListener('input', (e) => { ui.q = e.target.value.toLowerCase(); advShown = 60; listResults(main, renderSeq); });
  $$('#tabs [data-tab]', main).forEach(b => b.addEventListener('click', () => {
    ui.tab = b.dataset.tab; ui.domain = null; ui.tier = null; ui.itemType = null; ui.q = ''; advShown = 60;
    render(main, params);
  }));
  await drawSubfilters(main, seq);
  if (seq !== renderSeq) return;
  await listResults(main, seq);
}

async function drawSubfilters(main, seq) {
  const sf = $('#subfilters', main);
  if (!sf || !sf.isConnected || seq !== renderSeq) return;
  sf.innerHTML = '';
  if (ui.tab === 'cards') {
    const domains = await data('domains');
    if (!$('#subfilters', main) || !sf.isConnected || seq !== renderSeq) return;
    sf.appendChild(el(`<button class="filter-chip ${ui.domain === null ? 'active' : ''}" data-dom="">Tous</button>`));
    for (const [k, d] of Object.entries(domains)) {
      sf.appendChild(el(`<button class="filter-chip ${ui.domain === k ? 'active' : ''}" data-dom="${k}"><img src="assets/icons/domain-card/${k}.png" alt="">${esc(d.fr)}</button>`));
    }
  } else if (ui.tab === 'items') {
    const types = [
      [null, 'Tous les objets'],
      ['loot', '🎁 Butin'],
      ['consumable', t('sheetConsumables')],
    ];
    for (const [v, label] of types) {
      sf.appendChild(el(`<button class="filter-chip ${ui.itemType === v ? 'active' : ''}" data-itype="${v || ''}">${label}</button>`));
    }
    $$('[data-itype]', sf).forEach(b => b.addEventListener('click', () => { ui.itemType = b.dataset.itype || null; advShown = 60; render(main); }));
  } else if (ui.tab === 'weapons' || ui.tab === 'armors' || ui.tab === 'adversaries' || ui.tab === 'environments' || ui.tab === 'beastforms') {
    sf.appendChild(el(`<button class="filter-chip ${ui.tier === null ? 'active' : ''}" data-tier="">${t('sheetAllTiers')}</button>`));
    for (const t of [1, 2, 3, 4]) {
      sf.appendChild(el(`<button class="filter-chip ${ui.tier === t ? 'active' : ''}" data-tier="${t}">${T.tiers[t]}</button>`));
    }
  }
  $$('[data-dom]', sf).forEach(b => b.addEventListener('click', () => { ui.domain = b.dataset.dom || null; render(main); }));
  $$('[data-tier]', sf).forEach(b => b.addEventListener('click', () => { ui.tier = b.dataset.tier ? +b.dataset.tier : null; advShown = 60; render(main); }));
}

async function listResults(main, seq = renderSeq) {
  const res = $('#results', main);
  if (!res || !res.isConnected || seq !== renderSeq) return;
  const stale = () => seq !== renderSeq || !res.isConnected || $('#results', main) !== res;
  res.innerHTML = '';
  const q = ui.q;
  const mk = (item) => {
    const d = el(`<button class="list-item" data-detail="${esc(item.key)}">
      <span class="li-icon">${item.icon || ''}</span>
      <span class="li-body">
        <span class="li-name">${esc(item.name)} ${item.fanTag || ''}</span>
        <span class="li-sub">${esc(item.sub || '')}</span>
      </span>
    </button>`);
    d.addEventListener('click', () => showDetail(main, item.raw, item.type));
    res.appendChild(d);
  };

  if (ui.tab === 'cards') {
    const [cards, domains] = await Promise.all([data('domainCards'), data('domains')]);
    if (stale()) return;
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
    if (stale()) return;
    let list = items.filter(i => (!ui.itemType || i.type === ui.itemType));
    if (q) list = list.filter(i => (i.fr + ' ' + i.en + ' ' + (i.descFr || '') + ' ' + (i.descEn || '')).toLowerCase().includes(q));
    list = list.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${list.length} objet(s) — matériel de base, butin magique et consommables du SRD 2.0${list.some(i => i.fan) ? ' + Hope & Fear' : ''}</p>`);
    for (const i of list) {
      mk({
        key: i.id, type: 'item', raw: i, name: i.fr,
        sub: `${i.type === 'consumable' ? 'Consommable' : 'Butin'}${i.rarity ? ' · ' + i.rarity : ''}${i.campaign ? ' · ' + (CAMPAIGN_LABELS[i.campaign] || i.campaign) : ''}${i.fan ? ' · supplément Hope & Fear' : ''}`,
        icon: i.type === 'consumable' ? '🧪' : '🎁',
        fanTag: i.fan ? '<span class="tag fan">H&F</span>' : '',
      });
    }
  } else if (ui.tab === 'classes') {
    const [classes, domains] = await Promise.all([data('classes'), data('domains')]);
    if (stale()) return;
    let list = [...classes].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    if (q) list = list.filter(c => (c.fr + ' ' + c.desc).toLowerCase().includes(q));
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${list.length} classe(s) — cartes de classe du SRD 2.0</p>`);
    const grid = el('<div class="codex-grid"></div>');
    res.appendChild(grid);
    for (const c of list) {
      grid.appendChild(codexTile({
        kind: 'class', kicker: 'Classe', name: c.fr,
        icons: c.domains.map(d => `assets/icons/domain-card/${d}.png`), glyph: '⚔',
        sub: `${c.domains.map(d => domains[d]?.fr || d).join(' · ')} · PV ${c.hp} · Évasion ${c.evasion}`,
        fan: c.fan, foot: `${c.features.length} ${t('sheetFeatures').toLowerCase()}`,
        onClick: () => showDetail(main, c, 'class'),
      }));
    }
  } else if (ui.tab === 'ancestries') {
    const list = (await data('ancestries')).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    if (stale()) return;
    const f = q ? list.filter(a => (a.fr + a.desc).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} ascendance(s) — cartes d'ascendance du SRD 2.0</p>`);
    const grid = el('<div class="codex-grid"></div>');
    res.appendChild(grid);
    for (const a of f) {
      grid.appendChild(codexTile({
        kind: 'ancestry', kicker: 'Ascendance', name: a.fr,
        monogram: a.fr.slice(0, 1), glyph: '✦',
        sub: a.abilities.map(x => x.fr).join(' · '), fan: a.fan, foot: `${a.abilities.length} ${t('cmpAbilities').toLowerCase()}`,
        onClick: () => showDetail(main, a, 'ancestry'),
      }));
    }
  } else if (ui.tab === 'communities') {
    const list = (await data('communities')).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    if (stale()) return;
    const f = q ? list.filter(c => (c.fr + c.desc).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} communauté(s) — cartes de communauté du SRD 2.0</p>`);
    const grid = el('<div class="codex-grid"></div>');
    res.appendChild(grid);
    for (const c of f) {
      grid.appendChild(codexTile({
        kind: 'community', kicker: 'Communauté', name: c.fr,
        monogram: c.fr.slice(0, 1), glyph: '⌂',
        sub: c.ability ? c.ability.fr : '', fan: c.fan, foot: 'SRD 2.0',
        onClick: () => showDetail(main, c, 'community'),
      }));
    }
  } else if (ui.tab === 'weapons') {
    const list = (await data('weapons')).filter(w => (!ui.tier || w.tier === ui.tier));
    if (stale()) return;
    const f = q ? list.filter(w => (w.fr + ' ' + w.en + ' ' + (w.desc || '')).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} arme(s) — Base &amp; Cadres de campagne</p>`);
    for (const w of f.sort((a, b) => a.tier - b.tier || a.fr.localeCompare(b.fr, 'fr'))) {
      mk({
        key: w.id, type: 'weapon', raw: w, name: w.fr,
        sub: `${T.tiers[w.tier]} · ${w.secondary ? 'Secondaire' : 'Principale'} · ${T.traits[w.trait] || ''} · ${w.range} · ${w.dice}${fmtBonus(w.dmgBonus)} ${w.dmgType}${w.desc ? ' · ' + w.desc : ''}`,
        fanTag: w.campaign ? `<span class="tag">${esc(CAMPAIGN_LABELS[w.campaign] || w.campaign)}</span>` : '',
      });
    }
  } else if (ui.tab === 'armors') {
    const list = (await data('armors')).filter(a => (!ui.tier || a.tier === ui.tier));
    if (stale()) return;
    const f = q ? list.filter(a => (a.fr + ' ' + (a.en || '') + ' ' + (a.desc || '')).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} armure(s) — Base &amp; Cadres de campagne</p>`);
    for (const a of f.sort((a, b) => a.tier - b.tier || a.fr.localeCompare(b.fr, 'fr'))) {
      mk({
        key: a.id, type: 'armor', raw: a, name: a.fr,
        sub: `${T.tiers[a.tier]} · Valeur ${a.armorScore} · Seuils ${a.major}/${a.severe}${a.heavy ? ' · Lourd' : ''}${a.desc ? ' · ' + a.desc : ''}`,
        fanTag: a.campaign ? `<span class="tag">${esc(CAMPAIGN_LABELS[a.campaign] || a.campaign)}</span>` : '',
      });
    }
  } else if (ui.tab === 'adversaries') {
    const list = (await data('adversaries')).filter(a => (!ui.tier || a.tier === ui.tier));
    if (stale()) return;
    const f = q ? list.filter(a => ((a.fr || '') + ' ' + a.en + ' ' + a.desc).toLowerCase().includes(q)) : list;
    const sorted = f.sort((a, b) => (a.fr || a.en).localeCompare(b.fr || b.en, 'fr'));
    const shown = sorted.slice(0, advShown);
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} adversaire(s) — statblocks complets du SRD 2.0 (Paliers 1 à 4)${shown.length < f.length ? ` — ${shown.length} affiché(s)` : ''}</p>`);
    for (const a of shown) {
      mk({ key: a.id, type: 'adversary', raw: a, name: getLang() === 'en' ? a.en : (a.fr || a.en), sub: `${T.tiers[a.tier]} · ${a.typeFr || ''}${a.difficulty ? ' · Difficulté ' + a.difficulty : ''} · PV ${a.hp ?? '—'} · Stress ${a.stress ?? '—'}` });
    }
    if (shown.length < f.length) {
      const more = el(`<button class="btn ghost small" id="adv-more" style="margin:.6rem auto;display:block">Afficher 60 de plus (${f.length - shown.length} restants)</button>`);
      res.appendChild(more);
      more.addEventListener('click', () => { advShown += 60; render(main); });
    }
  } else if (ui.tab === 'beastforms') {
    const list = (await data('beastforms')).filter(b => (!ui.tier || b.tier === ui.tier));
    if (stale()) return;
    const f = q ? list.filter(b => (b.fr + ' ' + b.en + ' ' + (b.examples || '') + ' ' + (b.advantages || []).join(' ')).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} forme(s) bestiale(s) de Druide — SRD 2.0 (Paliers 1 à 4)</p>`);
    for (const b of f.sort((a, x) => a.tier - x.tier || a.fr.localeCompare(x.fr, 'fr'))) {
      const traitTxt = b.trait === 'variable' ? 'Trait variable' : `${T.traits[b.trait] || b.trait} +${b.traitBonus}`;
      const dmgTxt = b.dmgDice === 'variable' ? `Dé +${b.dmgBonus}` : `${b.dmgDice}${fmtBonus(b.dmgBonus)}`;
      mk({
        key: b.id, type: 'beastform', raw: b, name: b.fr, icon: '🐾',
        sub: `${T.tiers[b.tier]} · ${traitTxt} · Évasion +${b.evasionBonus} · ${b.range} ${dmgTxt} · ${b.examples}`,
      });
    }
  } else if (ui.tab === 'environments') {
    const list = (await data('environments')).filter(e => (!ui.tier || e.tier === ui.tier));
    if (stale()) return;
    const f = q ? list.filter(e => ((e.fr || '') + ' ' + e.en + ' ' + (e.descFr || '') + ' ' + e.desc).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} environnement(s) — SRD 2.0 (Paliers 1 à 4)</p>`);
    for (const e of f.sort((a, b) => a.tier - b.tier || (a.fr || a.en).localeCompare(b.fr || b.en, 'fr'))) {
      mk({ key: e.id, type: 'environment', raw: e, name: e.fr || e.en, sub: `${T.tiers[e.tier]} · ${e.category}${e.difficulty ? ' · Difficulté ' + e.difficulty : ''} · ${e.features.length} ${t('sheetFeatures').toLowerCase()}` });
    }
  } else if (ui.tab === 'transformations') {
    const list = (await data('transformations'));
    if (stale()) return;
    const f = q ? list.filter(t => (t.fr + ' ' + t.en + ' ' + t.desc).toLowerCase().includes(q)) : list;
    res.insertAdjacentHTML('beforeend', `<p class="page-sub">${f.length} transformation(s) — options de personnage optionnelles du SRD 2.0</p>`);
    const grid = el('<div class="codex-grid"></div>');
    res.appendChild(grid);
    for (const tr of f.sort((a, b) => a.fr.localeCompare(b.fr, 'fr'))) {
      grid.appendChild(codexTile({
        kind: 'transformation', kicker: 'Transformation', name: tr.fr,
        monogram: tr.fr.slice(0, 1), glyph: '☾',
        sub: `${tr.features.length} ${t('sheetFeatures').toLowerCase()} · ${tr.questions.length} ${t('cmpIdentityQuestions').toLowerCase()}`,
        foot: 'SRD 2.0', onClick: () => showDetail(main, tr, 'transformation'),
      }));
    }
  }
}

async function showDetail(main, raw, type) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  const isCodex = CODEX_KINDS.has(type);
  if (isCodex) sheet.classList.add('dh-codex-modal');
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  let inner = '';
  if (type === 'card') {
    const domains = await data('domains');
    const domainName = domains[raw.domain]?.fr || raw.domain;
    inner = codexCard({
      kind: 'domain',
      kicker: `${t('sheetDomainCards')} · ${domainName}`,
      title: raw.fr,
      subtitle: `${T.cardType[raw.type]} · Niveau ${raw.level}`,
      stats: [[t('cmpRecall'), raw.recall]],
      icons: [`assets/icons/domain-card/${raw.domain}.png`], glyph: '❖', badge: raw.level,
      body: `<p class="cc-lead">${esc(raw.desc)}</p>`,
      footLeft: raw.fan ? 'Hope & Fear' : 'SRD 2.0',
      footRight: domainName,
      fan: !!raw.fan,
    });
  } else if (type === 'class') {
    const domains = await data('domains');
    const domainTxt = raw.domains.map(d => domains[d]?.fr || d).join(' · ');
    inner = codexCard({
      kind: 'class',
      kicker: 'Classe',
      title: raw.fr,
      subtitle: `${getLang() === 'en' ? '' : raw.en + ' · '}${domainTxt}`,
      stats: [['PV', raw.hp], [t('sheetEvasion'), raw.evasion]],
      icons: raw.domains.map(d => `assets/icons/domain-card/${d}.png`), glyph: '⚔',
      body: `<p class="cc-lead">${esc(raw.desc)}</p>
        <div class="cc-callout"><b>✦ ${esc(raw.hopeAbility)} <span>(${getLang() === 'en' ? '3 Hope' : '3 Espoirs'})</span></b><p>${esc(raw.hopeDesc)}</p></div>
        <div class="cc-section">${t('sheetFeatures')}</div>
        ${raw.features.map(f => codexFeature(f.name, f.desc)).join('')}`,
      footLeft: 'SRD 2.0', footRight: 'Daggerborne', fan: !!raw.fan,
    });
  } else if (type === 'ancestry') {
    inner = codexCard({
      kind: 'ancestry',
      kicker: 'Ascendance',
      title: raw.fr,
      subtitle: getLang() === 'en' ? '' : raw.en,
      monogram: raw.fr.slice(0, 1), glyph: '✦',
      body: `<p class="cc-lead">${esc(raw.desc)}</p><div class="cc-section">${t('cmpAbilities')}</div>${raw.abilities.map(a => codexFeature(a.fr, a.desc)).join('')}`,
      footLeft: 'SRD 2.0', footRight: 'Daggerborne', fan: !!raw.fan,
    });
  } else if (type === 'community') {
    inner = codexCard({
      kind: 'community',
      kicker: 'Communauté',
      title: raw.fr,
      subtitle: getLang() === 'en' ? '' : raw.en,
      monogram: raw.fr.slice(0, 1), glyph: '⌂',
      body: `<p class="cc-lead">${esc(raw.desc)}</p>${raw.ability ? `<div class="cc-callout"><b>${esc(raw.ability.fr)}</b><p>${esc(raw.ability.desc)}</p></div>` : ''}`,
      footLeft: 'SRD 2.0', footRight: 'Daggerborne', fan: !!raw.fan,
    });
  } else if (type === 'weapon') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">${T.tiers[raw.tier]} · ${raw.secondary ? 'Arme secondaire' : 'Arme principale'} · ${T.burden[raw.burden]}${raw.campaign ? ` · ${esc(CAMPAIGN_LABELS[raw.campaign] || raw.campaign)}` : ''}</div>
      <div class="ms-body"><p>Trait : <b>${T.traits[raw.trait] || '—'}</b> · Portée : <b>${esc(raw.range)}</b></p>
      <p>Dégâts : <b>${raw.dice}${fmtBonus(raw.dmgBonus)}</b> (${raw.dmgType === 'mag' ? 'magique' : 'physique'})</p>
      ${raw.desc ? `<p><b style="color:var(--golden)">${t('sheetFeature')}${getLang() === 'en' ? ':' : ' :'}</b> ${esc(raw.desc)}</p>` : ''}</div>`;
  } else if (type === 'armor') {
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">${T.tiers[raw.tier]}${raw.campaign ? ` · ${esc(CAMPAIGN_LABELS[raw.campaign] || raw.campaign)}` : ''}</div>
      <div class="ms-body"><p>Valeur d'armure : <b>${raw.armorScore}</b></p><p>Seuils de base : <b>${raw.major} / ${raw.severe}</b>${raw.heavy ? ' · Lourd (malus d’Évasion)' : ''}</p>
      ${raw.desc ? `<p><b style="color:var(--golden)">${t('sheetFeature')}${getLang() === 'en' ? ':' : ' :'}</b> ${esc(raw.desc)}</p>` : ''}</div>`;
  } else if (type === 'item') {
    const primaryDesc = getLang() === 'en'
      ? (raw.descEn || raw.descFr || raw.desc || '')
      : (raw.descFr || raw.descEn || raw.desc || '');
    const secondaryDesc = getLang() !== 'en' && raw.descEn && raw.descEn !== primaryDesc ? raw.descEn : '';
    inner = `
      <h3>${esc(raw.fr)}</h3>
      <div class="ms-meta">${raw.type === 'consumable' ? 'Consommable' : 'Butin'}${raw.rarity ? ' · ' + raw.rarity : ''}${raw.campaign ? ` · ${esc(CAMPAIGN_LABELS[raw.campaign] || raw.campaign)}` : ''}${raw.fan ? ' · <span style="color:#c9a3d3">' + t('sheetFanSupp') + '</span>' : ''}</div>
      <div class="ms-body">
        ${primaryDesc ? `<p>${esc(primaryDesc)}</p>` : ''}
        ${!raw.descFr && primaryDesc && getLang() !== 'en' ? '<p style="font-size:.75rem;color:var(--text-faint)">(Description originale en anglais — traduction à venir)</p>' : ''}
        ${secondaryDesc ? `<details style="margin-top:.6rem"><summary style="cursor:pointer;font-size:.78rem;color:var(--text-faint)">Version originale (EN)</summary><p style="font-size:.8rem;color:var(--text-faint);margin-top:.4rem">${esc(secondaryDesc)}</p></details>` : ''}
      </div>`;
  } else if (type === 'adversary') {
    const a = raw;
    const hordeTxt = a.horde ? ` · ${a.horde}/PV` : '';
    const atkFmt = formatAtkBonus(a.atkBonus);
    inner = `
      <h3>${esc(getLang() === 'en' ? a.en : (a.fr || a.en))}${getLang() !== 'en' && a.fr ? ` <span class="ms-meta" style="display:inline">(${esc(a.en)})</span>` : ''}</h3>
      <div class="ms-meta">${T.tiers[a.tier]} · ${esc(a.typeFr || '')}${hordeTxt}${a.difficulty ? ' · Difficulté ' + a.difficulty : ''}</div>
      <div class="statblock">
        <div class="sb-row"><span class="sb-k">PV</span><span class="sb-v">${a.hp ?? '—'}</span><span class="sb-k">Stress</span><span class="sb-v">${a.stress ?? '—'}</span><span class="sb-k">${t('cmpThresholds')}</span><span class="sb-v">${a.major ?? '—'} / ${a.severe ?? '—'}</span></div>
        ${a.atkName ? `<div class="sb-row"><span class="sb-k">ATQ</span><span class="sb-v">${esc(atkFmt || '—')}</span><span class="sb-k">Attaque</span><span class="sb-v">${esc(a.atkName)} (${esc(a.atkRange)})</span><span class="sb-k">Dégâts</span><span class="sb-v">${esc(a.atkDamage || '—')}</span></div>` : ''}
        ${a.experience ? `<div class="sb-row"><span class="sb-k">Expérience</span><span class="sb-v">${esc(a.experience)}</span></div>` : ''}
      </div>
      <div class="ms-body"><p>${esc(a.desc)}</p>
      ${a.motives ? `<p><b style="color:var(--golden)">Motivations & tactiques :</b> ${esc(a.motives)}</p>` : ''}
      <div class="section-title" style="margin-top:.8rem">${t('sheetFeatures')}</div>
      ${a.features.map(f => `<p><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </div>`;
  } else if (type === 'beastform') {
    const b = raw;
    const traitTxt = b.trait === 'variable' ? 'Trait de la forme choisie' : `${T.traits[b.trait] || b.trait} +${b.traitBonus}`;
    const dmgTxt = b.dmgDice === 'variable' ? `Dé amélioré +${b.dmgBonus}` : `${b.dmgDice}${fmtBonus(b.dmgBonus)} phy`;
    inner = `
      <h3>${esc(b.fr)}${getLang() === 'en' ? '' : ` <span class="ms-meta" style="display:inline">(${esc(b.en)})</span>`}</h3>
      <div class="ms-meta">Forme bestiale · ${T.tiers[b.tier]} · ${esc(b.examples)}</div>
      <div class="statblock">
        <div class="sb-row"><span class="sb-k">${t('sheetTrait')}</span><span class="sb-v">${esc(traitTxt)}</span><span class="sb-k">${t('sheetEvasion')}</span><span class="sb-v">+${b.evasionBonus}</span><span class="sb-k">${t('sheetAttack')}</span><span class="sb-v">${esc(b.range)} · ${esc(dmgTxt)}</span></div>
      </div>
      <div class="ms-body">
        <p><b style="color:var(--golden)">${t('sheetOnAdv')}</b> ${esc((b.advantages || []).join(', '))}</p>
        <div class="section-title" style="margin-top:.7rem">${t('sheetFeatures')}</div>
        ${b.features.map(f => `<p><b style="color:var(--golden)">${esc(f.name)}.</b> ${esc(f.desc)}</p>`).join('')}
      </div>`;
  } else if (type === 'environment') {
    const e = raw;
    inner = `
      <h3>${esc(e.fr || e.en)}${e.fr && getLang() !== 'en' ? ` <span class="ms-meta" style="display:inline">(${esc(e.en)})</span>` : ''}</h3>
      <div class="ms-meta">${T.tiers[e.tier]} · ${esc(e.category)}${e.difficulty ? ' · Difficulté ' + e.difficulty : ''}</div>
      <div class="ms-body"><p>${esc(getLang() === 'en' ? (e.desc || e.descFr) : (e.descFr || e.desc))}</p>
      ${(getLang() === 'en' ? e.impulses : e.impulsesFr) ? `<p><b style="color:var(--golden)">Impulsions :</b> ${esc(getLang() === 'en' ? e.impulses : e.impulsesFr)}</p>` : ''}
      ${e.adversaries ? `<p><b style="color:var(--golden)">Adversaires potentiels :</b> ${esc(e.adversaries)}</p>` : ''}
      <div class="section-title" style="margin-top:.8rem">${t('sheetFeatures')}</div>
      ${e.features.map(f => `<p><b>${esc(f.name)}</b> <span class="tag">${esc(f.kind)}</span> — ${esc(f.desc)}</p>`).join('')}
      </div>`;
  } else if (type === 'transformation') {
    /* ne pas nommer cette variable « t » : elle masquait la fonction de traduction */
    const tr = raw;
    inner = codexCard({
      kind: 'transformation',
      kicker: 'Transformation',
      title: tr.fr,
      subtitle: getLang() === 'en' ? '' : tr.en,
      monogram: tr.fr.slice(0, 1), glyph: '☾',
      body: `<p class="cc-lead">${esc(tr.desc)}</p>
        <div class="cc-section">${t('sheetFeatures')}</div>
        ${tr.features.map(f => codexFeature(f.name, f.desc)).join('')}
        ${tr.questions.length ? `<div class="cc-section">${t('cmpIdentityQuestions')}</div>${tr.questions.map(q => `<p class="cc-question">• ${esc(q)}</p>`).join('')}` : ''}`,
      footLeft: 'SRD 2.0', footRight: 'Daggerborne', fan: !!tr.fan,
    });
  }

  if (isCodex) {
    sheet.innerHTML = inner + `<div class="cc-actions">
      ${type === 'card' ? '<button class="btn" id="ms-add">＋ Ajouter à un personnage</button>' : ''}
      <button class="btn ghost small" id="ms-close">Fermer</button>
    </div>`;
  } else {
    sheet.innerHTML = inner + `
      ${(type === 'item' || type === 'weapon' || type === 'armor') ? `<div style="margin-top:1rem"><button class="btn" id="ms-add-item">＋ Ajouter à l'inventaire</button></div>` : ''}
      <div class="modal-close-row"><button class="btn ghost small" id="ms-close">Fermer</button></div>`;
  }
  $('#ms-close', sheet).addEventListener('click', () => back.remove());
  $('#ms-add-item', sheet)?.addEventListener('click', () => {
    const st = getState();
    if (!st.characters.length) { toast('Créez d\'abord un personnage.'); return; }
    if (st.characters.length === 1) { addEntryToInventory(st.characters[0].id, raw, type); back.remove(); return; }
    const pick = el(`<div class="modal-back"></div>`);
    const ps = el(`<div class="modal-sheet"><h3>${t('sheetAddToWhichChar')}</h3>
      ${st.characters.map(c => `<button class="choice" data-cid="${esc(c.id)}" style="margin-bottom:.5rem;width:100%"><span class="ch-name">${esc(c.name)}</span></button>`).join('')}
      <div class="modal-close-row"><button class="btn ghost small" id="p-close">Annuler</button></div></div>`);
    pick.appendChild(ps);
    document.body.appendChild(pick);
    $('#p-close', ps).addEventListener('click', () => pick.remove());
    $$('[data-cid]', ps).forEach(b => b.addEventListener('click', () => {
      addEntryToInventory(b.dataset.cid, raw, type);
      pick.remove(); back.remove();
    }));
  });

  function addEntryToInventory(charId, item, entryType) {
    const c = getChar(charId);
    const existing = (c.inventory || []).find(x => x.itemId === item.id || x.name === item.fr);
    if (existing) existing.qty = (existing.qty ?? 1) + 1;
    else {
      const desc = entryType === 'item'
        ? (getLang() === 'en' ? (item.descEn || item.descFr || item.desc || '') : (item.descFr || item.descEn || item.desc || ''))
        : (item.desc || '');
      (c.inventory = c.inventory || []).push({
        name: item.fr, qty: 1, desc, itemId: item.id,
        ...(entryType === 'item' ? { type: item.type } : {}),
      });
    }
    saveChar(c);
    toast(`« ${item.fr} » ajouté à l'inventaire de ${c.name}.`);
  }

  $('#ms-add', sheet)?.addEventListener('click', () => {
    const st = getState();
    if (!st.characters.length) { toast('Créez d\'abord un personnage.'); return; }
    if (st.characters.length === 1) { addCard(st.characters[0].id, raw.id); back.remove(); return; }
    // choose char
    const pick = el(`<div class="modal-back"></div>`);
    const ps = el(`<div class="modal-sheet"><h3>${t('sheetAddToWhichChar')}</h3>
      ${st.characters.map(c => `<button class="choice" data-cid="${esc(c.id)}" style="margin-bottom:.5rem;width:100%"><span class="ch-name">${esc(c.name)}</span></button>`).join('')}
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
    if (c.domainCards.some(x => x.cardId === cardId)) { toast(t('cmpAlreadyCollected')); return; }
    /* limite de 5 cartes en main : l'excédent part au caveau (Fix 3, cohérent avec la fiche) */
    const toHand = addToHand(c, cardId);
    saveChar(c);
    toast(toHand ? `« ${raw.fr} » ajoutée en main de ${c.name}.` : `« ${raw.fr} » ajoutée au caveau de ${c.name} (5 cartes en main maximum).`);
  }
}

/* Ouvre la même fiche « carte » depuis l'assistant de création. */
export function openCodexDetail(raw, type) {
  return showDetail(null, raw, type);
}
