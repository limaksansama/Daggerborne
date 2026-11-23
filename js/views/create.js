/* Assistant de création de personnage — 9 étapes guidées */
import { $, $$, el, esc, go, T, data, toast, uid, newCharacter, saveChar, getState, setState } from '../core.js';

import { t, getLang } from '../i18n.js';
import { openCodexDetail } from './compendium.js';
/* fonction (et non constante) : les titres doivent suivre la langue courante */
const STEPS = () => [
  { id: 'class', title: 'Classe' },
  { id: 'subclass', title: t('sheetSubclass') },
  { id: 'ancestry', title: 'Ascendance' },
  { id: 'community', title: 'Communauté' },
  { id: 'traits', title: 'Traits' },
  { id: 'equipment', title: 'Équipement' },
  { id: 'cards', title: 'Cartes' },
  { id: 'experiences', title: t('sheetExperiences') },
  { id: 'identity', title: 'Identité' },
];

const MODS = [2, 1, 1, 0, 0, -1];
const WIZ_GLYPHS = { class: '⚔', subclass: '✧', ancestry: '✦', community: '⌂' };

function wizEmblem({ icons = [], monogram = '', glyph = '✦' }) {
  if (icons.length) {
    return `<span class="cc-emblem cc-emblem-icons">${icons.map(src => `<img src="${esc(src)}" alt="">`).join('')}</span>`;
  }
  return `<span class="cc-emblem cc-emblem-letter"><b>${esc(monogram)}</b><span>${esc(glyph)}</span></span>`;
}

/* Carte de sélection de l'assistant : même silhouette que le compendium,
   avec la fiche complète accessible sous la carte. */
function wizChoice({ kind, kicker, name, sub = '', info = '', fan = false, foot = 'SRD 2.0', icons = [], monogram = '', glyph = WIZ_GLYPHS[kind] || '✦', selected = false, onClick, detail }) {
  const emblem = wizEmblem({ icons, monogram, glyph });
  const ribbon = icons.length
    ? `<span class="ct-ribbon-icons">${icons.map(src => `<img src="${esc(src)}" alt="">`).join('')}</span>`
    : esc(glyph);
  const wrap = el(`<div class="choice-wrap">
    <button class="choice codex-tile codex-choice ${selected ? 'selected' : ''}" data-kind="${kind}">
      <span class="ct-art">
        <span class="ct-halo" aria-hidden="true"></span>
        ${emblem}
        <span class="ct-ribbon">${ribbon}</span>
        <span class="ct-plate">
          <span class="ct-kicker">${esc(kicker)}</span>
          <span class="ct-name">${esc(name)}</span>
        </span>
      </span>
      <span class="ct-content">
        <span class="ct-sub">${esc(sub)}</span>
        ${info ? `<span class="ct-info">${esc(info)}</span>` : ''}
        ${fan ? '<span class="ct-fan">H&amp;F</span>' : ''}
        <span class="ct-foot">${esc(foot)}</span>
      </span>
    </button>
    ${detail ? `<button type="button" class="choice-info">ⓘ ${esc(t('createFullSheet'))}</button>` : ''}
  </div>`);
  wrap.querySelector('.codex-choice').addEventListener('click', onClick);
  if (detail) wrap.querySelector('.choice-info').addEventListener('click', detail);
  return wrap;
}

let wiz = null;

function initWiz() {
  return {
    step: 0,
    classId: null, subclassId: null,
    ancestryId: null, mixedAncestry: false, ancestry2Id: null, mixedFirstFrom: 1, mixedName: '',
    communityId: null,
    traits: { agility: null, strength: null, finesse: null, instinct: null, presence: null, knowledge: null },
    primaryWeaponId: null, secondaryWeaponId: null, armorId: null, twoHanded: false,
    includeCampaignGear: false,
    startingPotion: 'health',
    cardIds: [],
    experiences: [{ name: '', mod: 2 }, { name: '', mod: 2 }],
    name: '', pronouns: '', answers: {}, notes: '',
    transformation: '',
  };
}

let mainRef = null;

export async function render(main, params) {
  main.classList.add('wide');
  mainRef = main;
  if (!wiz) wiz = initWiz();
  if (params === 'reset') { wiz = initWiz(); go('create'); return; }
  await draw(main);
}

function getMain() { return mainRef && mainRef.isConnected ? mainRef : document.querySelector('#main'); }

async function draw(main) {
  if (!main || !main.isConnected) return;
  const steps = STEPS();
  const step = steps[wiz.step];
  // guard against stale draws after navigation away (root removed from DOM)
  const myView = `<div class="view" id="wiz"></div>`;
  main.innerHTML = myView;
  const root = $('#wiz', main);
  if (!root || !root.isConnected) return;

  root.innerHTML = `
    <p class="page-sub" style="margin-top:.4rem">Étape ${wiz.step + 1} sur ${steps.length} — ${step.title}</p>
    <div class="wizard-steps">
      ${steps.map((s, i) => `
        <div class="wstep ${i === wiz.step ? 'active' : i < wiz.step ? 'done' : ''}" data-step="${i}">
          <span class="n">${i < wiz.step ? '✓' : i + 1}</span>
          <span>${s.title}</span>
        </div>`).join('')}
    </div>
    <div id="step-body"></div>
    <div class="wizard-nav">
      ${wiz.step > 0 ? '<button class="btn ghost" id="w-prev">← Retour</button>' : ''}
      <button class="btn ghost" id="w-reset" title="Effacer la création en cours et repartir de zéro">↺ Recommencer</button>
      ${wiz.step < steps.length - 1
        ? '<button class="btn" id="w-next">Continuer →</button>'
        : '<button class="btn" id="w-finish">' + t('createFinish') + '</button>'}
    </div>`;

  const body = $('#step-body', root);
  const renderers = { class: stepClass, subclass: stepSubclass, ancestry: stepAncestry, community: stepCommunity, traits: stepTraits, equipment: stepEquipment, cards: stepCards, experiences: stepExperiences, identity: stepIdentity };
  await renderers[step.id](body);
  // stop if the user navigated away during async rendering
  if (!root.isConnected) return;

  $$('.wstep', root).forEach(w => w.addEventListener('click', () => {
    const i = +w.dataset.step;
    if (i < wiz.step) { wiz.step = i; draw(main); }
  }));
  $('#w-prev', root)?.addEventListener('click', () => { wiz.step--; draw(main); });
  $('#w-reset', root)?.addEventListener('click', () => {
    if (confirm(t('createReset'))) {
      wiz = initWiz();
      draw(main);
    }
  });
  $('#w-next', root)?.addEventListener('click', async () => {
    const ok = await validate(main, step.id);
    if (ok) { wiz.step++; draw(main); window.scrollTo({ top: 0 }); }
  });
  $('#w-finish', root)?.addEventListener('click', async () => {
    if (await validate(main, 'identity')) finish(main);
  });
}

async function validate(main, stepId) {
  const need = {
    class: [wiz.classId, t('createNeedClass')],
    subclass: [wiz.subclassId, 'Choisissez une sous-classe.'],
    ancestry: [wiz.ancestryId && (!wiz.mixedAncestry || wiz.ancestry2Id), wiz.mixedAncestry ? 'Choisissez vos deux ascendances pour l\'Ascendance mixte.' : 'Choisissez une ascendance.'],
    community: [wiz.communityId, 'Choisissez une communauté.'],
    traits: [Object.values(wiz.traits).every(v => v !== null), 'Répartissez tous les modificateurs de trait (+2, +1, +1, 0, 0, −1).'],
    equipment: [wiz.primaryWeaponId && wiz.armorId, 'Choisissez au moins une arme principale et une armure.'],
    cards: [wiz.cardIds.length === 2, `Sélectionnez exactement 2 cartes de domaine de niveau 1 (${wiz.cardIds.length}/2).`],
    experiences: [wiz.experiences.every(e => e.name.trim()), 'Nommez vos deux Expériences.'],
    identity: [wiz.name.trim(), 'Donnez un nom à votre personnage.'],
  };
  const [ok, msg] = need[stepId] || [true, ''];
  if (!ok) { toast(msg); return false; }
  return true;
}

/* ================= STEP 1: CLASS ================= */
async function stepClass(body) {
  const classes = await data('classes');
  const domains = await data('domains');
  const sorted = [...classes].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
  body.innerHTML = `<p class="page-sub" style="margin-bottom:.8rem">${t('createClassHint')}</p>
  <div class="choice-grid codex-choice-grid" id="grid"></div>`;
  const grid = $('#grid', body);
  for (const c of sorted) {
    const domNames = c.domains.map(d => domains[d].fr).join(' · ');
    grid.appendChild(wizChoice({
      kind: 'class', kicker: 'Classe', name: c.fr,
      icons: c.domains.map(d => `assets/icons/domain-card/${d}.png`), glyph: '⚔',
      sub: `${domNames} · PV ${c.hp} · Évasion ${c.evasion}`,
      info: c.desc, fan: c.fan,
      foot: `${c.features.length} ${t('sheetFeatures').toLowerCase()}`,
      selected: wiz.classId === c.id,
      onClick: () => {
        /* re-clic sur la même classe : garde la sélection (pas de toggle-off piégeux) */
        if (wiz.classId !== c.id) { wiz.classId = c.id; wiz.subclassId = null; wiz.cardIds = []; }
        draw(getMain());
      },
      detail: () => openCodexDetail(c, 'class'),
    }));
  }
}

/* ================= STEP 2: SUBCLASS ================= */
async function stepSubclass(body) {
  const [classes, subclasses, weapons] = await Promise.all([data('classes'), data('subclasses'), data('weapons')]);
  const cl = classes.find(c => c.id === wiz.classId);
  const subs = subclasses.filter(s => s.classId === wiz.classId).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
  body.innerHTML = `
    <p class="page-sub" style="margin-bottom:.8rem">Classe : <b style="color:var(--golden)">${esc(cl.fr)}</b> — choisissez la voie qui façonne vos aptitudes.</p>
    <div class="choice-grid codex-choice-grid" id="grid"></div>`;
  const grid = $('#grid', body);
  for (const s of subs) {
    grid.appendChild(wizChoice({
      kind: 'subclass', kicker: t('sheetSubclass'), name: s.fr,
      monogram: s.fr.slice(0, 1), glyph: '✧',
      sub: s.spellcastTrait ? `Incantation : ${T.traits[s.spellcastTrait] || '—'}` : '',
      info: s.desc,
      foot: `${s.features.length} ${t('sheetFeatures').toLowerCase()}`,
      selected: wiz.subclassId === s.id,
      onClick: () => {
        wiz.subclassId = s.id; /* re-clic : conserve la sélection */
        if (!s.spellcastTrait) {
          const pw = weapons.find(w => w.id === wiz.primaryWeaponId);
          const sw = weapons.find(w => w.id === wiz.secondaryWeaponId);
          if (pw?.dmgType === 'mag') wiz.primaryWeaponId = null;
          if (sw?.dmgType === 'mag') wiz.secondaryWeaponId = null;
        }
        draw(getMain());
      },
    }));
  }
}

/* ================= STEP 3: ANCESTRY (avec Ascendance mixte SRD 2.0) ================= */
async function stepAncestry(body) {
  const ancestries = await data('ancestries');
  const sorted = [...ancestries].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
  const a1 = ancestries.find(x => x.id === wiz.ancestryId);
  const a2 = ancestries.find(x => x.id === wiz.ancestry2Id);

  body.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:.7rem">
    <p class="page-sub" style="margin:0">Votre ascendance accorde deux aptitudes. En <b>${t('createAncestryMix')}</b>${t('createAncMixHint')}</p>
    <label style="display:inline-flex;align-items:center;gap:.45rem;font-size:.82rem;color:var(--golden);cursor:pointer;background:var(--panel-2);padding:.4rem .7rem;border-radius:10px;border:1px solid var(--border)">
      <input type="checkbox" id="anc-mixed" ${wiz.mixedAncestry ? 'checked' : ''} style="accent-color:var(--golden)"> Ascendance mixte (SRD 2.0)
    </label>
  </div>
  ${wiz.mixedAncestry ? `
  <div class="card" style="margin-bottom:.9rem">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.7rem">
      <div class="field" style="margin:0"><label>1re ascendance</label>
        <select id="anc-s1" style="background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.5rem;width:100%">
          <option value="">— Choisir —</option>
          ${sorted.map(a => `<option value="${a.id}" ${wiz.ancestryId === a.id ? 'selected' : ''}>${esc(a.fr)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0"><label>2e ascendance</label>
        <select id="anc-s2" style="background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.5rem;width:100%">
          <option value="">— Choisir —</option>
          ${sorted.map(a => `<option value="${a.id}" ${wiz.ancestry2Id === a.id ? 'selected' : ''}>${esc(a.fr)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0"><label>Nom d'héritage (optionnel)</label>
        <input type="text" id="anc-mname" value="${esc(wiz.mixedName)}" placeholder="${a1 && a2 ? esc(`${a1.fr}-${a2.fr}`) : 'Ex. : Gobelin-Orc'}">
      </div>
    </div>
    ${a1 && a2 ? `
    <div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn small ${wiz.mixedFirstFrom === 1 ? '' : 'ghost'}" data-mix-ord="1">1re apt. de ${esc(a1.fr)} (${esc(a1.abilities[0]?.fr || '')}) + 2e apt. de ${esc(a2.fr)} (${esc(a2.abilities[1]?.fr || '')})</button>
      <button class="btn small ${wiz.mixedFirstFrom === 2 ? '' : 'ghost'}" data-mix-ord="2">1re apt. de ${esc(a2.fr)} (${esc(a2.abilities[0]?.fr || '')}) + 2e apt. de ${esc(a1.fr)} (${esc(a1.abilities[1]?.fr || '')})</button>
    </div>` : '<p class="dh-help" style="margin-top:.5rem">Sélectionnez deux ascendances ci-dessus ou cliquez dans la grille ci-dessous.</p>'}
  </div>` : ''}
  <div class="choice-grid codex-choice-grid" id="grid"></div>`;

  $('#anc-mixed', body).addEventListener('change', (e) => {
    wiz.mixedAncestry = e.target.checked;
    if (!wiz.mixedAncestry) wiz.ancestry2Id = null;
    draw(getMain());
  });
  $('#anc-s1', body)?.addEventListener('change', (e) => {
    wiz.ancestryId = e.target.value || null;
    if (wiz.ancestryId && wiz.ancestryId === wiz.ancestry2Id) wiz.ancestry2Id = null;
    draw(getMain());
  });
  $('#anc-s2', body)?.addEventListener('change', (e) => {
    wiz.ancestry2Id = e.target.value || null;
    if (wiz.ancestry2Id && wiz.ancestry2Id === wiz.ancestryId) wiz.ancestry2Id = null;
    draw(getMain());
  });
  $('#anc-mname', body)?.addEventListener('input', (e) => { wiz.mixedName = e.target.value; });
  $$('[data-mix-ord]', body).forEach(b => b.addEventListener('click', () => {
    wiz.mixedFirstFrom = +b.dataset.mixOrd;
    draw(getMain());
  }));

  const grid = $('#grid', body);
  for (const a of sorted) {
    const isSel = wiz.ancestryId === a.id || (wiz.mixedAncestry && wiz.ancestry2Id === a.id);
    const line = wiz.mixedAncestry && wiz.ancestryId === a.id ? ' · Lignée 1'
      : wiz.mixedAncestry && wiz.ancestry2Id === a.id ? ' · Lignée 2' : '';
    grid.appendChild(wizChoice({
      kind: 'ancestry', kicker: `Ascendance${line}`, name: a.fr,
      monogram: a.fr.slice(0, 1), glyph: '✦',
      sub: a.abilities.map(x => x.fr).join(' · '),
      info: a.desc, fan: a.fan,
      foot: `${a.abilities.length} ${t('cmpAbilities').toLowerCase()}`,
      selected: isSel,
      onClick: () => {
        if (!wiz.mixedAncestry) {
          wiz.ancestryId = a.id;
        } else if (!wiz.ancestryId) {
          wiz.ancestryId = a.id;
        } else if (wiz.ancestryId === a.id) {
          /* re-clic sur Lignée 1 : désélectionne si Lignée 2 est libre, sinon conserve */
          if (wiz.ancestry2Id) { wiz.ancestryId = wiz.ancestry2Id; wiz.ancestry2Id = null; }
        } else if (wiz.ancestry2Id === a.id) {
          wiz.ancestry2Id = null;
        } else {
          wiz.ancestry2Id = a.id;
        }
        draw(getMain());
      },
      detail: () => openCodexDetail(a, 'ancestry'),
    }));
  }
}

/* ================= STEP 4: COMMUNITY ================= */
async function stepCommunity(body) {
  const communities = await data('communities');
  const sorted = [...communities].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
  body.innerHTML = `<p class="page-sub" style="margin-bottom:.8rem">La communauté représente la culture dans laquelle votre personnage a grandi : elle accorde une aptitude.</p>
  <div class="choice-grid codex-choice-grid" id="grid"></div>`;
  const grid = $('#grid', body);
  for (const c of sorted) {
    grid.appendChild(wizChoice({
      kind: 'community', kicker: 'Communauté', name: c.fr,
      monogram: c.fr.slice(0, 1), glyph: '⌂',
      sub: c.ability ? c.ability.fr : '',
      info: c.desc, fan: c.fan, foot: 'SRD 2.0',
      selected: wiz.communityId === c.id,
      onClick: () => {
        wiz.communityId = c.id; /* re-clic : conserve la sélection */
        draw(getMain());
      },
      detail: () => openCodexDetail(c, 'community'),
    }));
  }
}

/* ================= STEP 5: TRAITS ================= */
async function stepTraits(body) {
  const classes = await data('classes');
  const cl = classes.find(c => c.id === wiz.classId);
  const traits = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
  const used = traits.filter(t => wiz.traits[t] !== null).map(t => wiz.traits[t]);
  const available = [...MODS];
  for (const u of used) { const i = available.indexOf(u); if (i >= 0) available.splice(i, 1); }

  body.innerHTML = `
    <p class="page-sub" style="margin-bottom:.8rem">Répartissez vos modificateurs de départ : <b style="color:var(--golden)">+2, +1, +1, 0, 0, −1</b>. La suggestion de la classe ${esc(cl.fr)} est affichée sous chaque trait.</p>
    <div class="mod-pool">
      ${MODS.map(m => `<span class="chip ${used.filter(u => u === m).length >= MODS.filter(x => x === m).length ? 'used' : ''}">${m > 0 ? '+' + m : m}</span>`).join('')}
    </div>
    <div id="traits"></div>
    <div style="margin-top:1rem"><button class="btn ghost small" id="suggest">⚡ Utiliser les traits suggérés (${esc(cl.fr)})</button></div>`;

  const wrap = $('#traits', body);
  for (const t of traits) {
    const sug = cl.suggestedTraits?.[t];
    const opts = [null, ...MODS];
    const row = el(`<div class="trait-row">
      <div>
        <div class="tr-name">${T.traits[t]}</div>
        <div class="tr-verbs">${T.traitVerbs[t]}${sug !== undefined ? ` · suggéré : ${sug > 0 ? '+' + sug : sug}` : ''}</div>
      </div>
      <select data-trait="${t}">
        <option value="">—</option>
        ${opts.map(m => `<option value="${m}" ${wiz.traits[t] === m ? 'selected' : ''} ${m !== null && !availHas(m) && wiz.traits[t] !== m ? 'disabled' : ''}>${m === null ? '—' : m > 0 ? '+' + m : String(m)}</option>`).join('')}
      </select>
    </div>`);
    function availHas(m) { return available.includes(m) || wiz.traits[t] === m; }
    row.querySelector('select').addEventListener('change', (e) => {
      wiz.traits[t] = e.target.value === '' ? null : +e.target.value;
      draw(getMain());
    });
    wrap.appendChild(row);
  }
  $('#suggest', body).addEventListener('click', () => {
    if (!cl.suggestedTraits) return;
    // suggested traits may not use the exact +2/+1/+1/0/0/-1 spread; normalize by assigning closest
    const pool = [...MODS];
    for (const t of traits) {
      const sug = cl.suggestedTraits[t];
      let best = pool[0], bi = 0;
      pool.forEach((p, i) => { if (Math.abs(p - sug) < Math.abs(best - sug)) { best = p; bi = i; } });
      pool.splice(bi, 1);
      wiz.traits[t] = best;
    }
    draw(getMain());
    toast('Traits suggérés appliqués (ajustés au palier +2/+1/+1/0/0/−1).');
  });
}

/* ================= STEP 6: EQUIPMENT ================= */
async function stepEquipment(body) {
  const classes = await data('classes');
  const weapons = await data('weapons');
  const armors = await data('armors');
  const subclasses = await data('subclasses');
  const cl = classes.find(c => c.id === wiz.classId);
  const sub = subclasses.find(s => s.id === wiz.subclassId);
  const hasSpellcast = !!sub?.spellcastTrait;
  const CAMPAIGN_TAGS = { everyday: 'Quotidien', western: 'Western', monster: 'Chasse' };
  const fmtB = (b) => b ? (b > 0 ? `+${b}` : `${b}`) : '';

  const tier1Filter = (x) => x.tier === 1 && (wiz.includeCampaignGear || !x.campaign);
  const primaries = weapons.filter(w => !w.secondary && tier1Filter(w));
  const secondaries = weapons.filter(w => w.secondary && tier1Filter(w));
  const armorList = armors.filter(tier1Filter);
  const primary = weapons.find(w => w.id === wiz.primaryWeaponId);

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem">
      <div class="section-title" style="margin:0">Arme principale</div>
      <label style="display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--text-dim);cursor:pointer">
        <input type="checkbox" id="eq-camp" ${wiz.includeCampaignGear ? 'checked' : ''}> Inclure l'équipement des cadres de campagne (Quotidien, Western, Chasse)
      </label>
    </div>
    <p class="page-sub" style="margin-bottom:.7rem">Une arme à deux mains, ou une arme à une main + une arme secondaire. ${hasSpellcast ? 'Votre sous-classe donne accès aux armes magiques.' : 'Les armes magiques nécessitent un trait d’Incantation.'}</p>
    <div class="choice-grid" id="wgrid"></div>
    <div id="sec-block" style="display:${primary && primary.burden === 'oneHanded' ? 'block' : 'none'}">
      <div class="section-title">Arme secondaire</div>
      <div class="choice-grid" id="sgrid"></div>
    </div>
    <div class="section-title">Armure</div>
    <p class="page-sub" style="margin-bottom:.7rem">L'armure définit votre Valeur d'armure et vos seuils de dégâts (auxquels s'ajoute votre niveau).</p>
    <div class="choice-grid" id="agrid"></div>
    <div class="section-title">Potion de départ (SRD 2.0)</div>
    <p class="page-sub" style="margin-bottom:.7rem">En plus de votre torche, 15 m de corde et fournitures de base, choisissez votre potion de départ :</p>
    <div class="choice-grid" id="pgrid">
      <button class="choice ${wiz.startingPotion !== 'stamina' ? 'selected' : ''}" data-pot="health">
        <div class="ch-head"><span class="ch-name">🧪 Potion de santé mineure</span></div>
        <div class="ch-desc">Consommable — Effacez 1d4 PV.</div>
      </button>
      <button class="choice ${wiz.startingPotion === 'stamina' ? 'selected' : ''}" data-pot="stamina">
        <div class="ch-head"><span class="ch-name">🧪 Potion de résilience mineure</span></div>
        <div class="ch-desc">Consommable — Effacez 1d4 Stress.</div>
      </button>
    </div>`;

  $('#eq-camp', body)?.addEventListener('change', (e) => {
    wiz.includeCampaignGear = e.target.checked;
    if (!wiz.includeCampaignGear) {
      const pw = weapons.find(w => w.id === wiz.primaryWeaponId);
      const sw = weapons.find(w => w.id === wiz.secondaryWeaponId);
      const ar = armors.find(a => a.id === wiz.armorId);
      if (pw?.campaign) wiz.primaryWeaponId = null;
      if (sw?.campaign) wiz.secondaryWeaponId = null;
      if (ar?.campaign) wiz.armorId = null;
    }
    draw(getMain());
  });
  $$('[data-pot]', body).forEach(b => b.addEventListener('click', () => {
    wiz.startingPotion = b.dataset.pot;
    draw(getMain());
  }));

  const wgrid = $('#wgrid', body);
  for (const w of primaries) {
    const isMag = w.dmgType === 'mag';
    if (isMag && !hasSpellcast) continue;
    const b = el(`<button class="choice ${wiz.primaryWeaponId === w.id ? 'selected' : ''}" data-id="${w.id}">
      <div class="ch-head"><span class="ch-name">${esc(w.fr)}</span>
        ${w.campaign ? `<span class="tag">${esc(CAMPAIGN_TAGS[w.campaign] || w.campaign)}</span>` : ''}
        <span class="stat-chip">${T.burden[w.burden]}</span></div>
      <div class="ch-stats">
        <span class="stat-chip">${T.traits[w.trait] || '—'}</span>
        <span class="stat-chip">Portée <b>${esc(w.range)}</b></span>
        <span class="stat-chip">Dégâts <b>${w.dice}${fmtB(w.dmgBonus)}</b> ${w.dmgType === 'mag' ? 'mag' : 'phy'}</span>
      </div>
      ${w.desc ? `<div class="ch-desc" style="font-size:.76rem">${esc(w.desc)}</div>` : ''}
    </button>`);
    b.addEventListener('click', () => {
      wiz.primaryWeaponId = w.id; /* re-clic : conserve la sélection */
      if (wiz.primaryWeaponId && w.burden === 'twoHanded') wiz.secondaryWeaponId = null;
      draw(getMain());
    });
    wgrid.appendChild(b);
  }
  const sgrid = $('#sgrid', body);
  for (const w of secondaries) {
    const isMag = w.dmgType === 'mag';
    if (isMag && !hasSpellcast) continue;
    const b = el(`<button class="choice ${wiz.secondaryWeaponId === w.id ? 'selected' : ''}" data-id="${w.id}">
      <div class="ch-head"><span class="ch-name">${esc(w.fr)}</span>${w.campaign ? `<span class="tag">${esc(CAMPAIGN_TAGS[w.campaign] || w.campaign)}</span>` : ''}</div>
      <div class="ch-stats">
        <span class="stat-chip">${T.traits[w.trait] || '—'}</span>
        <span class="stat-chip"><b>${w.dice}${fmtB(w.dmgBonus)}</b> ${w.dmgType === 'mag' ? 'mag' : 'phy'}</span>
      </div>
      ${w.desc ? `<div class="ch-desc" style="font-size:.76rem">${esc(w.desc)}</div>` : ''}
    </button>`);
    b.addEventListener('click', () => {
      wiz.secondaryWeaponId = w.id; /* re-clic : conserve la sélection */
      draw(getMain());
    });
    sgrid.appendChild(b);
  }
  const agrid = $('#agrid', body);
  for (const a of armorList) {
    const b = el(`<button class="choice ${wiz.armorId === a.id ? 'selected' : ''}" data-id="${a.id}">
      <div class="ch-head"><span class="ch-name">${esc(a.fr)}</span>${a.campaign ? `<span class="tag">${esc(CAMPAIGN_TAGS[a.campaign] || a.campaign)}</span>` : ''}</div>
      <div class="ch-stats">
        <span class="stat-chip">Valeur d'armure <b>${a.armorScore}</b></span>
        <span class="stat-chip">Seuils <b>${a.major}/${a.severe}</b></span>
        ${a.heavy ? '<span class="stat-chip">Lourd</span>' : ''}
      </div>
      ${a.desc ? `<div class="ch-desc" style="font-size:.76rem">${esc(a.desc)}</div>` : ''}
    </button>`);
    b.addEventListener('click', () => {
      wiz.armorId = a.id; /* re-clic : conserve la sélection */
      draw(getMain());
    });
    agrid.appendChild(b);
  }
}

/* ================= STEP 7: DOMAIN CARDS ================= */
async function stepCards(body) {
  const classes = await data('classes');
  const cards = await data('domainCards');
  const domains = await data('domains');
  const cl = classes.find(c => c.id === wiz.classId);
  const lvl1 = cards.filter(c => c.level === 1 && cl.domains.includes(c.domain))
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.fr.localeCompare(b.fr, 'fr'));

  body.innerHTML = `
    <p class="page-sub" style="margin-bottom:.8rem">Choisissez <b style="color:var(--golden)">2 cartes de niveau 1</b> parmi les domaines de la classe ${esc(cl.fr)} (${cl.domains.map(d => esc(domains[d].fr)).join(' et ')}). Sélection ${wiz.cardIds.length}/2.</p>
    <div class="choice-grid" id="grid"></div>`;
  const grid = $('#grid', body);
  for (const c of lvl1) {
    const sel = wiz.cardIds.includes(c.id);
    const btn = el(`<button class="choice ${sel ? 'selected' : ''}" data-id="${c.id}">
      <div class="ch-head">
        <img src="assets/icons/domain-card/${c.domain}.png" alt="" style="width:22px;height:22px">
        <span class="ch-name">${esc(c.fr)}</span>
        ${c.fan ? '<span class="tag fan">' + t('sheetTradAm') + '</span>' : ''}
      </div>
      <div class="ch-sub">${T.cardType[c.type]} · ${esc(domains[c.domain].fr)} · Prix de rappel ${c.recall}</div>
      <div class="ch-desc">${esc(c.desc)}</div>
    </button>`);
    btn.addEventListener('click', () => {
      if (sel) wiz.cardIds = wiz.cardIds.filter(x => x !== c.id);
      else if (wiz.cardIds.length < 2) wiz.cardIds.push(c.id);
      else toast('Vous ne pouvez prendre que 2 cartes au niveau 1.');
      draw(getMain());
    });
    grid.appendChild(btn);
  }
}

/* ================= STEP 8: EXPERIENCES ================= */
async function stepExperiences(body) {
  body.innerHTML = `
    <p class="page-sub" style="margin-bottom:.8rem">Les Expériences résument le vécu de votre personnage. Chacune commence avec un modificateur de <b style="color:var(--golden)">+2</b>. Soyez spécifique : « Bretteur du Syndicat » vaut mieux que « Talentueux ».</p>
    <div class="card">
      ${wiz.experiences.map((e, i) => `
      <div class="field">
        <label>Expérience ${i + 1}</label>
        <input type="text" data-exp="${i}" value="${esc(e.name)}" placeholder="${i === 0 ? 'Ex. : Vétéran des guerres côtières' : 'Ex. : Conteur de légendes anciennes'}">
      </div>`).join('')}
      <div class="ch-desc" style="font-size:.78rem;color:var(--text-faint)">Sources d'inspiration — Background : Assassin, Marchand, Pirate… · Caractéristique : Charmant, Loup solitaire… · Spécialité : Bretteur, Guérisseur, Tacticien… · Don : Main leste, Viser juste…</div>
    </div>`;
  $$('input[data-exp]', body).forEach(inp => {
    inp.addEventListener('input', (e) => {
      wiz.experiences[+inp.dataset.exp].name = e.target.value;
    });
  });
}

/* ================= STEP 9: IDENTITY ================= */
async function stepIdentity(body) {
  const classes = await data('classes');
  const subclasses = await data('subclasses');
  const ancestries = await data('ancestries');
  const communities = await data('communities');
  const transformations = await data('transformations');
  const cl = classes.find(c => c.id === wiz.classId);
  const sub = subclasses.find(s => s.id === wiz.subclassId);
  const anc = ancestries.find(a => a.id === wiz.ancestryId);
  const anc2 = wiz.mixedAncestry ? ancestries.find(a => a.id === wiz.ancestry2Id) : null;
  const ancSummary = (wiz.mixedAncestry && anc && anc2)
    ? (wiz.mixedName.trim() || `${anc.fr}-${anc2.fr}`)
    : (anc?.fr || '—');
  const com = communities.find(c => c.id === wiz.communityId);

  body.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="field"><label>Nom du personnage *</label>
        <input type="text" id="f-name" value="${esc(wiz.name)}" placeholder="Ex. : Vex du Clan Ambervelde"></div>
      <div class="field"><label>Pronoms</label>
        <input type="text" id="f-pronouns" value="${esc(wiz.pronouns)}" placeholder="iel · elle · il"></div>
      <div class="field"><label>Transformation (optionnelle — SRD 2.0)</label>
        <select id="f-transformation" style="background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem .7rem;width:100%">
          <option value="">Aucune</option>
          ${transformations.map(tr => {
            const label = getLang() === 'en' ? tr.en : `${tr.fr} (${tr.en})`;
            return `<option value="${esc(tr.fr)}" ${wiz.transformation === tr.fr ? 'selected' : ''}>${esc(label)}</option>`;
          }).join('')}
        </select>
        <p class="page-sub" style="font-size:.72rem;margin:.3rem 0 0">Une transformation est un aspect optionnel de l'identité accordé par le MJ — elle ne compte pas dans votre kit. Consultez ses aptitudes dans le Compendium.</p>
      </div>
    </div>
    <div class="section-title">Questions de background (${esc(cl.fr)})</div>
    <p class="page-sub" style="margin-bottom:.8rem">Répondez à celles qui vous inspirent — c'est purement narratif, mais c'est ce qui donne vie à votre personnage.</p>
    <div class="card">
      ${cl.questions.map((q, i) => `
      <div class="field"><label>Question ${i + 1}</label>
        <textarea data-q="${i}" placeholder="${esc(q)}">${esc(wiz.answers[i] || '')}</textarea></div>`).join('')}
    </div>
    <div class="section-title">Récapitulatif</div>
    <div class="card">
      <div class="cc-meta" style="gap:.4rem 1.2rem">
        <span>Classe : <b style="color:var(--golden)">${esc(cl.fr)}</b></span>
        <span>Sous-classe : <b style="color:var(--golden)">${esc(sub?.fr || '—')}</b></span>
        <span>Ascendance : <b style="color:var(--golden)">${esc(ancSummary)}</b></span>
        <span>Communauté : <b style="color:var(--golden)">${esc(com?.fr || '—')}</b></span>
        <span>Transformation : <b style="color:var(--golden)">${esc(wiz.transformation || '—')}</b></span>
        <span>PV : <b>${cl.hp}</b></span>
        <span>Évasion : <b>${cl.evasion}</b></span>
        <span>Stress : <b>6</b></span>
        <span>Espoir : <b>2</b></span>
      </div>
    </div>`;

  $('#f-name', body).addEventListener('input', e => { wiz.name = e.target.value; });
  $('#f-pronouns', body).addEventListener('input', e => { wiz.pronouns = e.target.value; });
  $('#f-transformation', body).addEventListener('change', e => { wiz.transformation = e.target.value; });
  $$('textarea[data-q]', body).forEach(t => {
    t.addEventListener('input', e => { wiz.answers[+t.dataset.q] = e.target.value; });
  });
}

/* ================= FINISH ================= */
async function finish(main) {
  const classes = await data('classes');
  const ancestries = await data('ancestries');
  const armors = await data('armors');
  const weapons = await data('weapons');
  const cl = classes.find(c => c.id === wiz.classId);
  const anc = ancestries.find(a => a.id === wiz.ancestryId);
  const communities = await data('communities');
  const com = communities.find(c => c.id === wiz.communityId);
  const subclasses = await data('subclasses');
  const generalItems = await data('generalItems');
  const sub = subclasses.find(s => s.id === wiz.subclassId);
  const armor = armors.find(a => a.id === wiz.armorId);
  const anc2 = wiz.mixedAncestry ? ancestries.find(a => a.id === wiz.ancestry2Id) : null;

  let finalAncestry = anc ? { id: anc.id, fr: anc.fr, abilities: anc.abilities } : null;
  let heritageLabel = anc?.fr || '';
  if (wiz.mixedAncestry && anc && anc2) {
    const primary = wiz.mixedFirstFrom === 2 ? anc2 : anc;
    const secondary = wiz.mixedFirstFrom === 2 ? anc : anc2;
    const chosenAbilities = [primary.abilities?.[0], secondary.abilities?.[1]].filter(Boolean);
    heritageLabel = wiz.mixedName.trim() || `${anc.fr}-${anc2.fr}`;
    finalAncestry = {
      id: `${anc.id}+${anc2.id}`,
      fr: heritageLabel,
      abilities: chosenAbilities,
    };
  }

  /* détection bilingue : les aptitudes sont nommées en FR (mode FR) ou EN (mode EN).
     Map : nom FR -> équivalent EN (SRD 2.0). */
  const ABILITY_ALIASES = {
    'Endurance': ['Endurance'],
    'Endurance élevée': ['High Stamina'],
    'Résilience élevée': ['High Stamina'],
    'Leste': ['Nimble'],
  };
  const hasAbility = (frName) => (finalAncestry?.abilities || []).some(
    ab => ab.fr === frName || ABILITY_ALIASES[frName]?.includes(ab.fr)
  );
  const hpMax = cl.hp + (hasAbility('Endurance') ? 1 : 0);
  const stressMax = 6 + (hasAbility('Endurance élevée') ? 1 : 0);
  const evade = cl.evasion + (hasAbility('Leste') ? 1 : 0);

  const isBeastbound = sub?.en === 'Beastbound' || sub?.id === 'TIUsIlTS1WkK5vr2';
  const companionInit = isBeastbound ? {
    name: 'Compagnon animal',
    species: 'Louveteau / Faucon / Lynx…',
    evasion: 10,
    dice: 'd6',
    range: 'Mêlée',
    dmgType: 'phy',
    attackName: 'Attaque coordonnée',
    stress: { max: 3, current: 0 },
    experiences: [{ name: 'Pistage', mod: 2 }, { name: 'Protection', mod: 2 }],
    upgrades: [],
  } : null;

  const startingItem = (id, qty, type, fallbackName, fallbackDesc) => {
    const def = generalItems.find(x => x.id === id);
    return {
      name: def?.fr || fallbackName,
      qty,
      type,
      desc: def ? (def.descFr || def.desc || def.descEn || '') : fallbackDesc,
      itemId: id,
    };
  };
  const startingInventory = [
    startingItem('z3qzQoThgcZafEZr', 1, 'loot', 'Torche', "Torche d'aventure classique permettant d'éclairer les lieux sombres."),
    startingItem('ocBTBdfvjTqIehtf', 1, 'loot', 'Corde (15 m)', '15 mètres de corde robuste, utile pour escalader une paroi ou descendre une falaise en rappel.'),
    startingItem('jga6tUNjZjTpK6td', 1, 'loot', 'Fournitures de base', 'Nécessaire de voyage standard : couverture, boîte à amadou, rations, outre et matériel courant.'),
    wiz.startingPotion === 'stamina'
      ? startingItem('b6vGSPFWOlzZZDLO', 1, 'consumable', 'Potion de résilience mineure', 'Effacez 1d4 Stress.')
      : startingItem('tPfKtKRRjv8qdSqy', 1, 'consumable', 'Potion de santé mineure', 'Effacez 1d4 PV.'),
  ];

  const c = newCharacter({
    name: wiz.name.trim(),
    pronouns: wiz.pronouns.trim(),
    classId: wiz.classId,
    subclassId: wiz.subclassId,
    ancestry: finalAncestry,
    mixedAncestry: wiz.mixedAncestry && anc && anc2 ? { primaryId: anc.id, secondaryId: anc2.id, firstFrom: wiz.mixedFirstFrom } : null,
    community: com ? { id: com.id, fr: com.fr, ability: com.ability } : null,
    subclassName: sub?.fr || null,
    heritage: heritageLabel,
    subclassText: sub?.fr || '',
    transformation: wiz.transformation || '',
    companion: companionInit,
    traits: { ...wiz.traits },
    experiences: wiz.experiences.map(e => ({ name: e.name.trim(), mod: 2 })),
    hp: { max: hpMax, current: hpMax, active: hpMax, unlocked: 0 },
    stress: { max: stressMax, current: 0, active: stressMax, unlocked: 0 },
    hope: { max: 6, current: 2 },
    evasion: evade,
    thresholds: { bonus: 0 },
    armorSlots: { max: 12, used: 0 },
    primaryWeaponId: wiz.primaryWeaponId,
    secondaryWeaponId: wiz.secondaryWeaponId,
    armorId: wiz.armorId,
    weapons: [
      ...(weapons.find(w => w.id === wiz.primaryWeaponId) ? [{
        uid: uid(), compendiumId: wiz.primaryWeaponId,
        name: weapons.find(w => w.id === wiz.primaryWeaponId).fr,
        trait: weapons.find(w => w.id === wiz.primaryWeaponId).trait,
        range: weapons.find(w => w.id === wiz.primaryWeaponId).range,
        dice: weapons.find(w => w.id === wiz.primaryWeaponId).dice,
        dmgBonus: weapons.find(w => w.id === wiz.primaryWeaponId).dmgBonus || 0,
        dmgType: weapons.find(w => w.id === wiz.primaryWeaponId).dmgType,
        feature: weapons.find(w => w.id === wiz.primaryWeaponId).desc || '',
        hands: weapons.find(w => w.id === wiz.primaryWeaponId).burden === 'twoHanded' ? 'two' : 'one',
        state: 'active', primary: true, secondary: false,
      }] : []),
      ...(wiz.secondaryWeaponId && weapons.find(w => w.id === wiz.secondaryWeaponId) ? [{
        uid: uid(), compendiumId: wiz.secondaryWeaponId,
        name: weapons.find(w => w.id === wiz.secondaryWeaponId).fr,
        trait: weapons.find(w => w.id === wiz.secondaryWeaponId).trait,
        range: weapons.find(w => w.id === wiz.secondaryWeaponId).range,
        dice: weapons.find(w => w.id === wiz.secondaryWeaponId).dice,
        dmgBonus: weapons.find(w => w.id === wiz.secondaryWeaponId).dmgBonus || 0,
        dmgType: weapons.find(w => w.id === wiz.secondaryWeaponId).dmgType,
        feature: weapons.find(w => w.id === wiz.secondaryWeaponId).desc || '',
        hands: weapons.find(w => w.id === wiz.secondaryWeaponId).burden === 'twoHanded' ? 'two' : 'one',
        state: 'active', primary: false, secondary: true,
      }] : []),
    ],
    armorCard: armor
      ? { compendiumId: armor.id, name: armor.fr, baseScore: armor.armorScore, baseMajor: armor.major, baseSevere: armor.severe, feature: armor.desc || '' }
      : { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' },
    domainCards: wiz.cardIds.map((id, i) => ({ cardId: id, inHand: i < 5 })),
    goldTrack: { handfuls: 1, bags: 0, chests: 0 },
    journal: [],
    inventory: startingInventory,
    backgroundAnswers: { ...wiz.answers },
    className: cl.fr, hopeAbility: { name: cl.hopeAbility, desc: cl.hopeDesc },
  });
  /* Pré-remplissage SRD 2.0 : aptitudes de classe + carte de Fondation de sous-classe (niveau 1). */
  const classFeatLines = (cl?.features || []).map(f => `• ${f.name} — ${f.desc}`);
  const subFoundationLine = sub?.features?.[0] ? `✦ ${sub.features[0].name} — ${sub.features[0].desc}` : '';
  if (subFoundationLine) c.subcardCount = 1;
  c.classFeature = [...classFeatLines, ...(subFoundationLine ? [subFoundationLine] : [])].join('\n\n');
  c.customClassFeature = false;
  saveChar(c);
  wiz = null;
  toast(`✦ ${c.name} est prêt pour l'aventure !`);
  go('sheet', c.id);
}
