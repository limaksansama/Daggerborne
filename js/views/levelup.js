/* Montée en niveau — assistant interactif en 5 étapes (wizard).
   Règles (livre FR, chap. 2) : récompense de palier aux niveaux 2/5/8
   (nouvelle Expérience à +2, +1 Maîtrise, et aux niveaux 5/8 les coches de
   traits sont effacées) ; seuils de dégâts +1 automatique ; deux
   améliorations au choix parmi les options du palier ; une carte de domaine
   obligatoire ; un échange de carte facultatif.
   Interface : en-tête fixe avec barre de progression, corps défilant unique,
   pied sticky ; geste retour Android = étape précédente (popstate). */
import { $, $$, el, esc, data, toast, saveChar, T, addToHand } from '../core.js';

import { t } from '../i18n.js';
export const LEVELUP_OPTIONS = {
  attributes: 'Gagnez un bonus de +1 à deux traits non cochés, puis cochez-les.',
  hitPointSlots: 'Gagnez de façon permanente un emplacement de PV.',
  stressSlots: 'Gagnez de façon permanente un emplacement de Stress.',
  experiences: 'Gagnez de façon permanente un bonus de +1 à deux Expériences.',
  domainCard: 'Choisissez une carte de domaine supplémentaire de votre niveau ou inférieur dans un domaine accessible.',
  evasion: 'Gagnez de façon permanente un bonus de +1 à votre Évasion.',
  subclass: 'Prenez une carte de sous-classe améliorée. Rayez ensuite l\'option de Multiclassage pour ce palier.',
  proficiency: 'Augmentez votre Maîtrise de +1. (Option à double coût : elle consomme vos 2 points d\'amélioration.)',
  multiclass: 'Multiclassage : choisissez une classe supplémentaire. Rayez l\'option « carte de sous-classe » et l\'autre multiclassage de ce palier.',
};
/* structure du wizard : une seule fonction render() qui redessine l'étape courante */
const TIER_OF = (lvl) => (lvl <= 1 ? 1 : lvl <= 4 ? 2 : lvl <= 7 ? 3 : 4);
const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
/* fonction (et non constante) : le titre doit suivre la langue courante */
const stepTitles = () => ['Récompense de palier', 'Améliorations', 'Carte(s) de domaine', 'Échange de carte', t('createResume')];

/* ---------- validation ---------- */
export function traitsAvailable(c) {
  return TRAIT_KEYS.filter(k => !c.traitMarks?.includes(k));
}
export function canLevelUp(c) { return c.level < 10; }

/* compteur d'utilisation d'une option sur le palier en cours (affiché [n/N]) */
function tierCounts(c, newTier) {
  const t = c.tierUses?.[newTier] || {};
  return {
    attributes: [t.attributes || 0, 3],
    hitPointSlots: [t.hitPointSlots || 0, 2],
    stressSlots: [t.stressSlots || 0, 2],
    experiences: [t.experiences || 0, 2],
    domainCard: [t.domainCard || 0, 1],
    evasion: [t.evasion || 0, 1],
    subclass: [t.subclass || 0, 1],
    proficiency: [t.proficiency || 0, 1],
    multiclass: [t.multiclass || 0, 1],
  };
}

/* ---------- WIZARD ---------- */
/* drapeau synchrone module : un seul wizard à la fois. Un check DOM ne suffit pas :
   entre le 1er clic et l'ajout de la modal il y a un await data() pendant lequel
   un 2e clic (double-tap mobile) passe aussi le garde-fou. */
let lvlupOpen = false;

export async function openLevelUp(c, ctx) {
  if (lvlupOpen) return;
  lvlupOpen = true;
  try {
    await runLevelUpWizard(c, ctx);
  } catch (e) {
    /* échec du chargement/setup : libère le drapeau, sinon plus aucune montée
       de niveau ne serait possible jusqu'au rechargement */
    lvlupOpen = false;
    throw e;
  }
}

async function runLevelUpWizard(c, ctx) {
  const classes = await data('classes');
  const subclasses = await data('subclasses');
  const cards = await data('domainCards');
  const domains = await data('domains');
  const cl = classes.find(x => x.id === c.classId);
  const newLevel = c.level + 1;
  const newTier = TIER_OF(newLevel);
  const reward = newLevel === 2 || newLevel === 5 || newLevel === 8;

  const wiz = {
    step: 1,                       /* étape courante 1..5 */
    expName: '',                   /* ét.1 : nom de la nouvelle Expérience */
    choices: [],                   /* ét.2 : ids d'options (2 points) */
    traitPicks: [],                /* ét.2 : 2 traits pour 'attributes' */
    expPicks: [],                  /* ét.2 : 2 indices d'Expériences */
    profChecks: 0,                 /* ét.2 : cases Maîtrise cochées (0..2) */
    multiclassId: null,
    mcDomain: null,                /* domaine choisi pour la classe secondaire */
    cardPicks: [],                 /* ét.3 : ids de cartes sélectionnées */
    swapIndex: null,               /* ét.4 : index de carte à échanger */
    swapPick: null,                /* ét.4 : id de la carte de remplacement */
    q: '', domFilter: '', lvlFilter: '',
    openCard: null,                /* accordéon : id de carte dépliée */
    openSwapList: null,            /* ét.4 : index de carte dont la liste est dépliée */
  };
  /* quota de cartes pour l'étape 3 : 1 par défaut, 2 si l'option domainCard est prise */
  const cardQuota = () => (wiz.choices.filter(x => x === 'domainCard').length ? 2 : 1);
  /* points d'amélioration consommés : 1 par option, Maîtrise = 2 (via ses deux cases),
     Multiclassage = 2 (option à double coût) */
  const pts = () => wiz.choices.filter(x => x !== 'proficiency' && x !== 'multiclass').length
    + (wiz.choices.includes('proficiency') ? wiz.profChecks : 0)
    + (wiz.choices.includes('multiclass') ? 2 : 0);
  /* validité de l'étape 2 */
  const step2Valid = () => pts() === 2
    && (!wiz.choices.includes('proficiency') || wiz.profChecks === 2)
    && (!wiz.choices.includes('attributes') || wiz.traitPicks.length === 2)
    && (!wiz.choices.includes('experiences') || wiz.expPicks.length === 2)
    && (!wiz.choices.includes('multiclass') || (!!wiz.multiclassId && !!wiz.mcDomain))
    && !(wiz.choices.includes('multiclass') && wiz.choices.includes('subclass'));
  /* liste d'Expériences incluant celle créée à l'étape 1 */
  const expList = () => {
    const list = c.experiences.map((e, i) => ({ ...e, idx: i }));
    if (reward && wiz.expName.trim()) list.push({ name: wiz.expName.trim(), mod: 2, idx: list.length, isNew: true });
    return list;
  };
  const ownedIds = () => c.domainCards.map(x => x.cardId);
  /* domaines accessibles : ceux de la classe (+ domaines de multiclassage déjà acquis),
     et dès le palier courant le domaine choisi via l'option multiclassage (sélectionnable
     à l'étape 3 de la même montée de niveau). */
  const myDomains = () => {
    const d = [...(cl?.domains || [])];
    if (c.extraDomains?.length) d.push(...c.extraDomains);
    if (wiz.choices.includes('multiclass') && wiz.mcDomain && !d.includes(wiz.mcDomain)) d.push(wiz.mcDomain);
    return d;
  };
  /* niveau max des cartes d'un domaine : pleine puissance pour les domaines
     de classe, plafonné à ceil(niveau/2) pour les domaines de multiclassage */
  const domainLevelCap = (dom) => {
    if (cl?.domains?.includes(dom)) return newLevel;
    if (c.extraDomains?.includes(dom) || dom === wiz.mcDomain) return Math.ceil(newLevel / 2);
    return newLevel;
  };

  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-lvlup"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);

  /* ---- historique : un état poussé à chaque étape ; retour Android = étape précédente ---- */
  let closed = false;
  const pushHist = () => { try { history.pushState({ dhLvl: wiz.step }, ''); } catch (e) { /* noop */ } };
  const onPop = (e) => {
    if (closed) return;
    if (e.state && Number.isInteger(e.state.dhLvl) && e.state.dhLvl >= 1 && e.state.dhLvl <= 5) {
      wiz.step = e.state.dhLvl;
      render(true);
    } else {
      close(true);
    }
  };
  const onHash = () => close(true);
  window.addEventListener('popstate', onPop);
  window.addEventListener('hashchange', onHash);
  const close = (fromExternal) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('hashchange', onHash);
    lvlupOpen = false;
    /* remonte l'historique jusqu'à l'état d'avant le wizard (une entrée par étape) */
    if (!fromExternal && history.state?.dhLvl) { try { history.go(-wiz.step); } catch (e) { /* noop */ } }
    back.remove();
  };
  back.addEventListener('click', (e) => { if (e.target === back) close(false); });

  /* ---------- pied de page : boutons selon l'étape ---------- */
  const footer = () => {
    const prev = wiz.step === 1
      ? `<button class="btn ghost" data-lu-prev>Annuler</button>`
      : `<button class="btn ghost" data-lu-prev>${t('lvlPrev')}</button>`;
    let main = '', mainDis = false, mainAct = 'next';
    if (wiz.step === 1) { main = 'Suivant'; mainDis = !!(reward && !wiz.expName.trim()); }
    else if (wiz.step === 2) {
      main = 'Suivant';
      mainDis = !step2Valid(); /* Maîtrise double coût : 2 points via ses cases */
    }
    else if (wiz.step === 3) { main = 'Suivant'; mainDis = wiz.cardPicks.length !== cardQuota(); }
    else if (wiz.step === 4) { main = wiz.swapIndex === null ? 'Passer cette étape' : 'Suivant'; mainAct = wiz.swapIndex === null ? 'skip' : 'next'; mainDis = wiz.swapIndex !== null && !wiz.swapPick; }
    else { main = 'Appliquer la montée de niveau'; mainAct = 'apply'; }
    return `<div class="lu-foot">
      ${prev}
      <button class="btn" data-lu-main data-act="${mainAct}" ${mainDis ? 'disabled' : ''}>${main}</button>
    </div>`;
  };

  /* ---------- barre de progression ---------- */
  const progress = () => `
    <div class="lu-prog">
      ${[1, 2, 3, 4, 5].map(n => `
        <div class="lu-pseg ${n <= wiz.step ? 'on' : ''} ${n === wiz.step ? 'cur' : ''}"></div>`).join('')}
      <span class="lu-plbl">Étape ${wiz.step}/5 · ${esc(stepTitles()[wiz.step - 1])}</span>
    </div>`;

  /* ================= RENDER ================= */
  const render = (resetScroll = false) => {
    const prevBody = $('.lu-body', sheet);
    const prevScroll = prevBody ? prevBody.scrollTop : 0;
    const availTraits = traitsAvailable(c);
    const counts = tierCounts(c, newTier);
    const head = `
      <div class="lu-head">
        <h3>Montée en niveau ${c.level} → ${newLevel}</h3>
        <div class="ms-meta">${T.tiers[newTier]} · ${esc(cl?.fr || '')}${c.subclassId ? ' · ' + esc(subclasses.find(s => s.id === c.subclassId)?.fr || '') : ''}</div>
        ${progress()}
      </div>`;

    let body = '';
    /* ---------------- ÉTAPE 1 : récompense ---------------- */
    if (wiz.step === 1) {
      body = `
      <div class="lu-reward">
        <div class="lu-r-head">★ Récompense de niveau ${newLevel}</div>
        <ul class="lu-r-list">
          <li>✦ Seuils de dégâts : <b>+1</b> automatique (Mineur · Majeur · Sévère)</li>
          ${reward ? `
          <li>✦ Gagnez une <b>Expérience supplémentaire</b> à <b>+2</b> — nommez-la ci-dessous</li>
          <li>✦ <b>+1 Maîtrise</b> permanent (dé de dégâts : ${c.proficiency + 1})</li>
          ${newLevel !== 2 ? '<li>✦ Effacez toutes les <b>' + t('lvlTradeMarkChk') + '</b> (ils redeviennent améliorables)</li>' : ''}` : ''}
        </ul>
      </div>
      ${reward ? `
      <div class="lu-sub">
        <div class="lu-sub-lbl">Nouvelle Expérience (+2)</div>
        <input type="text" class="lu-input" id="lu-expname" placeholder="Ex. « J'ai vécu parmi les loups »" value="${esc(wiz.expName)}" autocomplete="off">
        <div class="lu-hint">Elle sera immédiatement disponible pour vos choix de l'étape suivante.</div>
      </div>` : ''}`;
    }
    /* ---------------- ÉTAPE 2 : améliorations ---------------- */
    else if (wiz.step === 2) {
      body = `
      <div class="lu-count">Points d'amélioration : <b>${pts()} / 2</b></div>
      <div class="lu-opts">
        ${Object.entries(LEVELUP_OPTIONS).filter(([id]) => {
          if (id === 'subclass' && (c.multiclassed || c.subcardTaken?.[newTier] || wiz.choices.includes('multiclass'))) return false;
          if (id === 'multiclass' && (c.multiclassed || newTier < 3 || c.subcardTaken?.[newTier] || wiz.choices.includes('subclass'))) return false;
          return true;
        }).map(([id, label]) => {
          const selCount = id === 'proficiency' ? wiz.profChecks : wiz.choices.filter(x => x === id).length;
          const isPicked = wiz.choices.includes(id);
          const maxSel = id === 'proficiency' ? 2 : 1;
          const used = counts[id];
          const noTraitLeft = id === 'attributes' && availTraits.length < 2;
          const hasDoubleCost = wiz.choices.includes('proficiency') || wiz.choices.includes('multiclass');
          const noRoom = !isPicked && (pts() >= 2 || hasDoubleCost || ((id === 'multiclass' || id === 'proficiency') && wiz.choices.length > 0));
          const full = selCount >= maxSel || noTraitLeft || used[0] >= used[1] || noRoom;
          return `<button class="lu-opt ${isPicked ? 'sel' : ''}" data-luopt="${id}" ${full ? 'disabled' : ''}>
            <span class="lo-check">${isPicked ? '✓' : ''}</span>
            <span class="lo-txt">${label}<span class="lo-use">[${used[0]}/${used[1]}]</span></span>
          </button>`;
        }).join('')}
      </div>
      ${wiz.choices.includes('attributes') ? `
      <div class="lu-sub">
        <div class="lu-sub-lbl" data-lucnt="attributes">Deux traits non cochés (+1 chacun) — ${wiz.traitPicks.length}/2</div>
        <div class="lu-traitpick">
          ${TRAIT_KEYS.map(k => {
            const marked = c.traitMarks?.includes(k);
            const picked = wiz.traitPicks.includes(k);
            return `<button class="lu-tp ${picked ? 'sel' : ''}" data-lutrait="${k}" ${marked ? 'disabled' : ''}>
              ${T.traits[k]} ${c.traits[k] >= 0 ? '+' : ''}${c.traits[k]}${marked ? ' · coché' : ''}</button>`;
          }).join('')}
        </div>
      </div>` : ''}
      ${wiz.choices.includes('experiences') ? `
      <div class="lu-sub">
        <div class="lu-sub-lbl" data-lucnt="experiences">Deux Expériences (+1 chacune) — ${wiz.expPicks.length}/2</div>
        <div class="lu-exppick">
          ${expList().map(e => `
            <button class="lu-tp ${wiz.expPicks.includes(e.idx) ? 'sel' : ''}" data-luexp="${e.idx}" ${!e.name.trim() ? 'disabled' : ''}>
              ${esc(e.name) || '—'} (+${e.mod} → +${e.mod + 1})${e.isNew ? ' · nouvelle' : ''}</button>`).join('')}
        </div>
      </div>` : ''}
      ${wiz.choices.includes('proficiency') ? `
      <div class="lu-sub">
        <div class="lu-sub-lbl">${t('lvlMasteryDouble')}</div>
        <div class="lu-traitpick">
          ${[1, 2].map(n => `<button class="lu-tp ${wiz.profChecks >= n ? 'sel' : ''}" data-luprof="${n}">Case ${n} · +1 Maîtrise</button>`).join('')}
        </div>
      </div>` : ''}
      ${wiz.choices.includes('multiclass') ? `
      <div class="lu-sub">
        <div class="lu-sub-lbl">${t('lvlMulticlassLbl')}</div>
        <div class="lu-traitpick">
          ${classes.filter(x => x.id !== c.classId).map(x => `
            <button class="lu-tp ${wiz.multiclassId === x.id ? 'sel' : ''}" data-lumc="${x.id}">${esc(x.fr)}</button>`).join('')}
        </div>
        ${wiz.multiclassId ? `
        <div class="lu-sub-lbl" style="margin-top:.7rem">Domaine de la classe secondaire (cartes accessibles jusqu'au niveau ${Math.ceil(newLevel / 2)})</div>
        <div class="lu-traitpick">
          ${(classes.find(x => x.id === wiz.multiclassId)?.domains || []).map(d => `
            <button class="lu-tp ${wiz.mcDomain === d ? 'sel' : ''}" data-lumcd="${d}">${esc(domains[d]?.fr || d)}</button>`).join('')}
        </div>
        <div class="lu-hint">Vous gagnez la capacité de classe de la classe secondaire et l'accès aux cartes de ce domaine.</div>` : ''}
      </div>` : ''}`;
    }
    /* ---------------- ÉTAPE 3 : cartes de domaine ---------------- */
    else if (wiz.step === 3) {
      const dNames = myDomains().map(d => domains[d]?.fr || d).join(' · ');
      body = `
      <div class="lu-count">Cartes sélectionnées : <b>${wiz.cardPicks.length} / ${cardQuota()}</b></div>
      ${wiz.choices.includes('domainCard') ? '<div class="lu-hint">' + t('lvlTwoCardsOpt') + '</div>' : ''}
      <div class="search-bar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="text" id="lu-q" placeholder="${t('lvlSearchDomains')}" value="${esc(wiz.q)}" autocomplete="off">
      </div>
      <div class="lu-filters">
        ${myDomains().map(d => `<button class="lu-chip ${wiz.domFilter === d ? 'on' : ''}" data-ludom="${d}">${esc(domains[d]?.fr || d)}</button>`).join('')}
        <span class="lu-fsep"></span>
        ${['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].filter(l => !l || +l <= newLevel).map(l => `<button class="lu-chip ${wiz.lvlFilter === l ? 'on' : ''}" data-lulvl="${l}">${l === '' ? 'Tous niveaux' : 'Niv. ' + l}</button>`).join('')}
      </div>
      <div class="lu-cards" id="lu-cards">${renderCards()}</div>`;
    }
    /* ---------------- ÉTAPE 4 : échange ---------------- */
    else if (wiz.step === 4) {
      body = `
      <div class="lu-hint">Échange facultatif : remplacez une carte possédée par une autre de niveau égal ou inférieur à ${newLevel}. Un seul échange par montée de niveau.</div>
      <div class="lu-cards lu-flat">
        ${(c.domainCards || []).map((dc, i) => {
          const cd = cards.find(x => x.id === dc.cardId);
          if (!cd) return '';
          const sel = wiz.swapIndex === i;
          return `<div class="lu-card ${sel ? 'sel' : ''}" data-luswap="${i}">
            <div class="lc-row">
              <span class="lc-lvl">Niv. ${cd.level}</span>
              <span class="lc-body"><b>${esc(cd.fr)}</b><small>${esc(domains[cd.domain]?.fr || '')}${dc.inHand ? ' · en main' : ' · caveau'}</small></span>
              <span class="lc-add">${sel ? '✓' : '⇄'}</span>
            </div>
          </div>
          ${sel ? renderSwapChoices(i) : ''}`;
        }).join('') || '<div class="dh-help">' + t('lvlNoCardsOwned') + '</div>'}
      </div>`;
    }
    /* ---------------- ÉTAPE 5 : récapitulatif ---------------- */
    else {
      body = renderRecap();
    }

    sheet.innerHTML = `${head}<div class="lu-body">${body}</div>${footer()}`;
    bind();
    const b = $('.lu-body', sheet);
    if (b) b.scrollTop = resetScroll ? 0 : prevScroll;
  };

  /* ---------- rendu des cartes (étape 3, accordéon) ---------- */
  const renderCards = () => {
    const owned = ownedIds();
    const list = cards.filter(cd => myDomains().includes(cd.domain) && cd.level <= domainLevelCap(cd.domain) && !owned.includes(cd.id))
      .filter(cd => !wiz.domFilter || cd.domain === wiz.domFilter)
      .filter(cd => !wiz.lvlFilter || String(cd.level) === wiz.lvlFilter)
      .filter(cd => !wiz.q || (cd.fr + ' ' + cd.en).toLowerCase().includes(wiz.q.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.fr.localeCompare(b.fr, 'fr'));
    if (!list.length) return '<div class="dh-help">' + t('lvlNoCardsFilters') + '</div>';
    return list.map(cd => {
      const sel = wiz.cardPicks.includes(cd.id);
      const open = wiz.openCard === cd.id;
      return `<div class="lu-card ${sel ? 'sel' : ''} ${open ? 'open' : ''}" data-lucard="${cd.id}">
        <div class="lc-row" data-luacc="${cd.id}" title="${t('lvlClickExpand')}">
          <span class="lc-lvl">Niv. ${cd.level}</span>
          <span class="lc-body"><b>${esc(cd.fr)}</b><small>${esc(domains[cd.domain]?.fr || cd.domain)} · ${T.cardType[cd.type] || ''}</small></span>
          <span class="lc-chev" aria-hidden="true">${open ? '⌃' : '⌄'}</span>
          <button class="lc-add" data-lupick="${cd.id}" aria-label="${t('lvlSelect')}">${sel ? '✓' : '＋'}</button>
        </div>
        ${open ? `<div class="lc-detail">${esc(cd.desc || '')}<div class="lc-tags"><span class="lc-tag">${T.cardType[cd.type] || cd.type}</span>${cd.recall ? `<span class="lc-tag">Coût de rappel : ${cd.recall}</span>` : ''}</div></div>` : ''}
      </div>`;
    }).join('');
  };

  /* ---------- choix de remplacement (étape 4) ---------- */
  const renderSwapChoices = (swapIdx) => {
    const old = cards.find(x => x.id === c.domainCards[swapIdx]?.cardId);
    const exclude = new Set([...ownedIds(), ...wiz.cardPicks]);
    const list = cards.filter(cd => myDomains().includes(cd.domain) && cd.level <= domainLevelCap(cd.domain) && !exclude.has(cd.id))
      .sort((a, b) => a.level - b.level || a.fr.localeCompare(b.fr, 'fr'));
    return `<div class="lu-sub lu-swapbox">
      <div class="lu-sub-lbl">Remplacer « ${esc(old?.fr || '')} » par (niveau ≤ ${newLevel})</div>
      <div class="lu-swaplist">
        ${list.map(cd => `<button class="lu-tp ${wiz.swapPick === cd.id ? 'sel' : ''}" data-lunew="${cd.id}">Niv. ${cd.level} · ${esc(cd.fr)}</button>`).join('') || '<div class="dh-help">' + t('lvlNoCards') + '</div>'}
      </div>
    </div>`;
  };

  /* ---------- récapitulatif (étape 5) ---------- */
  const renderRecap = () => {
    const lines = [];
    const th = (s) => `<div class="lu-r-head">${s}</div>`;
    /* niveaux & seuils */
    lines.push(th('Niveau et défenses'));
    lines.push(`<div class="lu-rec-line">Niveau : <b>${c.level} → ${newLevel}</b> · Seuils de dégâts : <b>+1</b> (Mineur · Majeur · Sévère)</div>`);
    /* stats */
    const stats = [];
    if (reward) stats.push(`Maîtrise : <b>${c.proficiency} → ${Math.min(6, c.proficiency + 1)}</b> (récompense)`);
    for (const id of wiz.choices) {
      if (id === 'hitPointSlots') stats.push(`PV max : <b>${c.hp.active + (c.hp.unlocked || 0)} → ${c.hp.active + (c.hp.unlocked || 0) + 1}</b>`);
      if (id === 'stressSlots') stats.push(`Stress max : <b>${c.stress.active + (c.stress.unlocked || 0)} → ${c.stress.active + (c.stress.unlocked || 0) + 1}</b>`);
      if (id === 'evasion') stats.push(`Évasion : <b>${c.evasion} → ${Math.min(30, c.evasion + 1)}</b>`);
      if (id === 'proficiency') stats.push(`Maîtrise : <b>${c.proficiency} → ${Math.min(6, c.proficiency + 1)}</b> (double coût)`);
      if (id === 'multiclass') {
        const mc = classes.find(x => x.id === wiz.multiclassId);
        stats.push(`Multiclassage : <b>${esc(mc?.fr || '—')}</b> · domaine ${esc(domains[wiz.mcDomain]?.fr || wiz.mcDomain || '—')} (cartes jusqu'au niv. ${Math.ceil(newLevel / 2)})`);
      }
    }
    if (stats.length) { lines.push(th('Statistiques')); lines.push(...stats.map(s => `<div class="lu-rec-line">${s}</div>`)); }
    /* traits */
    if (wiz.choices.includes('attributes')) {
      lines.push(th('Traits'));
      lines.push(`<div class="lu-rec-line">${wiz.traitPicks.map(k => `${T.traits[k]} : <b>+${c.traits[k]} → +${c.traits[k] + 1}</b>`).join(' · ')}</div>`);
    }
    /* expériences */
    const exps = [];
    if (reward && wiz.expName.trim()) exps.push(`Nouvelle Expérience : <b>« ${esc(wiz.expName.trim())} »</b> à +2`);
    if (wiz.choices.includes('experiences')) {
      exps.push(...wiz.expPicks.map(i => {
        const e = expList()[i];
        return e ? `${esc(e.name)} : <b>+${e.mod} → +${e.mod + 1}</b>` : '';
      }).filter(Boolean));
    }
    if (exps.length) { lines.push(th('Expériences')); lines.push(...exps.map(s => `<div class="lu-rec-line">${s}</div>`)); }
    /* cartes */
    const cardLines = [];
    for (const id of wiz.cardPicks) {
      const cd = cards.find(x => x.id === id);
      if (cd) cardLines.push(`Ajout : <b>${esc(cd.fr)}</b> · ${esc(domains[cd.domain]?.fr || '')} · Niv. ${cd.level}${wiz.choices.includes('domainCard') ? ' (dont 1 via l\'option supplémentaire)' : ''}`);
    }
    if (wiz.swapIndex !== null && wiz.swapPick) {
      const old = cards.find(x => x.id === c.domainCards[wiz.swapIndex]?.cardId);
      const nw = cards.find(x => x.id === wiz.swapPick);
      if (old && nw) cardLines.push(`Échange : <b>${esc(old.fr)}</b> ⇄ <b>${esc(nw.fr)}</b>`);
    }
    if (cardLines.length) { lines.push(th('Cartes de domaine')); lines.push(...cardLines.map(s => `<div class="lu-rec-line">${s}</div>`)); }
    return `<div class="lu-recap">${lines.join('')}</div>`;
  };

  /* ================= BIND ================= */
  const bind = () => {
    /* saisie Expérience (étape 1) */
    const nameIn = $('#lu-expname', sheet);
    if (nameIn) {
      nameIn.addEventListener('input', () => {
        wiz.expName = nameIn.value;
        $('[data-lu-main]', sheet).disabled = !nameIn.value.trim();
      });
    }
    /* options (étape 2) */
    $$('[data-luopt]', sheet).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.luopt;
      if (wiz.choices.includes(id)) {
        wiz.choices = wiz.choices.filter(x => x !== id);
        if (id === 'proficiency') wiz.profChecks = 0;
        if (id === 'attributes') wiz.traitPicks = [];
        if (id === 'experiences') wiz.expPicks = [];
        if (id === 'multiclass') { wiz.multiclassId = null; wiz.mcDomain = null; }
      } else {
        /* exclusion mutuelle Multiclassage ↔ Carte de sous-classe pour ce palier */
        if (id === 'multiclass' && wiz.choices.includes('subclass')) {
          toast('Le multiclassage remplace l\'option « carte de sous-classe » pour ce palier.');
          return;
        }
        if (id === 'subclass' && wiz.choices.includes('multiclass')) {
          toast('La carte de sous-classe remplace le multiclassage pour ce palier.');
          return;
        }
        /* options à double coût : ne prennent la main que si aucun point n'est pris */
        if ((id === 'multiclass' || id === 'proficiency') && wiz.choices.length > 0) {
          toast('Cette option à double coût consomme vos 2 points d\'amélioration.');
          return;
        }
        if (pts() >= 2 || wiz.choices.includes('proficiency') || wiz.choices.includes('multiclass')) {
          toast('Vos 2 points d\'amélioration sont déjà alloués.');
          return;
        }
        wiz.choices.push(id);
        if (id === 'proficiency') wiz.profChecks = 0; /* repart à zéro : l'utilisateur coche ses deux cases */
      }
      render();
    }));
    /* cases Maîtrise (double coût) */
    $$('[data-luprof]', sheet).forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.luprof;
      wiz.profChecks = wiz.profChecks >= n ? n - 1 : n;
      $$('[data-luprof]', sheet).forEach(x => x.classList.toggle('sel', wiz.profChecks >= +x.dataset.luprof));
      updatePoints();
      updateMain();
    }));
    /* sélecteurs de traits / expériences / multiclassage */
    $$('[data-lutrait]', sheet).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.lutrait;
      const at = wiz.traitPicks.indexOf(k);
      if (at >= 0) wiz.traitPicks.splice(at, 1);
      else { if (wiz.traitPicks.length >= 2) return; wiz.traitPicks.push(k); }
      b.classList.toggle('sel', wiz.traitPicks.includes(k));
      const cnt = $('[data-lucnt="attributes"]', sheet);
      if (cnt) cnt.textContent = `Deux traits non cochés (+1 chacun) — ${wiz.traitPicks.length}/2`;
      updateMain();
    }));
    $$('[data-luexp]', sheet).forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.luexp;
      const at = wiz.expPicks.indexOf(i);
      if (at >= 0) wiz.expPicks.splice(at, 1);
      else { if (wiz.expPicks.length >= 2) return; wiz.expPicks.push(i); }
      b.classList.toggle('sel', wiz.expPicks.includes(i));
      const cnt = $('[data-lucnt="experiences"]', sheet);
      if (cnt) cnt.textContent = `Deux Expériences (+1 chacune) — ${wiz.expPicks.length}/2`;
      updateMain();
    }));
    $$('[data-lumc]', sheet).forEach(b => b.addEventListener('click', () => {
      if (wiz.multiclassId !== b.dataset.lumc) wiz.mcDomain = null; /* changement de classe → domaine à rechoisir */
      wiz.multiclassId = b.dataset.lumc;
      render();
    }));
    $$('[data-lumcd]', sheet).forEach(b => b.addEventListener('click', () => {
      wiz.mcDomain = b.dataset.lumcd;
      updateMain();
      $$('[data-lumcd]', sheet).forEach(x => x.classList.toggle('sel', x.dataset.lumcd === wiz.mcDomain));
    }));
    /* recherche + filtres (étape 3) */
    const q = $('#lu-q', sheet);
    if (q) {
      q.addEventListener('input', () => { wiz.q = q.value; refreshCards(); });
      q.focus();
    }
    $$('[data-ludom]', sheet).forEach(b => b.addEventListener('click', () => { wiz.domFilter = wiz.domFilter === b.dataset.ludom ? '' : b.dataset.ludom; render(); }));
    $$('[data-lulvl]', sheet).forEach(b => b.addEventListener('click', () => { wiz.lvlFilter = wiz.lvlFilter === b.dataset.lulvl ? '' : b.dataset.lulvl; render(); }));
    /* accordéon + sélection (étape 3) — délégation : le DOM des cartes est régénéré */
    const cardsBox = $('#lu-cards', sheet);
    if (cardsBox) {
      cardsBox.addEventListener('click', (e) => {
        const acc = e.target.closest('[data-luacc]');
        const pick = e.target.closest('[data-lupick]');
        if (pick) {
          const id = pick.dataset.lupick;
          const at = wiz.cardPicks.indexOf(id);
          if (at >= 0) wiz.cardPicks.splice(at, 1);
          else {
            if (wiz.cardPicks.length >= cardQuota()) { toast(`Maximum : ${cardQuota()} carte(s).`); return; }
            wiz.cardPicks.push(id);
            if (wiz.swapPick === id) {
              wiz.swapPick = null;
              toast('Échange réinitialisé (carte sélectionnée à l’étape 3).');
            }
          }
          refreshCards();
          updateMain();
          updateCardCount();
          return;
        }
        if (acc) { wiz.openCard = wiz.openCard === acc.dataset.luacc ? null : acc.dataset.luacc; refreshCards(); }
      });
    }
    /* échange (étape 4) */
    $$('[data-luswap]', sheet).forEach(elm => elm.addEventListener('click', () => {
      const i = +elm.dataset.luswap;
      wiz.swapIndex = wiz.swapIndex === i ? null : i;
      wiz.swapPick = null;
      render();
    }));
    $$('[data-lunew]', sheet).forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      wiz.swapPick = wiz.swapPick === b.dataset.lunew ? null : b.dataset.lunew;
      render();
    }));
    /* footer */
    $$('[data-lu-prev]', sheet).forEach(b => b.addEventListener('click', () => {
      if (wiz.step === 1) { close(); return; }
      history.back(); /* popstate ramène à l'étape précédente */
    }));
    $$('[data-lu-main]', sheet).forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (b.disabled) return;
      if (act === 'apply') { finish(); return; }
      if (act === 'skip') { goto(wiz.step + 1); return; }
      /* validations locales avant d'avancer */
      if (wiz.step === 2) {
        if (wiz.choices.includes('attributes') && wiz.traitPicks.length !== 2) { toast('Choisissez deux traits non cochés.'); return; }
        if (wiz.choices.includes('experiences') && wiz.expPicks.length !== 2) { toast('Choisissez deux Expériences.'); return; }
        if (wiz.choices.includes('multiclass') && !wiz.multiclassId) { toast('Choisissez une classe de multiclassage.'); return; }
        if (wiz.choices.includes('multiclass') && !wiz.mcDomain) { toast('Choisissez un domaine de la classe secondaire.'); return; }
      }
      goto(wiz.step + 1);
    }));
  };

  /* changement d'étape : rendu + entrée d'historique (retour Android) */
  const goto = (n) => { wiz.step = n; render(true); pushHist(); };

  /* actualise uniquement la liste de cartes (préserve le focus de la recherche) */
  const refreshCards = () => { const b = $('#lu-cards', sheet); if (b) b.innerHTML = renderCards(); };
  /* actualise le compteur de cartes sélectionnées */
  const updateCardCount = () => {
    const cnt = $('.lu-count', sheet);
    if (cnt) cnt.innerHTML = `Cartes sélectionnées : <b>${wiz.cardPicks.length} / ${cardQuota()}</b>`;
  };
  /* ré-évalue l'état du bouton principal */
  /* actualise le compteur de points d'amélioration sans re-render */
  const updatePoints = () => {
    const cnt = $('.lu-count', sheet);
    if (cnt) cnt.innerHTML = `Points d'amélioration : <b>${pts()} / 2</b>`;
  };
  const updateMain = () => {
    const b = $('[data-lu-main]', sheet);
    if (!b) return;
    if (wiz.step === 1) b.disabled = !!(reward && !wiz.expName.trim());
    else if (wiz.step === 2) b.disabled = !step2Valid();
    else if (wiz.step === 3) b.disabled = wiz.cardPicks.length !== cardQuota();
    else if (wiz.step === 4) b.disabled = wiz.swapIndex !== null && !wiz.swapPick;
  };

  /* ================= APPLICATION ================= */
  const finish = () => {
    /* transaction atomique : on ne touche l'objet personnage qu'ici, en une passe */
    c.traitMarks = c.traitMarks || [];
    c.tierUses = c.tierUses || {};
    c.tierUses[newTier] = c.tierUses[newTier] || {};
    const tu = c.tierUses[newTier];
    /* 1. récompense de palier */
    let newExpIdx = -1;
    if (reward) {
      const free = c.experiences.findIndex(e => !e.name.trim());
      if (wiz.expName.trim()) {
        if (free >= 0) { c.experiences[free] = { name: wiz.expName.trim(), mod: 2 }; newExpIdx = free; }
        else { c.experiences.push({ name: wiz.expName.trim(), mod: 2 }); newExpIdx = c.experiences.length - 1; }
      }
      c.proficiency = Math.min(6, c.proficiency + 1);
      if (newLevel !== 2) c.traitMarks = [];
    }
    /* 2. améliorations */
    for (const id of wiz.choices) {
      tu[id] = (tu[id] || 0) + 1;
      if (id === 'attributes') wiz.traitPicks.forEach(k => { c.traits[k] = Math.min(9, c.traits[k] + 1); c.traitMarks.push(k); });
      if (id === 'hitPointSlots') {
        c.hp.active = Math.min(12, (c.hp.active || 6) + 1);
        c.hp.max = c.hp.active + (c.hp.unlocked || 0);
        c.hp.current = Math.min(c.hp.max, (c.hp.current || 0) + 1);
      }
      else if (id === 'stressSlots') { c.stress.active = Math.min(12, (c.stress.active || 6) + 1); c.stress.max = c.stress.active + (c.stress.unlocked || 0); }
      else if (id === 'experiences') wiz.expPicks.forEach(i => {
        const e = expList()[i];
        if (!e) return;
        const targetIdx = e.isNew ? newExpIdx : e.idx;
        if (targetIdx >= 0 && c.experiences[targetIdx]) {
          c.experiences[targetIdx].mod = Math.min(9, c.experiences[targetIdx].mod + 1);
        }
      });
      else if (id === 'evasion') c.evasion = Math.min(30, c.evasion + 1);
      else if (id === 'domainCard') { /* l'étape 3 permet une carte de plus */ }
      else if (id === 'subclass') {
        c.subcardTaken = { ...c.subcardTaken, [newTier]: true };
        const sub = subclasses.find(s => s.id === c.subclassId);
        const nextIdx = (c.subcardCount || 0);
        if (sub?.features?.[nextIdx]) {
          c.classFeature = (c.classFeature ? c.classFeature + '\n\n' : '') + `✦ ${sub.features[nextIdx].name} — ${sub.features[nextIdx].desc}`;
          c.subcardCount = nextIdx + 1;
        }
      }
      else if (id === 'proficiency') { /* incrémenté ci-dessous via wiz.profChecks — tu.proficiency déjà compté ci-dessus */ }
      else if (id === 'multiclass') {
        c.multiclassed = true;
        c.multiclassClassId = wiz.multiclassId;
        const mcClass = classes.find(x => x.id === wiz.multiclassId);
        if (mcClass) {
          /* SRD 2.0 : le multiclassage accorde la capacité de classe de la classe secondaire,
             pas son aptitude d'Espoir. */
          const mcFeats = (mcClass.features || []).map(f => `✦ ${f.name} — ${f.desc}`).join('\n');
          c.classFeature = (c.classFeature ? c.classFeature + '\n\n' : '') + `〔Multiclassage〕 ${mcClass.fr}${mcFeats ? '\n' + mcFeats : ''}`;
          if (wiz.mcDomain) {
            c.extraDomains = c.extraDomains || [];
            if (!c.extraDomains.includes(wiz.mcDomain)) c.extraDomains.push(wiz.mcDomain);
          }
        }
      }
    }
    /* Maîtrise : +1 unique si l'option à double coût est prise (les 2 cases valident les 2 points) */
    if (wiz.choices.includes('proficiency') && wiz.profChecks === 2) {
      c.proficiency = Math.min(6, c.proficiency + 1);
    }
    /* 3. niveau (les seuils s'ajustent automatiquement avec le niveau) */
    c.level = newLevel;
    /* 4. cartes de domaine (1 ou 2 selon l'option) — max 5 en main, l'excédent part au caveau */
    let overflow = 0;
    for (const id of wiz.cardPicks) { if (!addToHand(c, id)) overflow++; }
    if (overflow) toast(`${overflow} carte(s) placée(s) au caveau — 5 cartes en main maximum.`);
    /* 5. échange éventuel */
    if (wiz.swapIndex !== null && wiz.swapPick) {
      c.domainCards[wiz.swapIndex] = { cardId: wiz.swapPick, inHand: c.domainCards[wiz.swapIndex].inHand };
    }
    saveChar(c);
    close();
    toast(`★ Niveau ${c.level} atteint ! Seuils de dégâts : +1 · Maîtrise : ${c.proficiency} dé(s).`);
    if (ctx?.onDone) ctx.onDone();
  };

  render();
  pushHist();
}
