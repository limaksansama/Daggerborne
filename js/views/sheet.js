/* Fiche de personnage — placement calqué sur la feuille officielle Daggerheart :
   en-tête identité + badge Niveau · bande Évasion/Armure + 6 cartes de traits ·
   2 colonnes (Dégâts&Santé/Espoir/Expériences/Or/Aptitude || Armes/Armure/Inventaire).
   Thème sombre conservé, mobile = onglets Combat / Stats / Équipement / Plus. */
import { $, $$, el, esc, go, T, data, toast, getChar, saveChar, getState, setState, uid, exportJsonFile, importCharacterFromText } from '../core.js';
import { rollDuality, rollDice, rollAttack, rollDamage, isRolling } from '../dice3d.js';
import { computeDamageApplication, tierOf, nextDieStep } from '../rules.js';
import { openLevelUp } from './levelup.js';

const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const CONDITIONS = ['Vulnérable', 'Entravé', 'Caché', 'Empoisonné'];
const DRUID_CLASS_ID = 'ZNwUTCyGCEcidZFv';
const BEASTBOUND_SUBCLASS_ID = 'TIUsIlTS1WkK5vr2';
const MORE_TABS = [
  { id: 'cards', label: 'Cartes' },
  { id: 'features', label: 'Aptitudes' },
  { id: 'background', label: 'Background' },
  { id: 'journal', label: 'Journal' },
];
const MTABS = [
  { id: 'combat', label: 'Combat' },
  { id: 'stats', label: 'Stats & Ressources' },
  { id: 'equip', label: 'Équipement' },
  { id: 'more', label: 'Plus' },
];
let ui = { mtab: 'combat', more: 'cards', atkAdv: false, atkDis: false };
const CAMPAIGN_LABELS = { everyday: 'Quotidien', western: 'Western', monster: 'Chasse' };
const fmtBonus = (b) => {
  const n = parseInt(b, 10) || 0;
  return n ? (n > 0 ? `+${n}` : `${n}`) : '';
};

/* ============ migration vers le modèle « feuille officielle » ============ */
function migrate(c, weapons, armors, subclasses, classes) {
  let dirty = false;
  if (!c.className && c.classId && classes) {
    const cl = classes.find(x => x.id === c.classId);
    if (cl) { c.className = cl.fr; dirty = true; }
  }
  if ((!c.hopeAbility || typeof c.hopeAbility === 'string') && c.classId && classes) {
    const cl = classes.find(x => x.id === c.classId);
    if (cl?.hopeAbility) {
      c.hopeAbility = { name: cl.hopeAbility, desc: cl.hopeDesc || '' };
      dirty = true;
    }
  }
  if (!Array.isArray(c.conditions)) { c.conditions = []; dirty = true; }
  if (!c.cardUses || typeof c.cardUses !== 'object') { c.cardUses = {}; dirty = true; }
  if (!c.cardTokens || typeof c.cardTokens !== 'object') { c.cardTokens = {}; dirty = true; }
  if (typeof c.shortRestsSinceLong !== 'number') { c.shortRestsSinceLong = 0; dirty = true; }
  if (typeof c.scars !== 'number') { c.scars = 0; dirty = true; }
  c.scars = Math.max(0, Math.min(6, c.scars));
  const subMatch = subclasses?.find(s => s.id === c.subclassId);
  if ((c.subclassId === BEASTBOUND_SUBCLASS_ID || subMatch?.en === 'Beastbound') && !c.companion) {
    c.companion = {
      name: 'Compagnon animal', species: 'Louveteau / Faucon / Lynx…', evasion: 10,
      dice: 'd6', range: 'Mêlée', dmgType: 'phy', attackName: 'Attaque coordonnée',
      stress: { max: 3, current: 0 },
      experiences: [{ name: 'Pistage', mod: 2 }, { name: 'Protection', mod: 2 }],
      upgrades: [],
    };
    dirty = true;
  }
  /* undefined OU chaîne vide : les personnages créés avant le fix arrivaient avec
     heritage/subclassText définis mais vides (le wizard ne les remplissait pas) */
  if (!c.heritage && c.ancestry?.fr) { c.heritage = c.ancestry.fr; dirty = true; }
  if (!c.subclassText) {
    /* subclassName manque sur les très vieux personnages : retrouver via subclassId */
    const subName = c.subclassName
      || subclasses?.find(s => s.id === c.subclassId)?.fr || '';
    if (subName) { c.subclassText = subName; dirty = true; }
  }
  if (c.transformation === undefined) { c.transformation = ''; dirty = true; }
  if (c.portrait === undefined) { c.portrait = ''; dirty = true; }
  if (!Array.isArray(c.experiences)) { c.experiences = []; dirty = true; }
  while (c.experiences.length < 5) { c.experiences.push({ name: '', mod: 2 }); dirty = true; }
  if (c.hp.active === undefined) { c.hp.active = c.hp.max || 6; c.hp.unlocked = 0; dirty = true; }
  if (c.stress.active === undefined) { c.stress.active = c.stress.max || 6; c.stress.unlocked = 0; dirty = true; }
  if (c.hope.max !== 6) { c.hope.max = 6; dirty = true; }
  const effHopeCap = Math.max(0, 6 - (c.scars || 0));
  if (c.hope.current > effHopeCap) { c.hope.current = effHopeCap; dirty = true; }
  if (c.hopeFeature === undefined) {
    c.hopeFeature = c.hopeAbility ? `✦ ${c.hopeAbility.name} — ${c.hopeAbility.desc}` : '';
    dirty = true;
  }
  if (c.classFeature === undefined) { c.classFeature = ''; dirty = true; }
  if (!Array.isArray(c.weapons)) {
    const mk = (id, extra) => {
      const w = weapons.find(x => x.id === id);
      if (!w) return null;
      return {
        uid: uid(), compendiumId: w.id, name: w.fr, trait: w.trait, range: w.range,
        dice: w.dice, dmgBonus: w.dmgBonus || 0, dmgType: w.dmgType, feature: w.desc || '',
        hands: w.burden === 'twoHanded' ? 'two' : 'one',
        state: 'active', primary: false, secondary: false, ...extra,
      };
    };
    c.weapons = [
      c.primaryWeaponId ? mk(c.primaryWeaponId, { primary: true }) : null,
      c.secondaryWeaponId ? mk(c.secondaryWeaponId, { secondary: true }) : null,
    ].filter(Boolean);
    dirty = true;
  } else {
    for (const w of c.weapons) {
      if (!w.compendiumId) continue;
      const def = weapons.find(x => x.id === w.compendiumId);
      if (!def) continue;
      if (w.dmgBonus === undefined) { w.dmgBonus = def.dmgBonus || 0; dirty = true; }
      if (!w.feature && def.desc) { w.feature = def.desc; dirty = true; }
    }
  }
  if (!c.thresholds || c.thresholds.bonus === undefined) {
    const oldBonus = (c.thresholds?.major ?? 0) - c.level - (c.armorCard?.baseMajor || 0);
    c.thresholds = { bonus: Number.isFinite(oldBonus) ? oldBonus : 0 };
    dirty = true;
  }
  if (!c.armorCard) {
    const ar = armors.find(a => a.id === c.armorId);
    c.armorCard = ar
      ? { compendiumId: ar.id, name: ar.fr, baseScore: ar.armorScore, baseMajor: ar.major, baseSevere: ar.severe, feature: ar.desc || '' }
      : { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' };
    dirty = true;
  } else if (c.armorCard.compendiumId && !c.armorCard.feature) {
    const ar = armors.find(a => a.id === c.armorCard.compendiumId);
    if (ar?.desc) { c.armorCard.feature = ar.desc; dirty = true; }
  }
  if (!c.armorSlots || c.armorSlots.max !== 12) {
    c.armorSlots = { max: 12, used: Math.min(c.armorSlots?.used || 0, 12) };
    dirty = true;
  }
  if (!c.goldTrack) { c.goldTrack = { handfuls: c.gold || 0, bags: 0, chests: 0 }; dirty = true; }
  if (c.traitMarks === undefined) { c.traitMarks = []; dirty = true; }
  if (c.subcardTaken === undefined) { c.subcardTaken = {}; dirty = true; }
  if (c.goldTrack.chests > 1) { c.goldTrack.bags += (c.goldTrack.chests - 1) * 10; c.goldTrack.chests = 1; dirty = true; }
  const hpMax = c.hp.active + c.hp.unlocked;
  if (c.hp.max !== hpMax) { c.hp.max = hpMax; c.hp.current = Math.min(c.hp.current, hpMax); dirty = true; }
  const stMax = c.stress.active + c.stress.unlocked;
  if (c.stress.max !== stMax) { c.stress.max = stMax; c.stress.current = Math.min(c.stress.current, stMax); dirty = true; }
  if (dirty) saveChar(c);
}

const thresholds = (c) => ({
  major: (c.armorCard.baseMajor || 0) + c.level + (c.thresholds.bonus || 0),
  severe: (c.armorCard.baseSevere || 0) + c.level + (c.thresholds.bonus || 0),
});
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const syncMaxes = (c) => {
  c.hp.max = c.hp.active + c.hp.unlocked;
  c.hp.current = Math.max(0, Math.min(c.hp.current, c.hp.max));
  c.stress.max = c.stress.active + c.stress.unlocked;
  c.stress.current = Math.max(0, Math.min(c.stress.current, c.stress.max));
};

function resolveBeastform(bfMeta, savedBf, beastforms, traits) {
  if (!bfMeta) return null;
  if (bfMeta.trait !== 'variable' && bfMeta.dmgDice !== 'variable') return bfMeta;
  const baseBf = savedBf?.baseId
    ? beastforms.find(b => b.id === savedBf.baseId && b.trait !== 'variable')
    : null;
  if (baseBf) {
    return {
      ...bfMeta,
      fr: `${bfMeta.fr} (${baseBf.fr})`,
      examples: baseBf.examples || bfMeta.examples,
      trait: baseBf.trait,
      traitBonus: (baseBf.traitBonus || 0) + (bfMeta.traitBonus || 0),
      evasionBonus: (baseBf.evasionBonus || 0) + (bfMeta.evasionBonus || 0),
      range: baseBf.range || bfMeta.range || 'Mêlée',
      dmgDice: bfMeta.tier >= 4 ? nextDieStep(baseBf.dmgDice) : (baseBf.dmgDice || 'd6'),
      dmgBonus: (baseBf.dmgBonus || 0) + (bfMeta.dmgBonus || 0),
      dmgType: baseBf.dmgType || bfMeta.dmgType || 'phy',
      advantages: baseBf.advantages || bfMeta.advantages || [],
      features: [...(bfMeta.features || []), ...(baseBf.features || [])],
      baseId: baseBf.id,
    };
  }
  const bestTrait = TRAIT_KEYS.reduce((best, k) => ((traits?.[k] || 0) > (traits?.[best] || 0) ? k : best), 'agility');
  return {
    ...bfMeta,
    trait: bestTrait,
    dmgDice: bfMeta.tier >= 4 ? 'd10' : 'd8',
  };
}

/* ============================ RENDER ============================ */
export async function render(main, params) {
  main.classList.add('wide');
  const c = getChar(params);
  if (!c) { toast('Personnage introuvable'); go('chars'); return; }
  /* B15 : préserve le focus et la position de saisie à travers le re-render */
  const active = document.activeElement;
  const focusKey = active?.dataset?.f || active?.dataset?.ef || active?.dataset?.wf || active?.dataset?.af || null;
  const focusSel = focusKey ? `[data-f="${focusKey}"],[data-ef="${focusKey}"],[data-wf="${focusKey}"],[data-af="${focusKey}"]` : null;
  const scrollY = window.scrollY;
  const [classes, subclasses, weapons, armors, cards, domains, generalItems, transformations, beastforms] = await Promise.all([
    data('classes'), data('subclasses'), data('weapons'), data('armors'), data('domainCards'), data('domains'), data('generalItems'), data('transformations'), data('beastforms'),
  ]);
  migrate(c, weapons, armors, subclasses, classes);
  const cl = classes.find(x => x.id === c.classId);
  const sub = subclasses.find(x => x.id === c.subclassId);
  const bfMeta = c.beastform?.id ? beastforms.find(b => b.id === c.beastform.id) : null;
  const activeBf = resolveBeastform(bfMeta, c.beastform, beastforms, c.traits);
  const traitBonusOf = (k) => (activeBf && activeBf.trait === k ? (activeBf.traitBonus || 0) : 0);
  const effTrait = (k) => (c.traits[k] || 0) + traitBonusOf(k);
  const armMax = Math.max(0, Math.min(12, c.armorCard.baseScore || 0));
  const effHopeMax = Math.max(0, 6 - (c.scars || 0));
  const thr = thresholds(c);
  const gt = c.goldTrack;
  const goldTotal = gt.handfuls + gt.bags * 10 + gt.chests * 100;

  main.innerHTML = `
  <div class="view dh-sheet" data-mtab="${ui.mtab}">
    <!-- dégradés partagés des boucliers SVG -->
    <svg class="dh-svgdefs" aria-hidden="true">
      <defs>
        <linearGradient id="dhShieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2b2440"/><stop offset="1" stop-color="#1a1628"/>
        </linearGradient>
        <linearGradient id="dhAspipOff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#26223a"/><stop offset="1" stop-color="#1c192b"/>
        </linearGradient>
        <linearGradient id="dhAspipOn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#cdd9e6"/><stop offset="1" stop-color="#67788c"/>
        </linearGradient>
      </defs>
    </svg>

    <!-- ===== EN-TÊTE : portrait + identité + classe/niveau ===== -->
    <header class="dh-header">
      <div class="dh-portrait ${c.portrait ? 'has-img' : ''}" id="dh-portrait" role="button" tabindex="0" title="${c.portrait ? 'Changer le portrait du personnage' : 'Ajouter un portrait'}">
        ${c.portrait
          ? `<img src="${esc(c.portrait)}" alt="${esc(c.name || 'Portrait')}" class="dh-portrait-img">
             <button type="button" class="dh-portrait-del" id="dh-portrait-del" title="Retirer le portrait" aria-label="Retirer le portrait">×</button>
             <span class="dh-portrait-edit" aria-hidden="true">✎</span>`
          : `<svg class="dh-portrait-ph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.6-4.2 3.7-6.5 7.5-6.5s6.9 2.3 7.5 6.5"/></svg>
             <span class="dh-portrait-lbl">Portrait</span>
             <span class="dh-portrait-add">＋ Photo</span>`}
        <input type="file" id="portrait-file" accept="image/*" style="display:none">
      </div>
      <div class="dh-idfields">
        <label class="dh-idf w2"><span>Nom</span><input data-f="name" value="${esc(c.name)}" placeholder="Nom du personnage"></label>
        <label class="dh-idf"><span>Pronoms</span><input data-f="pronouns" value="${esc(c.pronouns)}" placeholder="iel · elle · il"></label>
        <label class="dh-idf w2"><span>Héritage</span><input data-f="heritage" value="${esc(c.heritage)}" placeholder="Ascendance / peuple"></label>
        <label class="dh-idf"><span>Sous-classe</span><input data-f="subclassText" value="${esc(c.subclassText)}" placeholder="${esc(sub?.fr || 'Sous-classe')}"></label>
        <label class="dh-idf w2"><span>Transformation (optionnelle)</span><input data-f="transformation" value="${esc(c.transformation || '')}" placeholder="Aucune · ex. Loup-garou, Vampire…" list="transf-list"></label>
        <datalist id="transf-list">${transformations.map(t => `<option value="${esc(t.fr)}">`).join('')}</datalist>
      </div>
      <div class="dh-level" title="Niveau ${c.level} — les seuils de dégâts l'utilisent">
        <div class="dh-class-top" title="Classe principale">${esc(c.className || 'Classe')}</div>
        <span class="dh-lv-shield">
          <svg viewBox="0 0 64 74" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 63,1 63,50 32,73 1,50"/></svg>
          <span class="dh-lv-num">${c.level}</span>
          <span class="dh-lv-lbl">Niveau</span>
        </span>
        <span class="dh-lv-btns">
          <button data-lvl="-1" title="Baisser le niveau (ajustement manuel)">−</button>
          <button id="dh-levelup" title="Montée de niveau guidée (règles p. 109-111) : récompense, 2 améliorations, carte de domaine">★ Monter</button>
        </span>
      </div>
    </header>

    <!-- ===== Barre d'outils ===== -->
    <div class="dh-actions">
      <span class="dh-sp"></span>
      <button class="btn ghost small" id="rest-short" title="Repos court : efface les Stress">Repos court</button>
      <button class="btn ghost small" id="rest-long" title="Repos long : PV max, Stress 0, Espoir 2">Repos long</button>
      <button class="btn ghost small" id="btn-export" title="Exporter en JSON">⬆</button>
      <button class="btn ghost small" id="btn-import" title="Importer un personnage JSON">⬇</button>
      <button class="btn danger small" id="btn-delete" title="Supprimer le personnage">🗑</button>
      <input type="file" id="file-import" accept=".json,application/json,text/plain" style="display:none">
    </div>

    <!-- ===== ONGLETS MOBILE (sticky, sous le header) ===== -->
    <div class="dh-mtabs">
      ${MTABS.map(t => `<button class="mt ${ui.mtab === t.id ? 'active' : ''}" data-mtab="${t.id}">${t.label}</button>`).join('')}
    </div>

    <!-- ===== BANDE DÉFENSES : Évasion · Armure + 12 cases · 6 TRAITS ===== -->
    <div class="dh-defstrip s-combat">
      <div class="dh-shield-block">
        <div class="dh-shield eva" title="Difficulté de base pour vous toucher${activeBf?.evasionBonus ? ` (base ${c.evasion} + ${activeBf.evasionBonus} Forme bestiale = ${(c.evasion || 0) + activeBf.evasionBonus})` : ''}">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 99,1 99,72 50,99 1,72"/></svg>
          <span class="dh-sh-lbl">Évasion${activeBf?.evasionBonus ? ` (+${activeBf.evasionBonus})` : ''}</span>
          <input type="number" class="dh-sh-val" data-f="evasion" value="${c.evasion}" min="0" max="30">
        </div>
        <div class="dh-shield arm" title="Score d'armure + emplacements">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 99,1 99,72 50,99 1,72"/></svg>
          <span class="dh-sh-lbl">Armure</span>
          <input type="number" class="dh-sh-val" data-f="armorScore" value="${c.armorCard.baseScore}" min="0" max="12">
        </div>
        <div class="dh-aspots" title="Emplacements d'armure actifs (${armMax}/12) — cliquez pour marquer les dégâts absorbés">
          ${Array.from({ length: 12 }, (_, i) => {
            const locked = i >= armMax && i >= c.armorSlots.used;
            return `<button class="dh-aspip ${i < c.armorSlots.used ? 'on' : ''}${locked ? ' locked' : ''}" data-apip="${i}" aria-label="Emplacement d'armure ${i + 1}" aria-pressed="${i < c.armorSlots.used}" ${locked ? `aria-disabled="true" title="Verrouillé — dépasse votre score d'armure (${armMax})"` : ''}><svg viewBox="0 0 22 26" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 21,1 21,18 11,25 1,18"/></svg></button>`;
          }).join('')}
        </div>
      </div>
      <div class="dh-traitrow">
        ${TRAIT_KEYS.map(k => {
          const bfB = traitBonusOf(k);
          return `
        <button class="dh-trait ${c.traitMarks?.includes(k) ? 'marked' : ''}" data-troll="${k}" title="Jet de ${T.traits[k]} — Dés de Dualité (2d12)${bfB ? ` (inclut +${bfB} Forme bestiale)` : ''}${c.traitMarks?.includes(k) ? ' · trait coché (amélioré ce palier)' : ''}">
          <span class="dh-tr-head"><span class="dh-tr-name">${T.traits[k]}${bfB ? ` <em style="color:#9fe0b0">+${bfB}</em>` : ''}</span><span class="dh-tr-mark ${c.traitMarks?.includes(k) ? 'on' : ''}" title="${c.traitMarks?.includes(k) ? 'Trait amélioré ce palier' : 'Améliorable à la prochaine montée de niveau'}">${c.traitMarks?.includes(k) ? '✓' : '·'}</span></span>
          <span class="dh-tr-body">${signed(effTrait(k))}</span>
          <span class="dh-tr-verbs">${T.traitVerbs[k].split(' · ').join('<br>')}</span>
        </button>`;
        }).join('')}
      </div>
    </div>

    <!-- ===== 2 COLONNES ===== -->
    <div class="dh-main">

      <!-- ---- COLONNE GAUCHE ---- -->
      <div class="dh-col">

        <!-- DÉGÂTS & SANTÉ -->
        <section class="dh-panel s-combat">
          <div class="dh-banner"><i></i><span>Dégâts &amp; Santé</span><i></i></div>
          <div class="dh-thrrow">
            <div class="dh-thrbar minor"><span>Dégâts mineurs</span><em>Cochez 1 PV</em></div>
            <button class="dh-thrval" data-thr="1" title="Modifier les seuils">${thr.major}</button>
            <div class="dh-thrbar major"><span>Dégâts majeurs</span><em>Cochez 2 PV</em></div>
            <button class="dh-thrval" data-thr="2" title="Modifier les seuils">${thr.severe}</button>
            <div class="dh-thrbar severe"><span>Dégâts graves</span><em>Cochez 3 PV</em></div>
          </div>
          <p class="dh-help">Seuils = base d'armure ${c.armorCard.baseMajor}/${c.armorCard.baseSevere} + Niveau ${c.level}${c.thresholds.bonus ? ` ${signed(c.thresholds.bonus)} (aptitudes)` : ''}. Comparez les dégâts reçus aux seuils.</p>

          <div class="dh-gauge">
            <div class="dh-g-head"><span class="dh-g-lbl">PV</span>
              <span class="dh-g-nums"><b>${c.hp.current}</b>/${c.hp.max}</span>
              <span class="dh-g-tools">
                <button class="dh-g-lock" data-hp-slot="-1" title="Retirer 1 case débloquée" ${c.hp.unlocked <= 0 ? 'disabled' : ''}>−</button>
                <button class="dh-g-lock" data-hp-slot="1" title="Débloquer 1 case bonus" ${c.hp.max >= 14 ? 'disabled' : ''}>+</button>
                <button class="dh-g-lock" data-hlock title="Masquer les cases déblocables vides">⟲</button>
              </span>
            </div>
            <div class="dh-boxrow">
              ${Array.from({ length: Math.max(12, c.hp.max) }, (_, i) => {
                const avail = i < c.hp.active;
                const extraOn = !avail && i < c.hp.max;
                const locked = i >= c.hp.max;
                const filled = i < c.hp.current;
                return `<button class="dh-box${avail ? '' : ' dash'}${extraOn ? ' xtra' : ''}${locked ? ' locked' : ''}${filled ? ' on' : ''}" data-hpbox="${i}" ${locked ? 'aria-disabled="true" title="Emplacement verrouillé — utilisez + ou la montée de niveau"' : ''}></button>`;
              }).join('')}
            </div>
          </div>

          <div class="dh-gauge">
            <div class="dh-g-head"><span class="dh-g-lbl">Stress</span>
              <span class="dh-g-nums"><b>${c.stress.current}</b>/${c.stress.max}</span>
              <span class="dh-g-tools">
                <button class="dh-g-lock" data-st-slot="-1" title="Retirer 1 case débloquée" ${c.stress.unlocked <= 0 ? 'disabled' : ''}>−</button>
                <button class="dh-g-lock" data-st-slot="1" title="Débloquer 1 case bonus" ${c.stress.max >= 14 ? 'disabled' : ''}>+</button>
                <button class="dh-g-lock" data-slock title="Masquer les cases déblocables vides">⟲</button>
              </span>
            </div>
            <div class="dh-boxrow">
              ${Array.from({ length: Math.max(12, c.stress.max) }, (_, i) => {
                const avail = i < c.stress.active;
                const extraOn = !avail && i < c.stress.max;
                const locked = i >= c.stress.max;
                const filled = i < c.stress.current;
                return `<button class="dh-box stress${avail ? '' : ' dash'}${extraOn ? ' xtra' : ''}${locked ? ' locked' : ''}${filled ? ' on' : ''}" data-stbox="${i}" ${locked ? 'aria-disabled="true" title="Emplacement verrouillé — utilisez + ou la montée de niveau"' : ''}></button>`;
              }).join('')}
            </div>
          </div>
          <div class="dh-dmg-bar">
            <button class="btn small" id="btn-take-dmg" title="Calculer et appliquer des dégâts selon vos seuils et votre armure">💥 Encaisser des dégâts</button>
            <button class="btn ${c.hp.current === 0 ? 'danger' : 'ghost'} small" id="btn-death-move" title="Mouvement de mort (SRD 2.0)">💀 Mouvement de mort${c.hp.current === 0 ? ' !' : ''}</button>
          </div>
          <div class="dh-conds">
            <span class="dh-cond-lbl">États</span>
            ${CONDITIONS.map(cond => `<button class="dh-cond ${c.conditions?.includes(cond) ? 'on' : ''}" data-cond="${esc(cond)}">${esc(cond)}</button>`).join('')}
          </div>
        </section>

        <!-- ESPOIR -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Espoir</span><i></i></div>
          <div class="dh-hope-head">
            <span>Espoir : <b>${c.hope.current}</b>/${effHopeMax}</span>
            <span>Cicatrices : <b>${c.scars || 0}</b>
              <button class="dh-g-lock" data-scar="-1" title="Retirer 1 cicatrice" ${(c.scars || 0) <= 0 ? 'disabled' : ''}>−</button>
              <button class="dh-g-lock" data-scar="1" title="Ajouter 1 cicatrice (barre 1 losange d'Espoir)" ${(c.scars || 0) >= 6 ? 'disabled' : ''}>+</button>
            </span>
          </div>
          <div class="dh-hopetrack" title="Espoir — cliquez un losange">
            ${Array.from({ length: 6 }, (_, i) => {
              const scarred = i >= effHopeMax;
              const on = i < c.hope.current && !scarred;
              return `<button class="dh-diamond ${on ? 'on' : ''}${scarred ? ' scarred' : ''}" data-hoped="${i}" ${scarred ? 'aria-disabled="true" title="Emplacement condamné par une cicatrice"' : ''}></button>`;
            }).join('')}
          </div>
          <p class="dh-help">Dépensez un Espoir pour utiliser une Expérience ou aider un allié.</p>
          <label class="dh-fl dh-fl-hope"><span>Feature d'Espoir</span>
            <textarea data-f="hopeFeature" rows="4" placeholder="Feature d'Espoir de votre classe…">${esc(c.hopeFeature)}</textarea></label>
        </section>

        <!-- EXPÉRIENCES -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Expériences</span><i></i></div>
          ${c.experiences.map((e, i) => `
          <div class="dh-exprow">
            <input class="dh-exp-name" data-ef="${i}:name" value="${esc(e.name)}" placeholder="Expérience ${i + 1}…">
            <input type="number" class="dh-ribbon" data-ef="${i}:mod" value="${e.mod}" min="-9" max="9" title="Modificateur — 🎲 pour l'ajouter à un jet">
            <button class="dh-exp-roll" data-eroll="${i}" title="Utiliser cette Expérience (dépense 1 Espoir)">🎲</button>
          </div>`).join('')}
        </section>

        <!-- OR -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Or</span><i></i></div>
          <div class="dh-gold">
            <div class="dh-goldgrp">
              <div class="dh-gpips" title="Poignées — cliquez la ${gt.handfuls}e pastille pour ajuster">${Array.from({ length: 10 }, (_, i) => `<button class="gpip g1 ${i < gt.handfuls ? 'on' : ''}" data-goldpip="handfuls:${i}"></button>`).join('')}</div>
              <div class="dh-gold-lbl"><span>Poignées</span><b class="dh-gold-n">${gt.handfuls}/10</b>
                <span class="dh-gold-btns"><button data-goldbtn="handfuls:-1" title="−1 poignée">−</button><button data-goldbtn="handfuls:1" title="+1 poignée">+</button></span></div>
            </div>
            <div class="dh-goldgrp">
              <div class="dh-gpips" title="Sacs — 1 sac = 10 poignées">${Array.from({ length: 10 }, (_, i) => `<button class="gpip g2 ${i < gt.bags ? 'on' : ''}" data-goldpip="bags:${i}"></button>`).join('')}</div>
              <div class="dh-gold-lbl"><span>Sacs</span><b class="dh-gold-n">${gt.bags}/10</b>
                <span class="dh-gold-btns"><button data-goldbtn="bags:-1" title="−1 sac">−</button><button data-goldbtn="bags:1" title="+1 sac">+</button></span></div>
            </div>
            <div class="dh-goldgrp chest">
              <div class="dh-gpips" title="Coffre — 1 coffre = 10 sacs">${Array.from({ length: 1 }, (_, i) => `<button class="gpip g3 ${i < gt.chests ? 'on' : ''}" data-goldpip="chests:${i}"></button>`).join('')}</div>
              <div class="dh-gold-lbl"><span>Coffres</span><b class="dh-gold-n">${gt.chests}/1</b>
                <span class="dh-gold-btns"><button data-goldbtn="chests:-1" title="−1 coffre">−</button><button data-goldbtn="chests:1" title="+1 coffre">+</button></span></div>
            </div>
          </div>
          <div class="dh-gold-foot">
            <span>Total : <b>${goldTotal}</b> poignées · 10 poignées = 1 sac · 10 sacs = 1 coffre</span>
            <button class="btn ghost small" data-goldconv title="Convertir automatiquement 10 poignées en 1 sac, 10 sacs en 1 coffre">⇄ Convertir</button>
          </div>
        </section>

        <!-- APTITUDE DE CLASSE -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Aptitude de classe</span><i></i></div>
          <div class="dh-cf">
            <textarea data-f="classFeature" rows="6" placeholder="Capacités de classe, features de sous-classe…">${esc(c.classFeature)}</textarea>
          </div>
        </section>
      </div>

      <!-- ---- COLONNE DROITE ---- -->
      <div class="dh-col">

        <!-- ARMES -->
        <section class="dh-panel s-equip">
          <div class="dh-banner"><i></i><span>Armes</span><i></i></div>

          <!-- ===== ACTIONS & ATTAQUES : tableau tactique rapide (style D&D Beyond) ===== -->
          <div class="dha-block" id="dh-actions">
            <div class="dha-head">
              <span class="dha-t">Actions &amp; Attaques</span>
              <span class="dha-toggles">
                <button class="dha-tbtn ${ui.atkAdv ? 'on' : ''}" id="dha-adv" title="Appliquer Avantage (+1d6) aux attaques rapides">▲ Avantage</button>
                <button class="dha-tbtn ${ui.atkDis ? 'on' : ''}" id="dha-dis" title="Appliquer Désavantage (−1d6) aux attaques rapides">▼ Désavantage</button>
              </span>
            </div>
            ${activeBf ? `
            <div class="dh-bf-banner">
              <span>🐾 <b>Forme bestiale : ${esc(activeBf.fr)}</b> (${T.traits[activeBf.trait] || activeBf.trait} +${activeBf.traitBonus}, Évasion +${activeBf.evasionBonus}${activeBf.advantages?.length ? ` · Avantages : ${esc(activeBf.advantages.join(', '))}` : ''})</span>
              <button class="btn ghost small" id="bf-exit-fast">Quitter</button>
            </div>
            <div class="dha-row">
              <span class="dha-icon" title="Forme bestiale">🐾</span>
              <span class="dha-name">
                <b>${esc(activeBf.fr)} (naturel)</b>
                <small>${T.traits[activeBf.trait] || ''} · ${esc(activeBf.range)}</small>
              </span>
              <span class="dha-range">${esc(activeBf.range)}</span>
              <button class="dha-btn atk" data-bf-atk title="Jet d'attaque en Forme bestiale">${signed(effTrait(activeBf.trait))}</button>
              <button class="dha-btn dmg" data-bf-dmg title="Dégâts naturels en Forme bestiale">${Math.max(1, Math.min(6, c.proficiency))}${activeBf.dmgDice}${fmtBonus(activeBf.dmgBonus)}</button>
            </div>` : ''}
            ${(c.weapons.filter(w => w.primary || w.secondary).length ? c.weapons.filter(w => w.primary || w.secondary) : c.weapons.filter(w => w.state === 'active')).map(w => {
              const mod = effTrait(w.trait);
              const n = Math.max(1, Math.min(6, c.proficiency));
              const bonus = parseInt(w.dmgBonus, 10) || 0;
              const dmgLabel = `${n}${w.dice}${fmtBonus(bonus)}`;
              return `<div class="dha-row">
                <span class="dha-icon" title="${w.dmgType === 'mag' ? 'Magique' : 'Physique'}">${w.dmgType === 'mag' ? '✦' : '⚔'}</span>
                <span class="dha-name">
                  <b>${esc(w.name || 'Arme')}</b>
                  <small>${T.traits[w.trait] || ''} · ${w.hands === 'two' ? '2 mains' : '1 main'} · ${esc(w.range || '')}</small>
                </span>
                <span class="dha-range">${esc(w.range || '—')}</span>
                <button class="dha-btn atk" data-dha-atk="${w.uid}" title="Jet de Dualité + ${T.traits[w.trait] || ''}">${mod >= 0 ? '+' + mod : mod}</button>
                <button class="dha-btn dmg" data-dha-dmg="${w.uid}" title="Dégâts : ${n} × ${w.dice}${bonus ? ' ' + fmtBonus(bonus) : ''}">${dmgLabel}</button>
              </div>`;
            }).join('') || (!activeBf ? '<div class="dh-help">Équipez une arme pour voir vos attaques rapides.</div>' : '')}
            ${c.companion ? `
            <div class="dha-row">
              <span class="dha-icon" title="Compagnon animal">🐺</span>
              <span class="dha-name">
                <b>${esc(c.companion.name || 'Compagnon')}</b>
                <small>${esc(c.companion.attackName || 'Attaque')} · ${esc(c.companion.range || 'Mêlée')} · Éva ${c.companion.evasion || 10}</small>
              </span>
              <span class="dha-range">${esc(c.companion.range || 'Mêlée')}</span>
              <button class="dha-btn atk" data-comp-atk title="Jet d'attaque du compagnon (Instinct)">${signed(effTrait('instinct'))}</button>
              <button class="dha-btn dmg" data-comp-dmg title="Dégâts du compagnon">${Math.max(1, Math.min(6, c.proficiency))}${esc(c.companion.dice || 'd6')}</button>
            </div>` : ''}
          </div>

          <div class="dh-prof" title="Maîtrise — nombre de dés de dégâts lancés">
            <span class="dh-g-lbl">Maîtrise</span>
            <span class="dh-prof-pips">
              ${Array.from({ length: 6 }, (_, i) => `<button class="dh-profpip ${i < c.proficiency ? 'on' : ''}" data-prof="${i}"></button>`).join('')}
            </span>
            <span class="dh-g-nums">×${c.proficiency} dé${c.proficiency > 1 ? 's' : ''}</span>
          </div>
          <div id="dh-wlist">
            ${c.weapons.map((w, i) => weaponCardHTML(w, i, c)).join('')}
            ${c.weapons.length < 4 ? `<button class="dh-wadd" data-wadd>＋ Ajouter une arme</button>` : ''}
          </div>
        </section>

        <!-- ARMURE ACTIVE -->
        <section class="dh-panel s-equip">
          <div class="dh-banner"><i></i><span>Armure active</span><i></i></div>
          <div class="dh-wgrid armor">
            <label class="dh-fl w2"><span>Nom</span><input data-af="name" value="${esc(c.armorCard.name)}" placeholder="Ex. : Cotte de mailles"></label>
            <label class="dh-fl"><span>Score de base</span><input type="number" data-af="baseScore" value="${c.armorCard.baseScore}" min="0" max="12"></label>
            <label class="dh-fl"><span>Seuil majeur de base</span><input type="number" data-af="baseMajor" value="${c.armorCard.baseMajor}" min="0" max="40"></label>
            <label class="dh-fl"><span>Seuil grave de base</span><input type="number" data-af="baseSevere" value="${c.armorCard.baseSevere}" min="0" max="60"></label>
          </div>
          <p class="dh-help">Ces valeurs alimentent le score d'armure en haut et les seuils de la colonne gauche (base + niveau).</p>
          <label class="dh-fl"><span>Feature</span><input data-af="feature" value="${esc(c.armorCard.feature)}" placeholder="Feature d'armure…"></label>
          <button class="dh-wadd" data-aadd>＋ Ajouter une armure</button>
        </section>

        <!-- INVENTAIRE -->
        <section class="dh-panel s-equip">
          <div class="dh-banner"><i></i><span>Inventaire</span><i></i></div>
          <div class="dh-inv-tools">
            <div class="search-bar">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
              <input type="text" id="inv-q" placeholder="Rechercher un objet à ajouter…" autocomplete="off">
            </div>
            <button class="btn ghost small dh-inv-catbtn" id="inv-catalog" title="Parcourir le catalogue complet d'objets, armes et armures">📦 Catalogue</button>
          </div>
          <div id="inv-suggest"></div>
          <div id="inv-list">
            ${c.inventory.map((it, i) => {
              /* détection équipement : armure (itemId → armors) ou arme (itemId → weapons) */
              const armorDef = it.itemId ? armors.find(a => a.id === it.itemId) : null;
              const weaponDef = it.itemId ? weapons.find(w => w.id === it.itemId) : null;
              if (armorDef) {
                const equipped = c.armorCard?.compendiumId === armorDef.id;
                const desc = it.desc || armorDef.desc || '';
                return `<div class="inv-item ${equipped ? 'equipped' : ''}">
                  <span class="ii-name">${esc(it.name)} <span class="tag" style="margin-left:4px">Armure</span></span>
                  ${desc ? `<span class="ii-desc" title="${esc(desc)}">${esc(desc)}</span>` : ''}
                  <span class="ii-sub">Score ${armorDef.armorScore} · Seuils ${armorDef.major}/${armorDef.severe}${armorDef.heavy ? ' · Lourd' : ''}</span>
                  <div class="ii-actions">
                    <button class="btn small ${equipped ? 'ghost' : ''}" data-inv-eq-armor="${armorDef.id}">${equipped ? 'Ranger' : 'Équiper'}</button>
                    <div class="ii-qty">
                      <button class="qbtn" data-qty="${i}:-1">−</button>
                      <span class="qval">${it.qty ?? 1}</span>
                      <button class="qbtn" data-qty="${i}:1">+</button>
                    </div>
                    <button class="icon-btn ii-del" data-del-inv="${i}" title="Retirer">
                      <svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>
                    </button>
                  </div>
                </div>`;
              }
              if (weaponDef) {
                const owned = c.weapons.find(w => w.compendiumId === weaponDef.id);
                const equipped = owned && (owned.primary || owned.secondary);
                const desc = it.desc || weaponDef.desc || '';
                return `<div class="inv-item ${equipped ? 'equipped' : ''}">
                  <span class="ii-name">${esc(it.name)} <span class="tag" style="margin-left:4px">Arme</span></span>
                  ${desc ? `<span class="ii-desc" title="${esc(desc)}">${esc(desc)}</span>` : ''}
                  <span class="ii-sub">${T.traits[weaponDef.trait] || ''} · ${esc(weaponDef.range)} · ${weaponDef.dice}${fmtBonus(weaponDef.dmgBonus)}${weaponDef.burden === 'twoHanded' ? ' · 2 mains' : ''}</span>
                  <div class="ii-actions">
                    ${owned
                      ? `<button class="btn small ghost" data-inv-eq-weapon="${weaponDef.id}" data-owned-uid="${owned.uid}">${equipped ? 'Ranger' : 'Équiper'}</button>`
                      : `<button class="btn small" data-inv-eq-weapon="${weaponDef.id}">Équiper</button>`}
                    <div class="ii-qty">
                      <button class="qbtn" data-qty="${i}:-1">−</button>
                      <span class="qval">${it.qty ?? 1}</span>
                      <button class="qbtn" data-qty="${i}:1">+</button>
                    </div>
                    <button class="icon-btn ii-del" data-del-inv="${i}" title="Retirer">
                      <svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>
                    </button>
                  </div>
                </div>`;
              }
              const itemDef = it.itemId
                ? generalItems.find(g => g.id === it.itemId)
                : generalItems.find(g => g.fr === it.name);
              const isConsumable = it.type === 'consumable' || itemDef?.type === 'consumable';
              const fullDesc = (itemDef?.descFr && (!it.desc || it.desc.length < itemDef.descFr.length))
                ? itemDef.descFr
                : (it.desc || itemDef?.descFr || itemDef?.descEn || '');
              return `<div class="inv-item">
              <span class="ii-name" title="${esc(fullDesc)}">${esc(it.name)}${isConsumable ? ' <span class="tag" style="margin-left:4px">Consommable</span>' : ''}</span>
              ${fullDesc ? `<span class="ii-desc" title="${esc(fullDesc)}">${esc(fullDesc)}</span>` : ''}
              <div class="ii-actions">
                ${isConsumable ? `<button class="btn small ghost" data-use-inv="${i}" title="Consommer 1 exemplaire">🧪 Utiliser</button>` : ''}
                <div class="ii-qty">
                  <button class="qbtn" data-qty="${i}:-1">−</button>
                  <span class="qval">${it.qty ?? 1}</span>
                  <button class="qbtn" data-qty="${i}:1">+</button>
                </div>
                <button class="icon-btn ii-del" data-del-inv="${i}" title="Retirer">
                  <svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>
                </button>
              </div>
            </div>`;
            }).join('') || '<div class="dh-help">Inventaire vide — ajoutez des objets via la recherche ou le catalogue.</div>'}
          </div>
          <div class="dh-invadd">
            <input type="text" id="inv-new" placeholder="Ajouter un objet perso…">
            <button class="btn small" id="inv-add">Ajouter</button>
          </div>
        </section>
      </div>
    </div>

    <!-- ===== PLUS : cartes · aptitudes · background · journal ===== -->
    <div class="dh-morewrap s-more">
      <div class="tabbar">
        ${MORE_TABS.map(t => `<button class="tb ${ui.more === t.id ? 'active' : ''}" data-stab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="stab-body"></div>
    </div>

    <!-- pied de licence DPCGL 2.0 (discret) -->
    <footer class="dpcgl-mini">
      <img src="public/assets/dpcgl-community-logo.png" alt="Daggerheart Compatible">
      <span>Daggerheart™ Compatible. Terms at Daggerheart.com</span>
    </footer>
  </div>`;

  const body = $('#stab-body', main);
  if (ui.more === 'cards') await tabCards(body, c, { cards, domains, main, params });
  else if (ui.more === 'features') tabFeatures(body, c, { cl, sub, classes, transformations, beastforms, main, params });
  else if (ui.more === 'background') tabBackground(body, c, { main });
  else if (ui.more === 'journal') tabJournal(body, c, { main });

  bindAll(main, c, { main, params, weapons, armors, generalItems, thr, activeBf, traitBonusOf, effTrait, armMax, effHopeMax });

  /* B15 : restitue le focus et le scroll après re-render */
  if (focusSel) {
    const target = main.querySelector(focusSel);
    if (target && document.activeElement !== target) {
      try { target.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }
  window.scrollTo({ top: scrollY });
}

/* ============ carte d'arme ============ */
function weaponCardHTML(w, i, c) {
  /* règles P/S : mutuellement exclusives sur une même arme ;
     si l'arme principale équipée est à 2 mains, aucune arme secondaire possible */
  const twoHandedPrimary = c.weapons.some((x, j) => j !== i && x.primary && x.hands === 'two' && x.state === 'active');
  const otherIsSecondary = c.weapons.some((x, j) => j !== i && x.secondary);
  return `
  <div class="dh-wcard ${w.state === 'inventory' ? 'inv' : ''}">
    <div class="dh-wtop">
      <span class="dh-wswitch">
        <button class="ws ${w.state === 'active' ? 'on' : ''}" data-wstate="${i}:active" title="Arme portée / en main">⚔ Portée</button>
        <button class="ws ${w.state === 'inventory' ? 'on' : ''}" data-wstate="${i}:inventory" title="Arme rangée dans le sac">🎒 Sac</button>
      </span>
      <span class="dh-whands" title="Nombre de mains">
        <button class="wh ${w.hands === 'one' ? 'on' : ''}" data-whands="${i}:one">1 main</button>
        <button class="wh ${w.hands === 'two' ? 'on' : ''}" data-whands="${i}:two">2 mains</button>
      </span>
      <span class="dh-wrole">
        <label title="Arme principale (exclusif avec S sur la même arme)"><input type="checkbox" data-wrole="${i}:primary" ${w.primary ? 'checked' : ''} ${w.secondary ? 'disabled' : ''}>P</label>
        <label title="${twoHandedPrimary || (w.primary && w.hands === 'two') ? 'Indisponible : arme principale à deux mains' : 'Arme secondaire (exclusif avec P sur la même arme)'}"><input type="checkbox" data-wrole="${i}:secondary" ${w.secondary ? 'checked' : ''} ${(w.primary || twoHandedPrimary) ? 'disabled' : ''}>S</label>
      </span>
      <button class="icon-btn dh-wdel" data-wdel="${i}" title="Retirer cette arme">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="dh-wgrid">
      <label class="dh-fl w2"><span>Nom</span><input data-wf="${i}:name" value="${esc(w.name)}" placeholder="Nom de l'arme"></label>
      <label class="dh-fl"><span>Trait</span>
        <select data-wf="${i}:trait">${TRAIT_KEYS.map(k => `<option value="${k}" ${w.trait === k ? 'selected' : ''}>${T.traits[k]}</option>`).join('')}</select></label>
      <label class="dh-fl"><span>Portée</span><input data-wf="${i}:range" value="${esc(w.range)}" placeholder="Mêlée · Distance…"></label>
      <label class="dh-fl"><span>Dé &amp; Bonus</span>
        <div class="dh-wdice-row">
          <select data-wf="${i}:dice">${DICE.map(d => `<option ${w.dice === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
          <input type="number" data-wf="${i}:dmgBonus" value="${parseInt(w.dmgBonus, 10) || 0}" min="-10" max="30" title="Bonus fixe de dégâts (+N)">
        </div>
      </label>
      <label class="dh-fl"><span>Type</span>
        <select data-wf="${i}:dmgType">
          <option value="phy" ${w.dmgType === 'phy' ? 'selected' : ''}>Physique</option>
          <option value="mag" ${w.dmgType === 'mag' ? 'selected' : ''}>Magique</option>
        </select></label>
      <button class="btn small dh-wdmg" data-wroll="${i}" title="Lancer les dégâts : ${c.proficiency} × ${w.dice}${w.dmgBonus ? ' ' + fmtBonus(w.dmgBonus) : ''}">🎲 ${c.proficiency}${w.dice}${fmtBonus(w.dmgBonus)}</button>
    </div>
    <label class="dh-fl"><span>Feature</span><input data-wf="${i}:feature" value="${esc(w.feature)}" placeholder="Feature d'arme…"></label>
  </div>`;
}

/* ============ interactions ============ */
function bindAll(root, c, ctx) {
  const { main, params } = ctx;
  const refresh = () => { saveChar(c); render(main, params); };

  /* --- portrait du personnage (redimensionné côté client pour localStorage) --- */
  const portBox = $('#dh-portrait', root);
  const portIn = $('#portrait-file', root);
  if (portBox && portIn) {
    portBox.addEventListener('click', (e) => {
      if (e.target.closest('#dh-portrait-del') || e.target === portIn) return;
      portIn.click();
    });
    portBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); portIn.click(); }
    });
    $('#dh-portrait-del', root)?.addEventListener('click', (e) => {
      e.stopPropagation();
      c.portrait = '';
      refresh();
      toast('Portrait retiré.');
    });
    portIn.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      if (!f.type.startsWith('image/')) { toast('Fichier image invalide.'); return; }
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        try {
          const maxSide = 360;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const c2d = canvas.getContext('2d');
          c2d.fillStyle = '#141122';
          c2d.fillRect(0, 0, w, h);
          c2d.drawImage(img, 0, 0, w, h);
          c.portrait = canvas.toDataURL('image/jpeg', 0.84);
          refresh();
          toast('Portrait mis à jour.');
        } catch (err) {
          toast('Impossible de charger ce portrait (stockage plein ou image invalide).');
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast('Fichier image invalide.');
      };
      img.src = url;
    });
  }

  /* --- niveau --- */
  $('[data-lvl="-1"]', root)?.addEventListener('click', () => {
    if (c.level <= 1) return;
    c.level = Math.max(1, c.level - 1);
    refresh();
    toast(`Niveau ${c.level} (ajustement manuel) — seuils recalculés.`);
  });
  $('#dh-levelup', root)?.addEventListener('click', async () => {
    if (c.level >= 10) { toast('Niveau maximum (10) atteint.'); return; }
    openLevelUp(c, { onDone: () => render(main, params) });
  });

  /* --- champs texte/nombre génériques --- */
  $$('[data-f]', root).forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.f;
    if (k === 'evasion') c.evasion = Math.max(0, Math.min(30, parseInt(inp.value, 10) || 0));
    else if (k === 'armorScore') {
      c.armorCard.baseScore = Math.max(0, Math.min(12, parseInt(inp.value, 10) || 0));
      refresh();
      return;
    }
    else if (k === 'transformation') {
      c.transformation = inp.value;
      refresh();
      return;
    }
    else c[k] = inp.value;
    saveChar(c);
  }));

  /* --- emplacements d'armure (12, verrouillés au-delà du score d'armure) --- */
  $$('[data-apip]', root).forEach(p => p.addEventListener('click', () => {
    const i = +p.dataset.apip;
    if (i >= ctx.armMax && i >= c.armorSlots.used) {
      toast(`Emplacement verrouillé — dépasse votre score d'armure actif (${ctx.armMax}).`);
      return;
    }
    c.armorSlots.used = (i < c.armorSlots.used) ? i : i + 1;
    refresh();
  }));

  /* --- jets de trait (overlay) --- */
  $$('[data-troll]', root).forEach(t => t.addEventListener('click', (e) => {
    if (e.target.closest('input')) return;
    openRoller(c, { trait: t.dataset.troll }, ctx);
  }));

  /* --- PV / Stress : cases actives + déblocage explicite (+ / − / ⟲) --- */
  $$('[data-hpbox]', root).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.hpbox;
    if (i >= c.hp.max) {
      toast('Emplacement verrouillé — débloquez une case avec + ou lors de la montée de niveau.');
      return;
    }
    c.hp.current = (i < c.hp.current) ? i : i + 1;
    syncMaxes(c); refresh();
  }));
  $$('[data-stbox]', root).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.stbox;
    if (i >= c.stress.max) {
      toast('Emplacement verrouillé — débloquez une case avec + ou lors de la montée de niveau.');
      return;
    }
    c.stress.current = (i < c.stress.current) ? i : i + 1;
    syncMaxes(c); refresh();
  }));
  $$('[data-hp-slot]', root).forEach(b => b.addEventListener('click', () => {
    const d = +b.dataset.hpSlot;
    c.hp.unlocked = Math.max(0, Math.min(14 - c.hp.active, (c.hp.unlocked || 0) + d));
    syncMaxes(c); refresh();
  }));
  $$('[data-st-slot]', root).forEach(b => b.addEventListener('click', () => {
    const d = +b.dataset.stSlot;
    c.stress.unlocked = Math.max(0, Math.min(14 - c.stress.active, (c.stress.unlocked || 0) + d));
    syncMaxes(c); refresh();
  }));
  $('[data-hlock]', root)?.addEventListener('click', () => {
    c.hp.unlocked = Math.max(0, Math.min(c.hp.unlocked, c.hp.current - c.hp.active));
    syncMaxes(c); refresh();
  });
  $('[data-slock]', root)?.addEventListener('click', () => {
    c.stress.unlocked = Math.max(0, Math.min(c.stress.unlocked, c.stress.current - c.stress.active));
    syncMaxes(c); refresh();
  });

  /* --- dégâts & mouvement de mort & états --- */
  $('#btn-take-dmg', root)?.addEventListener('click', () => openDamageModal(c, ctx.thr, ctx.activeBf, () => render(main, params)));
  $('#btn-death-move', root)?.addEventListener('click', () => openDeathMoveModal(c, () => render(main, params)));
  $$('[data-cond]', root).forEach(b => b.addEventListener('click', () => {
    const cond = b.dataset.cond;
    c.conditions = c.conditions || [];
    if (c.conditions.includes(cond)) c.conditions = c.conditions.filter(x => x !== cond);
    else c.conditions.push(cond);
    refresh();
  }));

  /* --- Espoir & Cicatrices --- */
  $$('[data-hoped]', root).forEach(d => d.addEventListener('click', () => {
    const i = +d.dataset.hoped;
    if (i >= ctx.effHopeMax) {
      toast('Emplacement condamné par une cicatrice.');
      return;
    }
    c.hope.current = (i < c.hope.current) ? i : i + 1;
    refresh();
  }));
  $$('[data-scar]', root).forEach(b => b.addEventListener('click', () => {
    const d = +b.dataset.scar;
    c.scars = Math.max(0, Math.min(6, (c.scars || 0) + d));
    c.hope.current = Math.min(c.hope.current, Math.max(0, 6 - c.scars));
    refresh();
  }));

  /* --- seuils : modal --- */
  $$('[data-thr]', root).forEach(b => b.addEventListener('click', () => editThresholds(c, () => render(main, params))));

  /* --- expériences --- */
  $$('[data-ef]', root).forEach(inp => inp.addEventListener('change', () => {
    const [i, k] = inp.dataset.ef.split(':');
    if (k === 'mod') c.experiences[+i].mod = Math.max(-9, Math.min(9, parseInt(inp.value, 10) || 0));
    else c.experiences[+i].name = inp.value;
    saveChar(c);
  }));
  $$('[data-eroll]', root).forEach(b => b.addEventListener('click', () => openRoller(c, { expIdx: +b.dataset.eroll }, ctx)));

  /* --- or : clic pastille = remplir jusqu'à N ; re-clic dernière = vider ; à 10/10 → report auto --- */
  $$('[data-goldpip]', root).forEach(p => p.addEventListener('click', () => {
    const [g, idx] = p.dataset.goldpip.split(':');
    const i = +idx;
    const cur = c.goldTrack[g];
    c.goldTrack[g] = (i + 1 === cur) ? i : i + 1; // re-clic sur la dernière remplie la vide
    /* remplissage complet d'un palier → conversion immédiate vers le palier supérieur */
    if (g === 'handfuls' && c.goldTrack.handfuls >= 10) { c.goldTrack.handfuls -= 10; c.goldTrack.bags = Math.min(10, c.goldTrack.bags + 1); toast('10 poignées → 1 sac.'); }
    if (g === 'bags' && c.goldTrack.bags >= 10) { c.goldTrack.bags -= 10; c.goldTrack.chests = Math.min(1, c.goldTrack.chests + 1); toast('10 sacs → 1 coffre.'); }
    refresh();
  }));
  /* --- or : boutons ± (report auto dès 10 unités, emprunt au palier inférieur) --- */
  $$('[data-goldbtn]', root).forEach(b => b.addEventListener('click', () => {
    const [g, d] = b.dataset.goldbtn.split(':');
    const max = g === 'chests' ? 1 : 10;
    let v = c.goldTrack[g] + (+d);
    if (v > max) { // report automatique au palier supérieur
      if (g === 'handfuls' && c.goldTrack.bags < 10) { c.goldTrack.bags++; v = 1; toast('10 poignées → 1 sac.'); }
      else if (g === 'bags' && c.goldTrack.chests < 1) { c.goldTrack.chests++; v = 1; toast('10 sacs → 1 coffre.'); }
      else v = max;
    }
    if (v === max && max === 10 && g !== 'chests') { // pile 10 : conversion immédiate (10 poignées = 1 sac)
      if (g === 'handfuls' && c.goldTrack.bags < 10) { c.goldTrack.bags++; v = 0; toast('10 poignées → 1 sac.'); }
      else if (g === 'bags' && c.goldTrack.chests < 1) { c.goldTrack.chests++; v = 0; toast('10 sacs → 1 coffre.'); }
    }
    if (v < 0) { // emprunt au palier inférieur : casser 1 unité du palier supérieur
      if (g === 'handfuls' && c.goldTrack.bags >= 1) { c.goldTrack.bags--; v = 9; toast('1 sac brisé en 10 poignées.'); }
      else if (g === 'bags' && c.goldTrack.chests >= 1) { c.goldTrack.chests--; v = 9; toast('1 coffre brisé en 10 sacs.'); }
      else v = 0;
    }
    c.goldTrack[g] = Math.max(0, Math.min(max, v));
    refresh();
  }));
  $('[data-goldconv]', root)?.addEventListener('click', () => {
    const gt = c.goldTrack;
    let moved = false;
    while (gt.handfuls >= 10 && gt.bags < 10) { gt.handfuls -= 10; gt.bags++; moved = true; }
    while (gt.bags >= 10 && gt.chests < 1) { gt.bags -= 10; gt.chests++; moved = true; }
    refresh();
    toast(moved ? 'Or converti : 10 poignées → 1 sac, 10 sacs → 1 coffre.' : 'Rien à convertir.');
  });

  /* --- armes --- */
  $$('[data-wadd]', root).forEach(b => b.addEventListener('click', () => weaponPicker(c, ctx, () => render(main, params))));
  /* --- armure : sélecteur du compendium (comme les armes) --- */
  $$('[data-aadd]', root).forEach(b => b.addEventListener('click', () => armorPicker(c, ctx, () => render(main, params))));
  $$('[data-wstate]', root).forEach(b => b.addEventListener('click', () => {
    const [i, st] = b.dataset.wstate.split(':');
    const w = c.weapons[+i];
    if (!w) return;
    w.state = st;
    if (st === 'active' && w.primary && w.hands === 'two' && c.weapons.some((x, j) => j !== +i && x.secondary)) {
      c.weapons.forEach((x, j) => { if (j !== +i) x.secondary = false; });
      toast('Arme à deux mains : l\'arme secondaire est rangée.');
    }
    refresh();
  }));
  $$('[data-whands]', root).forEach(b => b.addEventListener('click', () => {
    const [i, h] = b.dataset.whands.split(':');
    c.weapons[+i].hands = h;
    /* une arme principale passée à 2 mains déséquipe toute arme secondaire */
    if (h === 'two' && c.weapons[+i].primary) {
      c.weapons.forEach((w, j) => { if (j !== +i) w.secondary = false; });
      toast('Arme à deux mains : l\'arme secondaire est rangée.');
    }
    refresh();
  }));
  $$('[data-wrole]', root).forEach(cb => cb.addEventListener('change', () => {
    const [i, role] = cb.dataset.wrole.split(':');
    const on = cb.checked;
    const w = c.weapons[+i];
    if (!w) return;
    if (on) {
      /* P et S sont mutuellement exclusifs sur une même arme */
      w[role === 'primary' ? 'secondary' : 'primary'] = false;
      /* une seule arme P (ou S) à la fois */
      c.weapons.forEach((x, j) => { if (j !== +i) x[role] = false; });
      /* arme principale à 2 mains : pas d'arme secondaire possible */
      if (role === 'primary' && w.hands === 'two') {
        c.weapons.forEach((x, j) => { if (j !== +i) x.secondary = false; });
        toast('Arme principale à deux mains : aucune arme secondaire équipée.');
      }
    }
    w[role] = on;
    refresh();
  }));
  $$('[data-wf]', root).forEach(inp => inp.addEventListener('change', () => {
    const [i, k] = inp.dataset.wf.split(':');
    c.weapons[+i][k] = k === 'dmgBonus' ? (parseInt(inp.value, 10) || 0) : inp.value;
    saveChar(c);
    if (k === 'dice' || k === 'dmgBonus' || k === 'trait' || k === 'range' || k === 'dmgType') render(main, params);
  }));
  $$('[data-wdel]', root).forEach(b => b.addEventListener('click', () => {
    c.weapons.splice(+b.dataset.wdel, 1);
    refresh();
  }));
  $$('[data-wroll]', root).forEach(b => b.addEventListener('click', () => {
    const w = c.weapons[+b.dataset.wroll];
    if (w) rollDamage(c.id, w.uid);
  }));

  /* --- maîtrise --- */
  $$('[data-prof]', root).forEach(p => p.addEventListener('click', () => {
    const i = +p.dataset.prof;
    c.proficiency = (i + 1 === c.proficiency) ? i : i + 1;
    c.proficiency = Math.max(1, Math.min(6, c.proficiency));
    refresh();
  }));

  /* --- armure active --- */
  $$('[data-af]', root).forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.af;
    if (k === 'name' || k === 'feature') c.armorCard[k] = inp.value;
    else c.armorCard[k] = Math.max(0, parseInt(inp.value, 10) || 0);
    saveChar(c);
    if (k === 'baseScore' || k === 'baseMajor' || k === 'baseSevere') render(main, params);
  }));

  /* --- inventaire --- */
  $$('[data-qty]', root).forEach(b => b.addEventListener('click', () => {
    const [i, d] = b.dataset.qty.split(':').map(Number);
    const it = c.inventory[i];
    if (it) { it.qty = Math.max(1, (it.qty ?? 1) + d); refresh(); }
  }));
  $$('[data-use-inv]', root).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.useInv;
    const it = c.inventory[i];
    if (!it) return;
    const qty = it.qty ?? 1;
    const itemDef = it.itemId ? ctx.generalItems.find(g => g.id === it.itemId) : ctx.generalItems.find(g => g.fr === it.name);
    const desc = it.desc || itemDef?.descFr || itemDef?.descEn || '';
    if (qty <= 1) {
      c.inventory.splice(i, 1);
      toast(`« ${it.name} » utilisé (retiré de l'inventaire)${desc ? ' — ' + desc : ''}`);
    } else {
      it.qty = qty - 1;
      toast(`« ${it.name} » utilisé (${it.qty} restant(s))${desc ? ' — ' + desc : ''}`);
    }
    refresh();
  }));
  $$('[data-del-inv]', root).forEach(b => b.addEventListener('click', () => {
    c.inventory.splice(+b.dataset.delInv, 1); refresh();
  }));

  /* --- équipement depuis l'inventaire --- */
  /* équiper une armure : met à jour l'armure active, le score et les seuils */
  $$('[data-inv-eq-armor]', root).forEach(b => b.addEventListener('click', () => {
    const def = ctx.armors.find(a => a.id === b.dataset.invEqArmor);
    if (!def) return;
    if (c.armorCard?.compendiumId === def.id) {
      /* Ranger : revient à l'armure de base sans compendium */
      c.armorCard.compendiumId = null;
      toast('Armure rangée — valeurs manuelles conservées.');
    } else {
      c.armorCard = {
        compendiumId: def.id, name: def.fr,
        baseScore: def.armorScore, baseMajor: def.major, baseSevere: def.severe,
        feature: def.desc || '',
      };
      toast(`« ${def.fr} » équipée — Score ${def.armorScore}, seuils ${def.major}/${def.severe}.`);
    }
    refresh();
  }));
  /* équiper une arme : Principale si libre, sinon Secondaire (limite 2 mains au total) */
  $$('[data-inv-eq-weapon]', root).forEach(b => b.addEventListener('click', () => {
    const def = ctx.weapons.find(w => w.id === b.dataset.invEqWeapon);
    if (!def) return;
    const owned = c.weapons.find(w => w.compendiumId === def.id);
    if (owned && (owned.primary || owned.secondary)) {
      owned.primary = false; owned.secondary = false; owned.state = 'inventory';
      toast(`« ${def.fr} » rangée.`);
      refresh(); return;
    }
    if (owned) {
      /* déjà possédée mais rangée : ré-équipe selon la place */
      equipWeaponInSlot(c, owned);
      refresh(); return;
    }
    const w = {
      uid: uid(), compendiumId: def.id, name: def.fr, trait: def.trait, range: def.range,
      dice: def.dice, dmgBonus: def.dmgBonus || 0, dmgType: def.dmgType, feature: def.desc || '',
      hands: def.burden === 'twoHanded' ? 'two' : 'one',
      state: 'active', primary: false, secondary: false,
    };
    c.weapons.push(w);
    equipWeaponInSlot(c, w);
    toast(`« ${def.fr} » équipée.`);
    refresh();
  }));
  function equipWeaponInSlot(c, w) {
    const twoHandedEquipped = c.weapons.some(x => x !== w && x.primary && x.hands === 'two' && x.state === 'active');
    const primaryFree = !c.weapons.some(x => x.primary);
    if (w.hands === 'two') {
      /* 2 mains : occupe Principale et chasse toute Secondaire */
      c.weapons.forEach(x => { if (x !== w) { x.primary = false; x.secondary = false; } });
      w.primary = true; w.secondary = false; w.state = 'active';
    } else if (primaryFree && !twoHandedEquipped) {
      w.primary = true; w.state = 'active';
    } else if (!twoHandedEquipped && !c.weapons.some(x => x.secondary)) {
      w.secondary = true; w.state = 'active';
    } else {
      /* plus de place : arme portée mais non assignée */
      w.state = 'active';
      toast('Emplacements P/S occupés — arme portée, ajustez manuellement.');
    }
  }

  /* --- Actions & Attaques : boutons tactiles 3D + Avantage/Désavantage/Forme bestiale/Compagnon --- */
  $('#dha-adv', root)?.addEventListener('click', () => {
    ui.atkAdv = !ui.atkAdv;
    if (ui.atkAdv) ui.atkDis = false;
    $('#dha-adv', root).classList.toggle('on', ui.atkAdv);
    $('#dha-dis', root)?.classList.remove('on');
  });
  $('#dha-dis', root)?.addEventListener('click', () => {
    ui.atkDis = !ui.atkDis;
    if (ui.atkDis) ui.atkAdv = false;
    $('#dha-dis', root).classList.toggle('on', ui.atkDis);
    $('#dha-adv', root)?.classList.remove('on');
  });
  $('#bf-exit-fast', root)?.addEventListener('click', () => {
    c.beastform = null;
    toast('Forme bestiale quittée.');
    refresh();
  });
  $('[data-bf-atk]', root)?.addEventListener('click', () => {
    if (!ctx.activeBf) return;
    rollDuality({
      mod: ctx.effTrait(ctx.activeBf.trait),
      label: `Forme bestiale : ${ctx.activeBf.fr}`,
      charId: c.id,
      advantage: ui.atkAdv,
      disadvantage: ui.atkDis,
    });
  });
  $('[data-bf-dmg]', root)?.addEventListener('click', () => {
    if (!ctx.activeBf) return;
    const n = Math.max(1, Math.min(6, c.proficiency));
    const bonus = parseInt(ctx.activeBf.dmgBonus, 10) || 0;
    const note = bonus ? `${n}${ctx.activeBf.dmgDice}${bonus > 0 ? '+' + bonus : bonus}` : `${n}${ctx.activeBf.dmgDice}`;
    rollDice(note, { label: `Dégâts — ${ctx.activeBf.fr}` });
  });
  $('[data-comp-atk]', root)?.addEventListener('click', () => {
    if (!c.companion) return;
    rollDuality({
      mod: ctx.effTrait('instinct'),
      label: `${c.companion.name || 'Compagnon'} · ${c.companion.attackName || 'Attaque'}`,
      charId: c.id,
      advantage: ui.atkAdv,
      disadvantage: ui.atkDis,
    });
  });
  $('[data-comp-dmg]', root)?.addEventListener('click', () => {
    if (!c.companion) return;
    const n = Math.max(1, Math.min(6, c.proficiency));
    rollDice(`${n}${c.companion.dice || 'd6'}`, { label: `Dégâts — ${c.companion.name || 'Compagnon'}` });
  });
  $$('[data-dha-atk]', root).forEach(b => b.addEventListener('click', () => {
    const w = c.weapons?.find(x => x.uid === b.dataset.dhaAtk);
    const extraMod = w ? ctx.traitBonusOf(w.trait) : 0;
    rollAttack(c.id, b.dataset.dhaAtk, {
      advantage: ui.atkAdv,
      disadvantage: ui.atkDis,
      extraMod,
      extraLabel: extraMod && ctx.activeBf ? ctx.activeBf.fr : '',
    });
  }));
  $$('[data-dha-dmg]', root).forEach(b => b.addEventListener('click', () => {
    rollDamage(c.id, b.dataset.dhaDmg);
  }));

  $('#inv-add', root)?.addEventListener('click', () => {
    const inp = $('#inv-new', root);
    if (inp.value.trim()) { c.inventory.push({ name: inp.value.trim(), qty: 1 }); refresh(); }
  });
  $('#inv-new', root)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#inv-add', root).click(); });
  $('#inv-catalog', root)?.addEventListener('click', () => openInventoryCatalog(c, ctx, () => render(main, params)));
  const q = $('#inv-q', root), sug = $('#inv-suggest', root);
  if (q) q.addEventListener('input', () => {
    const s = q.value.trim().toLowerCase();
    if (s.length < 2) { sug.innerHTML = ''; return; }
    /* recherche unifiée : objets généraux + armes + armures du compendium */
    const itemHits = ctx.generalItems.filter(g => (g.fr + ' ' + g.en + ' ' + (g.descFr || '')).toLowerCase().includes(s)).slice(0, 6)
      .map(g => ({ kind: 'item', itemType: g.type, id: g.id, fr: g.fr, icon: g.type === 'consumable' ? '🧪' : '🎁', sub: `${g.type === 'consumable' ? 'Consommable' : 'Butin'}${g.rarity ? ' · ' + g.rarity : ''}${g.campaign ? ' · ' + (CAMPAIGN_LABELS[g.campaign] || g.campaign) : ''}`, desc: g.descFr || g.descEn || '' }));
    const weaponHits = ctx.weapons.filter(w => (w.fr + ' ' + w.en + ' ' + (w.desc || '')).toLowerCase().includes(s)).slice(0, 4)
      .map(w => ({ kind: 'weapon', id: w.id, fr: w.fr, icon: '⚔', sub: `${T.traits[w.trait] || ''} · ${w.range} · ${w.dice}${fmtBonus(w.dmgBonus)}${w.burden === 'twoHanded' ? ' · 2 mains' : ''}${w.campaign ? ' · ' + (CAMPAIGN_LABELS[w.campaign] || w.campaign) : ''}`, desc: w.desc || '' }));
    const armorHits = ctx.armors.filter(a => (a.fr + ' ' + (a.en || '') + ' ' + (a.desc || '')).toLowerCase().includes(s)).slice(0, 4)
      .map(a => ({ kind: 'armor', id: a.id, fr: a.fr, icon: '🛡', sub: `Armure · Score ${a.armorScore} · Seuils ${a.major}/${a.severe}${a.heavy ? ' · Lourd' : ''}${a.campaign ? ' · ' + (CAMPAIGN_LABELS[a.campaign] || a.campaign) : ''}`, desc: a.desc || '' }));
    const hits = [...itemHits, ...weaponHits, ...armorHits].slice(0, 12);
    sug.innerHTML = hits.map(g => `
      <button class="inv-sug" data-add-id="${g.id}" data-add-kind="${g.kind}">
        <span class="is-type">${g.icon}</span>
        <span class="is-body"><span class="is-name">${esc(g.fr)}</span>
        <span class="is-sub">${esc(g.sub)}${g.desc ? ' — ' + esc(g.desc.slice(0, 90)) + (g.desc.length > 90 ? '…' : '') : ''}</span></span>
        <span class="is-add">＋</span>
      </button>`).join('');
    $$('[data-add-id]', sug).forEach(b => b.addEventListener('click', () => {
      const hit = hits.find(x => x.id === b.dataset.addId);
      if (!hit) return;
      const ex = c.inventory.find(x => x.itemId === hit.id);
      if (ex) ex.qty = (ex.qty ?? 1) + 1;
      else c.inventory.push({ name: hit.fr, qty: 1, desc: hit.desc, itemId: hit.id, ...(hit.itemType ? { type: hit.itemType } : {}) });
      q.value = ''; sug.innerHTML = '';
      refresh();
      toast(`« ${hit.fr} » ajouté à l'inventaire.`);
    }));
  });

  /* --- onglets mobiles & plus --- */
  $$('[data-mtab]', root).forEach(b => b.addEventListener('click', () => {
    ui.mtab = b.dataset.mtab;
    $$('.dh-mtabs .mt', root).forEach(x => x.classList.toggle('active', x.dataset.mtab === ui.mtab));
    const sheetEl = $('.dh-sheet', root);
    if (sheetEl) sheetEl.dataset.mtab = ui.mtab;
  }));
  $$('[data-stab]', root).forEach(b => b.addEventListener('click', () => {
    ui.more = b.dataset.stab;
    render(main, params);
  }));

  /* --- actions d'en-tête : repos court / repos long guidés --- */
  $('#rest-short', root).addEventListener('click', () => openRestModal(c, 'short', () => render(main, params)));
  $('#rest-long', root).addEventListener('click', () => openRestModal(c, 'long', () => render(main, params)));
  $('#btn-export', root).addEventListener('click', () => {
    const slug = (c.name || 'perso').toLowerCase().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'perso';
    exportJsonFile(`daggerborne-${slug}.json`, c, `Exporter ${c.name || 'le personnage'}`);
  });
  $('#btn-import', root).addEventListener('click', () => $('#file-import', root).click());
  $('#file-import', root).addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = importCharacterFromText(rd.result);
        toast(`« ${obj.name} » importé.`);
        go('sheet', obj.id);
      } catch (err) { toast('Fichier invalide : export de personnage attendu.'); }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
  $('#btn-delete', root).addEventListener('click', () => {
    if (!confirm(`Supprimer définitivement « ${c.name} » ?`)) return;
    setState(s => { s.characters = s.characters.filter(x => x.id !== c.id); });
    go('chars');
  });
}

/* ============ OVERLAY : Dés de Dualité (2d12) ============ */
function openRoller(c, preset = {}, ctx = null) {
  const back = el(`<div class="modal-back"></div>`);
  const box = el(`<div class="modal-sheet dh-roll"></div>`);
  back.appendChild(box);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const expList = c.experiences.map((e, i) => ({ i, e })).filter(x => x.e.name && x.e.name.trim());
  const traitVal = (k) => (ctx?.effTrait ? ctx.effTrait(k) : (c.traits[k] || 0));
  box.innerHTML = `
    <h3>Jet d'action — ${esc(c.name || 'Personnage')}</h3>
    <div class="ms-meta">Dés de Dualité : 1d12 Espoir + 1d12 Peur + modificateurs.</div>
    <div class="dhr-dice">
      <div class="dhr-die hope"><span class="l">Espoir d12</span><span class="v" id="dhr-h">—</span></div>
      <span class="dhr-vs">+</span>
      <div class="dhr-die fear"><span class="l">Peur d12</span><span class="v" id="dhr-f">—</span></div>
    </div>
    <div class="dhr-mods">
      <select id="dhr-trait">
        <option value="">— Trait —</option>
        ${TRAIT_KEYS.map(k => `<option value="${k}" ${preset.trait === k ? 'selected' : ''}>${T.traits[k]} ${signed(traitVal(k))}</option>`).join('')}
      </select>
      <select id="dhr-exp">
        <option value="">— Expérience —</option>
        ${expList.map(x => `<option value="${x.i}" ${preset.expIdx === x.i ? 'selected' : ''}>✦ ${esc(x.e.name)} (${signed(x.e.mod)})</option>`).join('')}
      </select>
    </div>
    <label class="dhr-hopespend"><input type="checkbox" id="dhr-spend" checked> Dépenser 1 Espoir pour l'Expérience</label>
    <div class="dhr-toggles">
      <button class="btn ghost small" id="dhr-adv">▲ Avantage (d6)</button>
      <button class="btn ghost small" id="dhr-dis">▼ Désavantage (d6)</button>
    </div>
    <div class="dhr-result" id="dhr-res"></div>
    <div class="dhr-btns">
      <button class="btn ghost" id="dhr-close">Fermer</button>
      <button class="btn" id="dhr-go">✦ Lancer les dés</button>
    </div>`;

  let adv = false, dis = false;
  $('#dhr-close', box).addEventListener('click', () => back.remove());
  $('#dhr-adv', box).addEventListener('click', () => { adv = !adv; if (adv) dis = false; $('#dhr-adv', box).classList.toggle('sel', adv); $('#dhr-dis', box).classList.remove('sel'); });
  $('#dhr-dis', box).addEventListener('click', () => { dis = !dis; if (dis) adv = false; $('#dhr-dis', box).classList.toggle('sel', dis); $('#dhr-adv', box).classList.remove('sel'); });

  $('#dhr-go', box).addEventListener('click', async function rollAction() {
    if (this.dataset.rolling === '1') return;
    this.dataset.rolling = '1';
    this.disabled = true;
    const unlock = () => { this.dataset.rolling = ''; this.disabled = false; };

    const traitK = $('#dhr-trait', box).value || null;
    const expI = $('#dhr-exp', box).value === '' ? null : +$('#dhr-exp', box).value;
    const spend = $('#dhr-spend', box).checked && expI !== null;

    if (isRolling()) { toast('Un lancer de dés est déjà en cours.'); unlock(); return; }
    if (spend && c.hope.current < 1) { toast("Pas assez d'Espoir pour utiliser cette Expérience."); unlock(); return; }
    const prevHope = c.hope.current;
    if (spend) { c.hope.current -= 1; saveChar(c); }

    let mod = 0; const parts = [];
    if (traitK) {
      mod += traitVal(traitK);
      const bfNote = ctx?.traitBonusOf?.(traitK) ? ` +${ctx.traitBonusOf(traitK)} Forme` : '';
      parts.push(`${T.traits[traitK]}${bfNote}`);
    }
    if (expI !== null) { mod += c.experiences[expI].mod; parts.push(`✦ ${c.experiences[expI].name}`); }
    const label = parts.length ? parts.join(' + ') : "Jet d'action";

    /* ferme la fenêtre immédiatement pour laisser voir les dés 3D rouler (y compris d6 Avantage/Désavantage) */
    back.remove();

    const r = await rollDuality({ mod, label, charId: c.id, advantage: adv, disadvantage: dis });
    unlock();
    if (!r) {
      if (spend) { c.hope.current = prevHope; saveChar(c); }
      return;
    }
    if (ctx) render(ctx.main, ctx.params);
  });
}

/* ============ MODAL : Calculateur de dégâts & Armure ============ */
function openDamageModal(c, thr, activeBf, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const armMax = Math.max(0, Math.min(12, c.armorCard.baseScore || 0));
  const armAvail = Math.max(0, armMax - (c.armorSlots.used || 0));
  const massiveRule = !!getState().settings?.massiveDamageRule;

  sheet.innerHTML = `
    <h3>Encaisser des dégâts</h3>
    <div class="ms-meta">Seuils actuels : Majeurs ≥ <b>${thr.major}</b> · Graves ≥ <b>${thr.severe}</b>${massiveRule ? ` · Massifs ≥ <b>${thr.severe * 2}</b>` : ''}</div>
    <div class="field" style="margin:.7rem 0">
      <label>Dégâts bruts reçus</label>
      <input type="number" id="dmg-amt" min="0" max="999" value="10" style="font-size:1.1rem;font-weight:800">
    </div>
    <label class="dhr-hopespend" style="margin:.4rem 0">
      <input type="checkbox" id="dmg-armor" ${armAvail > 0 ? '' : 'disabled'}>
      Dépenser 1 emplacement d'armure (${armAvail}/${armMax} dispo — réduit d'un palier)
    </label>
    <label class="dhr-hopespend" style="margin:.4rem 0">
      <input type="checkbox" id="dmg-direct">
      Dégâts directs (ignore l'armure)
    </label>
    <div class="panel" id="dmg-preview" style="margin:.75rem 0;padding:.65rem"></div>
    <div style="display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="dmg-cancel">Annuler</button>
      <button class="btn" id="dmg-apply">Appliquer</button>
    </div>`;

  const compute = () => {
    const amt = Math.max(0, parseInt($('#dmg-amt', sheet).value, 10) || 0);
    const direct = $('#dmg-direct', sheet).checked;
    const armEl = $('#dmg-armor', sheet);
    armEl.disabled = direct || armAvail <= 0;
    if (direct) armEl.checked = false;
    const useArmor = armEl.checked;
    const res = computeDamageApplication({
      dmg: amt, major: thr.major, severe: thr.severe,
      useArmor, armorAvailable: armAvail, direct, massiveRule,
    });
    const newHp = Math.max(0, c.hp.current - res.hpMarked);
    $('#dmg-preview', sheet).innerHTML = `
      <div style="font-size:.82rem;color:var(--text-dim)">Palier brut : <b>${esc(res.base.label)}</b> (${res.base.hp} PV)</div>
      <div style="font-size:.98rem;font-weight:800;color:var(--golden);margin-top:.2rem">
        Effet : −${res.hpMarked} PV (${c.hp.current} → ${newHp}/${c.hp.max})${res.armorSpent ? ' · −1 Armure' : ''}
      </div>
      ${newHp === 0 && res.hpMarked > 0 ? '<div style="font-size:.76rem;color:#ffb4b4;margin-top:.25rem">⚠ Tombe à 0 PV → déclenche un Mouvement de mort !</div>' : ''}`;
    return res;
  };

  compute();
  $('#dmg-amt', sheet).addEventListener('input', compute);
  $('#dmg-armor', sheet).addEventListener('change', compute);
  $('#dmg-direct', sheet).addEventListener('change', compute);
  $('#dmg-cancel', sheet).addEventListener('click', () => back.remove());
  $('#dmg-apply', sheet).addEventListener('click', () => {
    const res = compute();
    c.hp.current = Math.max(0, c.hp.current - res.hpMarked);
    c.armorSlots.used = Math.min(12, (c.armorSlots.used || 0) + res.armorSpent);
    saveChar(c);
    back.remove();
    toast(`−${res.hpMarked} PV (${res.finalLabel})${res.armorSpent ? ' · 1 emplacement d’armure coché' : ''}.`);
    if (activeBf && res.base.level >= 2) {
      toast('Forme bestiale Fragile : vérifiez si vous quittez la forme (dégâts Majeurs+).');
    }
    onDone();
    if (c.hp.current === 0 && res.hpMarked > 0) {
      openDeathMoveModal(c, onDone);
    }
  });
}

/* ============ MODAL : Mouvement de mort (SRD 2.0) ============ */
function openDeathMoveModal(c, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  sheet.innerHTML = `
    <h3>💀 Mouvement de mort — ${esc(c.name || 'Personnage')}</h3>
    <div class="ms-meta">À 0 PV, choisissez l'une des trois issues (SRD 2.0) :</div>
    <div style="display:flex;flex-direction:column;gap:.55rem;margin:.8rem 0">
      <button class="inv-sug" id="dm-avoid" style="text-align:left">
        <span class="is-type">🛡️</span>
        <span class="is-body">
          <span class="is-name">Éviter la mort</span>
          <span class="is-sub">Vous sombrez dans l'inconscience. Lancez le dé d'Espoir (1d12) : si résultat ≤ Niveau (${c.level}), vous gagnez 1 Cicatrice (losange d'Espoir condamné).</span>
        </span>
      </button>
      <button class="inv-sug" id="dm-risk" style="text-align:left">
        <span class="is-type">🎲</span>
        <span class="is-body">
          <span class="is-name">Tout risquer</span>
          <span class="is-sub">Lancez les Dés de Dualité : sur un Double (Critique), tous vos PV et Stress sont restaurés ! Si Espoir &gt; Peur, vous guérissez autant de PV que le dé d'Espoir ; sinon vous mourez.</span>
        </span>
      </button>
      <button class="inv-sug" id="dm-blaze" style="text-align:left">
        <span class="is-type">🔥</span>
        <span class="is-body">
          <span class="is-name">Baroud d'honneur</span>
          <span class="is-sub">Une ultime action héroïque devient automatiquement un Succès Critique, puis votre personnage franchit le voile de la mort.</span>
        </span>
      </button>
    </div>
    <div class="modal-close-row"><button class="btn ghost small" id="dm-close">Fermer</button></div>`;

  $('#dm-close', sheet).addEventListener('click', () => back.remove());
  $('#dm-blaze', sheet).addEventListener('click', () => {
    c.conditions = Array.from(new Set([...(c.conditions || []), 'Baroud d’honneur']));
    saveChar(c);
    back.remove();
    toast('🔥 Baroud d’honneur ! Action Critique automatique, puis repos éternel.');
    onDone();
  });
  $('#dm-avoid', sheet).addEventListener('click', async () => {
    back.remove();
    const r = await rollDice('1d12', { label: `Éviter la mort (Niv. ${c.level})` });
    if (!r) return;
    if (r.total <= c.level) {
      c.scars = Math.min(6, (c.scars || 0) + 1);
      c.hope.current = Math.min(c.hope.current, Math.max(0, 6 - c.scars));
      saveChar(c);
      toast(`Dé d'Espoir ${r.total} ≤ ${c.level} → +1 Cicatrice (${c.scars}/6) !`);
    } else {
      toast(`Dé d'Espoir ${r.total} > ${c.level} → Pas de cicatrice !`);
    }
    onDone();
  });
  $('#dm-risk', sheet).addEventListener('click', async () => {
    back.remove();
    const r = await rollDuality({ label: 'Mouvement de mort — Tout risquer', charId: c.id });
    if (!r) return;
    if (r.result === 'crit' || r.hope === r.fear) {
      c.hp.current = c.hp.max;
      c.stress.current = 0;
      saveChar(c);
      toast(`Tout risquer — Succès Critique (double ${r.hope}) ! Tous les PV (${c.hp.max}) et le Stress sont restaurés !`);
    } else if (r.hope > r.fear) {
      c.hp.current = Math.min(c.hp.max, Math.max(1, r.hope));
      saveChar(c);
      toast(`Tout risquer réussi (${r.hope} vs ${r.fear}) — PV restaurés jusqu'à ${c.hp.current}/${c.hp.max} !`);
    } else {
      toast(`Tout risquer échoué (Peur ${r.fear} > Espoir ${r.hope}) — Le personnage succombe.`);
    }
    onDone();
  });
}

/* ============ MODAL : Repos court / Repos long guidés (SRD 2.0) ============ */
function openRestModal(c, mode, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const tier = tierOf(c.level);
  const isLong = mode === 'long';
  const moves = isLong
    ? [
        { id: 'heal', label: 'Soigner toutes ses blessures', desc: 'Restaure tous les PV au maximum.' },
        { id: 'stress', label: 'Effacer tout son Stress', desc: 'Remet la jauge de Stress à 0.' },
        { id: 'armor', label: 'Réparer toute son armure', desc: 'Libère tous les emplacements d’armure.' },
        { id: 'prepare', label: 'Se préparer (+1 Espoir, ou +2 avec un allié)', desc: 'Gagne +1 Espoir (cochez « Avec un allié » pour +2).' },
        { id: 'project', label: 'Avancer sur un projet long', desc: 'Progression narrative / horloge de projet.' },
      ]
    : [
        { id: 'heal', label: `Soigner ses blessures (1d4 + ${tier})`, desc: `Efface 1d4 + ${tier} (Palier ${tier}) PV marqués.` },
        { id: 'stress', label: `Apaiser son Stress (1d4 + ${tier})`, desc: `Efface 1d4 + ${tier} (Palier ${tier}) Stress.` },
        { id: 'armor', label: `Réparer son armure (1d4 + ${tier})`, desc: `Libère 1d4 + ${tier} emplacements d'armure.` },
        { id: 'prepare', label: 'Se préparer (+1 Espoir, ou +2 avec un allié)', desc: 'Gagne +1 Espoir (ou +2 avec un allié).' },
      ];

  const picked = new Set(isLong ? ['heal', 'stress'] : ['stress', 'armor']);
  sheet.innerHTML = `
    <h3>${isLong ? '🌙 Repos long' : '⛺ Repos court'} — Temps mort (2 mouvements)</h3>
    <div class="ms-meta">${isLong
      ? 'Choisissez 2 mouvements de repos long. Les aptitudes 1×/repos et 1×/long repos sont réinitialisées.'
      : `Choisissez jusqu'à 2 mouvements de repos court (Palier ${tier}). Repos courts depuis le dernier long : ${c.shortRestsSinceLong || 0}.`}</div>
    ${!isLong && (c.shortRestsSinceLong || 0) >= 3 ? '<div class="panel" style="margin:.5rem 0;padding:.5rem;border-color:#d46868;color:#ffb4b4;font-size:.78rem">⚠ Déjà 3 repos courts consécutifs — selon le SRD 2.0, un repos long est nécessaire après 3 repos courts.</div>' : ''}
    <div style="display:flex;flex-direction:column;gap:.4rem;margin:.7rem 0" id="rest-moves">
      ${moves.map(m => `
      <label class="dhr-hopespend" style="align-items:flex-start;margin:0;padding:.4rem .5rem;border:1px solid var(--border);border-radius:8px;background:var(--panel-3)">
        <input type="checkbox" data-rmove="${m.id}" ${picked.has(m.id) ? 'checked' : ''} style="margin-top:.15rem">
        <span><b>${esc(m.label)}</b><br><small style="color:var(--text-faint)">${esc(m.desc)}</small></span>
      </label>`).join('')}
    </div>
    <label class="dhr-hopespend" style="margin:.4rem 0">
      <input type="checkbox" id="rest-ally">
      Se préparer avec un allié (+2 Espoir au lieu de +1 si « Se préparer » choisi)
    </label>
    <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem">
      <button class="btn ghost" id="rest-cancel">Annuler</button>
      <button class="btn" id="rest-go">Appliquer le repos</button>
    </div>`;

  $$('[data-rmove]', sheet).forEach(cb => cb.addEventListener('change', () => {
    const id = cb.dataset.rmove;
    if (cb.checked) {
      if (picked.size >= 2) {
        cb.checked = false;
        toast('Maximum 2 mouvements par repos.');
        return;
      }
      picked.add(id);
    } else {
      picked.delete(id);
    }
  }));

  $('#rest-cancel', sheet).addEventListener('click', () => back.remove());
  $('#rest-go', sheet).addEventListener('click', () => {
    const logs = [];
    const effHopeMax = Math.max(0, 6 - (c.scars || 0));
    const d4Roll = () => (1 + Math.floor(Math.random() * 4)) + tier;
    if (isLong) {
      if (picked.has('heal')) { c.hp.current = c.hp.max; logs.push('PV au max'); }
      if (picked.has('stress')) {
        c.stress.current = 0;
        if (c.companion?.stress) c.companion.stress.current = 0;
        logs.push('Stress 0');
      }
      if (picked.has('armor')) { c.armorSlots.used = 0; logs.push('Armure réparée'); }
      if (picked.has('prepare')) {
        const gain = $('#rest-ally', sheet).checked ? 2 : 1;
        c.hope.current = Math.min(effHopeMax, c.hope.current + gain);
        logs.push(`+${gain} Espoir`);
      }
      if (picked.has('project')) logs.push('Projet avancé');
      c.shortRestsSinceLong = 0;
      c.cardUses = {};
    } else {
      if (picked.has('heal')) {
        const v = d4Roll();
        c.hp.current = Math.min(c.hp.max, c.hp.current + v);
        logs.push(`+${v} PV`);
      }
      if (picked.has('stress')) {
        const v = d4Roll();
        c.stress.current = Math.max(0, c.stress.current - v);
        if (c.companion?.stress) c.companion.stress.current = Math.max(0, (c.companion.stress.current || 0) - v);
        logs.push(`−${v} Stress`);
      }
      if (picked.has('armor')) {
        const v = d4Roll();
        c.armorSlots.used = Math.max(0, (c.armorSlots.used || 0) - v);
        logs.push(`−${v} Armure`);
      }
      if (picked.has('prepare')) {
        const gain = $('#rest-ally', sheet).checked ? 2 : 1;
        c.hope.current = Math.min(effHopeMax, c.hope.current + gain);
        logs.push(`+${gain} Espoir`);
      }
      c.shortRestsSinceLong = (c.shortRestsSinceLong || 0) + 1;
      for (const k of Object.keys(c.cardUses || {})) {
        if (!k.startsWith('long:')) delete c.cardUses[k];
      }
    }
    saveChar(c);
    back.remove();
    toast(`${isLong ? 'Repos long' : 'Repos court'} appliqué${logs.length ? ' : ' + logs.join(' · ') : ''}.`);
    onDone();
  });
}

/* ============ MODAL : seuils (bonus d'aptitudes) ============ */
function editThresholds(c, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const t = thresholds(c);
  sheet.innerHTML = `
    <h3>Seuils de dégâts</h3>
    <div class="ms-meta">Règle (livre p. 98) — comparez les dégâts reçus à vos seuils :</div>
    <div class="ms-body">
      <p>
        <b style="color:#9fe0b0">Dégâts Mineurs</b> : &lt; seuil Majeur → <b>1 PV</b><br>
        <b style="color:#ff9d6f">Dégâts Majeurs</b> : ≥ seuil Majeur (et &lt; Grave) → <b>2 PV</b><br>
        <b style="color:#ff6b6b">Dégâts Graves</b> : ≥ seuil Grave → <b>3 PV</b>
      </p>
      <p class="dh-help">Seuils = base de votre armure (${c.armorCard.baseMajor}/${c.armorCard.baseSevere}, modifiable dans « Armure active ») + Niveau ${c.level} + bonus d'aptitudes.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin:.8rem 0">
        <div class="field" style="margin:0"><label>Seuil Majeur (calculé)</label>
          <div class="dh-thr-live" id="lv-major">${t.major}</div></div>
        <div class="field" style="margin:0"><label>Seuil Grave (calculé)</label>
          <div class="dh-thr-live" id="lv-severe">${t.severe}</div></div>
      </div>
      <div class="field" style="margin:0"><label>Bonus d'aptitudes (ex. Peau épaisse +2)</label>
        <input type="number" id="thr-bonus" min="-9" max="20" value="${c.thresholds.bonus || 0}"></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem">
        <button class="btn ghost" id="thr-cancel">Annuler</button>
        <button class="btn" id="thr-save">Enregistrer</button>
      </div>
    </div>`;

  $('#thr-bonus', sheet).addEventListener('input', () => {
    const b = parseInt($('#thr-bonus', sheet).value, 10) || 0;
    $('#lv-major', sheet).textContent = (c.armorCard.baseMajor || 0) + c.level + b;
    $('#lv-severe', sheet).textContent = (c.armorCard.baseSevere || 0) + c.level + b;
  });
  $('#thr-cancel', sheet).addEventListener('click', () => back.remove());
  $('#thr-save', sheet).addEventListener('click', () => {
    c.thresholds.bonus = Math.max(-9, Math.min(20, parseInt($('#thr-bonus', sheet).value, 10) || 0));
    saveChar(c);
    back.remove();
    toast(`Seuils : ${thresholds(c).major} / ${thresholds(c).severe}`);
    onDone();
  });
}

/* ============ MODAL : choisir une arme ============ */
function weaponPicker(c, ctx, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  let tierFilter = null;
  let query = '';
  sheet.innerHTML = `
    <h3>Ajouter une arme (${ctx.weapons.length})</h3>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="wp-q" placeholder="Rechercher (nom, trait, feature…)" autocomplete="off">
    </div>
    <div class="filter-row" id="wp-tiers" style="margin:.45rem 0">
      <button class="filter-chip active" data-wtier="">Tous</button>
      <button class="filter-chip" data-wtier="1">Palier 1</button>
      <button class="filter-chip" data-wtier="2">Palier 2</button>
      <button class="filter-chip" data-wtier="3">Palier 3</button>
      <button class="filter-chip" data-wtier="4">Palier 4</button>
    </div>
    <div id="wp-list" class="wp-list"></div>
    <div style="margin-top:.8rem;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="wp-cancel">Annuler</button>
      <button class="btn" id="wp-custom">✎ Arme personnalisée</button>
    </div>`;

  const draw = () => {
    const q = query.toLowerCase();
    const hits = ctx.weapons
      .filter(w => (!tierFilter || w.tier === tierFilter))
      .filter(w => !q || (w.fr + ' ' + w.en + ' ' + (w.desc || '')).toLowerCase().includes(q))
      .sort((a, b) => a.tier - b.tier || a.fr.localeCompare(b.fr, 'fr'))
      .slice(0, 60);
    $('#wp-list', sheet).innerHTML = hits.map(w => `
      <button class="inv-sug" data-pickid="${w.id}">
        <span class="is-body">
          <span class="is-name">${esc(w.fr)} <span class="tag" style="margin-left:4px">P${w.tier}</span>${w.campaign ? ` <span class="tag">${esc(CAMPAIGN_LABELS[w.campaign] || w.campaign)}</span>` : ''}</span>
          <span class="is-sub">${T.traits[w.trait] || ''} · ${esc(w.range)} · ${w.dice}${fmtBonus(w.dmgBonus)} (${w.dmgType === 'mag' ? 'mag' : 'phy'}) · ${w.burden === 'twoHanded' ? '2 mains' : '1 main'}${w.secondary ? ' · Sec.' : ''}</span>
          ${w.desc ? `<span class="is-sub" style="color:var(--text-faint);margin-top:2px">${esc(w.desc)}</span>` : ''}
        </span>
        <span class="is-add">＋</span>
      </button>`).join('') || '<div class="dh-help">Aucune arme trouvée.</div>';
    $$('[data-pickid]', sheet).forEach(b => b.addEventListener('click', () => {
      const w = ctx.weapons.find(x => x.id === b.dataset.pickid);
      c.weapons.push({
        uid: uid(), compendiumId: w.id, name: w.fr, trait: w.trait, range: w.range,
        dice: w.dice, dmgBonus: w.dmgBonus || 0, dmgType: w.dmgType, feature: w.desc || '',
        hands: w.burden === 'twoHanded' ? 'two' : 'one',
        state: 'active', primary: !c.weapons.some(x => x.primary), secondary: false,
      });
      saveChar(c);
      back.remove();
      toast(`« ${w.fr} » ajoutée.`);
      onDone();
    }));
  };
  draw();
  $$('[data-wtier]', sheet).forEach(b => b.addEventListener('click', () => {
    $$('[data-wtier]', sheet).forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    tierFilter = b.dataset.wtier ? +b.dataset.wtier : null;
    draw();
  }));
  $('#wp-q', sheet).addEventListener('input', (e) => { query = e.target.value.trim(); draw(); });
  $('#wp-cancel', sheet).addEventListener('click', () => back.remove());
  $('#wp-custom', sheet).addEventListener('click', () => {
    c.weapons.push({
      uid: uid(), compendiumId: null, name: '', trait: 'strength', range: 'Mêlée',
      dice: 'd6', dmgBonus: 0, dmgType: 'phy', feature: '', hands: 'one',
      state: 'active', primary: !c.weapons.some(x => x.primary), secondary: false,
    });
    saveChar(c);
    back.remove();
    onDone();
  });
}

/* ================= SÉLECTEUR D'ARMURE (comme les armes) ================= */
function armorPicker(c, ctx, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  let tierFilter = null;
  let query = '';
  sheet.innerHTML = `
    <h3>Choisir une armure (${ctx.armors.length})</h3>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="ap-q" placeholder="Rechercher (nom, feature…)" autocomplete="off">
    </div>
    <div class="filter-row" id="ap-tiers" style="margin:.45rem 0">
      <button class="filter-chip active" data-atier="">Tous</button>
      <button class="filter-chip" data-atier="1">Palier 1</button>
      <button class="filter-chip" data-atier="2">Palier 2</button>
      <button class="filter-chip" data-atier="3">Palier 3</button>
      <button class="filter-chip" data-atier="4">Palier 4</button>
    </div>
    <div id="ap-list" class="wp-list"></div>
    <div style="margin-top:.8rem;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="ap-cancel">Annuler</button>
      <button class="btn" id="ap-custom">✎ Armure personnalisée</button>
    </div>`;

  const draw = () => {
    const q = query.toLowerCase();
    const hits = ctx.armors
      .filter(a => (!tierFilter || a.tier === tierFilter))
      .filter(a => !q || (a.fr + ' ' + (a.en || '') + ' ' + (a.desc || '')).toLowerCase().includes(q))
      .sort((a, b) => a.tier - b.tier || a.fr.localeCompare(b.fr, 'fr'))
      .slice(0, 60);
    $('#ap-list', sheet).innerHTML = hits.map(a => `
      <button class="inv-sug" data-apick="${a.id}">
        <span class="is-body">
          <span class="is-name">${esc(a.fr)} <span class="tag" style="margin-left:4px">P${a.tier}</span>${a.campaign ? ` <span class="tag">${esc(CAMPAIGN_LABELS[a.campaign] || a.campaign)}</span>` : ''}</span>
          <span class="is-sub">Score ${a.armorScore} · Seuils ${a.major}/${a.severe}${a.heavy ? ' · Lourd' : ''}</span>
          ${a.desc ? `<span class="is-sub" style="color:var(--text-faint);margin-top:2px">${esc(a.desc)}</span>` : ''}
        </span>
        <span class="is-add">＋</span>
      </button>`).join('') || '<div class="dh-help">Aucune armure trouvée.</div>';
    $$('[data-apick]', sheet).forEach(b => b.addEventListener('click', () => {
      const a = ctx.armors.find(x => x.id === b.dataset.apick);
      if (!a) return;
      c.armorCard = {
        compendiumId: a.id, name: a.fr,
        baseScore: a.armorScore, baseMajor: a.major, baseSevere: a.severe,
        feature: a.desc || '',
      };
      c.armorId = a.id; /* cohérence avec les anciens champs */
      saveChar(c);
      back.remove();
      toast(`« ${a.fr} » équipée — Score ${a.armorScore}, seuils ${a.major}/${a.severe}.`);
      onDone();
    }));
  };
  draw();
  $$('[data-atier]', sheet).forEach(b => b.addEventListener('click', () => {
    $$('[data-atier]', sheet).forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    tierFilter = b.dataset.atier ? +b.dataset.atier : null;
    draw();
  }));
  $('#ap-q', sheet).addEventListener('input', (e) => { query = e.target.value.trim(); draw(); });
  $('#ap-cancel', sheet).addEventListener('click', () => back.remove());
  $('#ap-custom', sheet).addEventListener('click', () => {
    /* armure vierge : l'utilisateur remplit les champs manuellement */
    c.armorCard = { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' };
    saveChar(c);
    back.remove();
    toast('Armure personnalisée — remplissez les champs.');
    onDone();
  });
}

/* ================= CATALOGUE D'INVENTAIRE COMPLET ================= */
function openInventoryCatalog(c, ctx, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  let changed = false;
  const finish = () => {
    back.remove();
    if (changed) onDone();
  };
  back.addEventListener('click', (e) => { if (e.target === back) finish(); });

  let cat = 'all';
  let query = '';
  const allEntries = [
    ...ctx.generalItems.map(g => ({
      kind: 'item', itemType: g.type, id: g.id, fr: g.fr, en: g.en || '',
      icon: g.type === 'consumable' ? '🧪' : '🎁',
      sub: `${g.type === 'consumable' ? 'Consommable' : 'Butin'}${g.rarity ? ' · ' + g.rarity : ''}${g.campaign ? ' · ' + (CAMPAIGN_LABELS[g.campaign] || g.campaign) : ''}`,
      desc: g.descFr || g.descEn || '',
    })),
    ...ctx.weapons.map(w => ({
      kind: 'weapon', itemType: 'weapon', id: w.id, fr: w.fr, en: w.en || '',
      icon: '⚔',
      sub: `Arme P${w.tier} · ${T.traits[w.trait] || ''} · ${w.range} · ${w.dice}${fmtBonus(w.dmgBonus)} · ${w.burden === 'twoHanded' ? '2 mains' : '1 main'}${w.campaign ? ' · ' + (CAMPAIGN_LABELS[w.campaign] || w.campaign) : ''}`,
      desc: w.desc || '',
    })),
    ...ctx.armors.map(a => ({
      kind: 'armor', itemType: 'armor', id: a.id, fr: a.fr, en: a.en || '',
      icon: '🛡',
      sub: `Armure P${a.tier} · Score ${a.armorScore} · Seuils ${a.major}/${a.severe}${a.heavy ? ' · Lourd' : ''}${a.campaign ? ' · ' + (CAMPAIGN_LABELS[a.campaign] || a.campaign) : ''}`,
      desc: a.desc || '',
    })),
  ].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));

  sheet.innerHTML = `
    <h3>Catalogue complet (${allEntries.length})</h3>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="cat-q" placeholder="Filtrer par nom ou effet…" autocomplete="off">
    </div>
    <div class="filter-row" id="cat-tabs" style="margin:.45rem 0">
      <button class="filter-chip active" data-cat="all">Tous</button>
      <button class="filter-chip" data-cat="loot">🎁 Butin</button>
      <button class="filter-chip" data-cat="consumable">🧪 Consommables</button>
      <button class="filter-chip" data-cat="weapon">⚔ Armes</button>
      <button class="filter-chip" data-cat="armor">🛡 Armures</button>
    </div>
    <div id="cat-count" class="page-sub" style="margin:0 0 .4rem;font-size:.75rem"></div>
    <div id="cat-list" class="wp-list"></div>
    <div class="modal-close-row"><button class="btn ghost small" id="cat-close">Fermer</button></div>`;

  const draw = () => {
    const q = query.toLowerCase();
    const list = allEntries.filter(e => {
      if (cat === 'loot' && !(e.kind === 'item' && e.itemType === 'loot')) return false;
      if (cat === 'consumable' && !(e.kind === 'item' && e.itemType === 'consumable')) return false;
      if (cat === 'weapon' && e.kind !== 'weapon') return false;
      if (cat === 'armor' && e.kind !== 'armor') return false;
      if (!q) return true;
      return (e.fr + ' ' + e.en + ' ' + e.desc + ' ' + e.sub).toLowerCase().includes(q);
    });
    const shown = list.slice(0, 80);
    $('#cat-count', sheet).textContent = `${list.length} résultat(s)${list.length > shown.length ? ` — ${shown.length} affichés (affinez la recherche)` : ''}`;
    $('#cat-list', sheet).innerHTML = shown.map(e => `
      <button class="inv-sug" data-cat-add="${e.id}">
        <span class="is-type">${e.icon}</span>
        <span class="is-body">
          <span class="is-name">${esc(e.fr)}</span>
          <span class="is-sub">${esc(e.sub)}</span>
          ${e.desc ? `<span class="is-sub" style="color:var(--text-faint);margin-top:2px">${esc(e.desc)}</span>` : ''}
        </span>
        <span class="is-add">＋</span>
      </button>`).join('') || '<div class="dh-help">Aucun élément trouvé.</div>';

    $$('[data-cat-add]', sheet).forEach(b => b.addEventListener('click', () => {
      const entry = allEntries.find(x => x.id === b.dataset.catAdd);
      if (!entry) return;
      const ex = c.inventory.find(x => x.itemId === entry.id);
      if (ex) ex.qty = (ex.qty ?? 1) + 1;
      else c.inventory.push({
        name: entry.fr, qty: 1, desc: entry.desc, itemId: entry.id,
        ...(entry.kind === 'item' ? { type: entry.itemType } : {}),
      });
      saveChar(c);
      changed = true;
      toast(`« ${entry.fr} » ajouté à l'inventaire.`);
    }));
  };

  draw();
  $$('[data-cat]', sheet).forEach(b => b.addEventListener('click', () => {
    $$('[data-cat]', sheet).forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    cat = b.dataset.cat;
    draw();
  }));
  $('#cat-q', sheet).addEventListener('input', (e) => { query = e.target.value.trim(); draw(); });
  $('#cat-close', sheet).addEventListener('click', finish);
}

/* ================= ONGLETS « PLUS » (contenus existants) ================= */
async function tabCards(body, c, ctx) {
  const { cards, domains, main, params } = ctx;
  const inHand = c.domainCards.filter(x => x.inHand);
  const inVault = c.domainCards.filter(x => !x.inHand);
  body.innerHTML = `
    <div class="panel">
      <div class="p-head"><span class="rb-lbl">Cartes de domaine</span>
        <span class="tag">${inHand.length}/5 en main · ${c.domainCards.length} au total</span></div>
      <div id="cards-list"></div>
    </div>
    <div class="panel" style="margin-top:.9rem">
      <div class="p-head"><span class="rb-lbl">🗄️ Caveau</span>
        <span class="tag">${inVault.length} rangée(s)</span></div>
      <div class="rl-sub" style="padding:.15rem 0 .4rem">Cartes hors de la main. Le rappel en main coûte son prix en Espoir (↻).</div>
      <div id="vault-list"></div>
    </div>`;
  const cardsList = $('#cards-list', body);
  const vaultList = $('#vault-list', body);

  const cardHTML = (card, dc, inVaultList) => {
    const dom = domains[card.domain];
    const cost = featParse(card.desc);
    const useKey = `${cost.perLong ? 'long' : 'short'}:card:${dc.cardId}`;
    const isUsed = !!c.cardUses?.[useKey];
    const tok = c.cardTokens?.[dc.cardId] || 0;
    const actions = [];
    if (inVaultList) {
      /* caveau : remise en main au prix de rappel (↻ X Espoirs) */
      actions.push(`<button class="btn ghost small" data-return-card="${dc.cardId}">↻ Remettre en main (${card.recall ? `${card.recall} Espoir${card.recall > 1 ? 's' : ''}` : 'Gratuit'})</button>`);
    } else {
      if (cost.hope) actions.push(`<button class="btn ghost small" data-fx-hope="${cost.hope}">Activer (${cost.hope === 1 ? '1 Espoir' : `${cost.hope} Espoirs`})</button>`);
      if (cost.stress) actions.push(`<button class="btn ghost small" data-fx-stress="${cost.stress}">Marquer ${cost.stress === 1 ? '1 Stress' : `${cost.stress} Stress`}</button>`);
      if (cost.dice) actions.push(`<button class="btn ghost small" data-fx-dice="${cost.dice}" data-fx-name="${esc(card.fr)}" title="Lancer ${cost.dice}">🎲 ${cost.dice}</button>`);
      actions.push(`<button class="btn ghost small" data-toggle-hand="${dc.cardId}">↧ Ranger au caveau</button>`);
    }
    actions.push(`<button class="btn ghost small" data-remove-card="${dc.cardId}">Retirer</button>`);
    const metaCtrls = `<span class="dc-meta-ctrls">
      ${cost.perRest ? `<button class="dc-use-btn ${isUsed ? 'used' : ''}" data-use-key="${esc(useKey)}">${cost.perLong ? '1×/long repos' : '1×/repos'}</button>` : ''}
      <span class="dc-tok" title="Jetons sur la carte"><button data-tok="${esc(dc.cardId)}:-1">−</button><span>${tok} jtn</span><button data-tok="${esc(dc.cardId)}:1">+</button></span>
    </span>`;
    return `<div class="dcard ${dc.inHand ? '' : 'inactive'}">
      <div class="dc-head">
        <span class="dc-lvl">${card.level}</span>
        <span class="dc-name">${esc(card.fr)}</span>
        <span class="dc-domain"><img src="assets/icons/domain-card/${card.domain}.png" alt="">${esc(dom.fr)}</span>
        <span class="dc-type">${T.cardType[card.type]}</span>
        <span class="dc-recall">⟲ ${card.recall}</span>
        ${metaCtrls}
      </div>
      <div class="dc-desc">${esc(card.desc)}</div>
      <div class="dc-actions">${actions.join('')}</div>
    </div>`;
  };

  for (const dc of inHand) {
    const card = cards.find(x => x.id === dc.cardId);
    if (card) cardsList.appendChild(el(cardHTML(card, dc, false)));
  }
  if (!inHand.length) cardsList.innerHTML = '<div class="empty"><div class="e-title">Main vide</div><div class="e-sub">Ajoutez des cartes de domaine depuis le compendium.</div></div>';

  for (const dc of inVault) {
    const card = cards.find(x => x.id === dc.cardId);
    if (card) vaultList.appendChild(el(cardHTML(card, dc, true)));
  }
  if (!inVault.length) vaultList.innerHTML = '<div class="rl-sub" style="padding:.3rem 0">Aucune carte au caveau. Rangez une carte depuis la main ci-dessus.</div>';

  const update = () => { saveChar(c); render(main, params); };
  $$('[data-use-key]', body).forEach(b => b.addEventListener('click', () => {
    c.cardUses = c.cardUses || {};
    const k = b.dataset.useKey;
    c.cardUses[k] = !c.cardUses[k];
    update();
  }));
  $$('[data-tok]', body).forEach(b => b.addEventListener('click', () => {
    const [k, d] = b.dataset.tok.split(':');
    c.cardTokens = c.cardTokens || {};
    c.cardTokens[k] = Math.max(0, Math.min(20, (c.cardTokens[k] || 0) + (+d)));
    update();
  }));
  /* Fix 3 — prendre en main : si 5 cartes déjà en main, choisir laquelle ranger */
  const takeInHand = (dc) => {
    if (inHand.length >= 5) { chooseCardToVault(c, dc, cards, update); return; }
    dc.inHand = true; update();
  };
  $$('[data-toggle-hand]', body).forEach(b => b.addEventListener('click', () => {
    const dc = c.domainCards.find(x => x.cardId === b.dataset.toggleHand);
    if (dc.inHand) { dc.inHand = false; update(); }
    else takeInHand(dc);
  }));
  /* caveau → remettre en main : paie le prix de rappel en Espoir, limite 5 stricte */
  $$('[data-return-card]', body).forEach(b => b.addEventListener('click', () => {
    const card = cards.find(x => x.id === b.dataset.returnCard);
    const dc = c.domainCards.find(x => x.cardId === b.dataset.returnCard);
    const price = card.recall || 0;
    if (c.hope.current < price) {
      toast(price ? `Espoir insuffisant ! Rappel = ${price} Espoir${price > 1 ? 's' : ''} (${c.hope.current} disponible${c.hope.current > 1 ? 's' : ''})` : 'Espoir insuffisant !');
      return;
    }
    const completeRecall = () => {
      const effHopeMax = Math.max(0, 6 - (c.scars || 0));
      c.hope.current -= price;
      dc.inHand = true;
      if (price) toast(`↻ Rappel : ${price === 1 ? '1 Espoir dépensé' : `${price} Espoirs dépensés`} — « ${card.fr} » revient en main (${c.hope.current}/${effHopeMax} restants)`);
      else toast(`↻ « ${card.fr} » revient en main (gratuit)`);
      update();
    };
    if (inHand.length >= 5) { chooseCardToVault(c, dc, cards, completeRecall); return; }
    completeRecall();
  }));
  $$('[data-remove-card]', body).forEach(b => b.addEventListener('click', () => {
    c.domainCards = c.domainCards.filter(x => x.cardId !== b.dataset.removeCard);
    update();
  }));
  /* ---- boutons d'activation rapide sur les cartes en main (v19) ---- */
  $$('[data-fx-hope]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxHope;
    const effHopeMax = Math.max(0, 6 - (c.scars || 0));
    if (c.hope.current < n) { toast(`Espoir insuffisant ! (${c.hope.current}/${n} requis)`); return; }
    c.hope.current -= n;
    toast(`✦ ${n === 1 ? '1 Espoir dépensé' : `${n} Espoirs dépensés`} — ${c.hope.current}/${effHopeMax} restants`);
    update();
  }));
  $$('[data-fx-stress]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxStress;
    if (c.stress.current + n > c.stress.max) { toast(`Stress insuffisant ! (${c.stress.current}/${c.stress.max})`); return; }
    c.stress.current += n;
    toast(`${n === 1 ? '1 Stress marqué' : `${n} Stress marqués`} — ${c.stress.current}/${c.stress.max}`);
    update();
  }));
  $$('[data-fx-dice]', body).forEach(b => b.addEventListener('click', () => {
    const name = b.dataset.fxName || 'Carte';
    rollDice(b.dataset.fxDice, { label: name });
  }));
}

/* ============ onglet APTITUDES (refonte v19 + SRD 2.0) ============ */
const FEAT_RE = {
  hope: /D[ée]pensez?\s+(?:(\d+)|un|une)\s*Espoirs?/i,
  stress: /[Mm]arquez\s+(?:(\d+)|un)\s+Stress/i,
  perRest: /une\s+fois\s+par\s+(?:long\s+)?repos/i,
  perLong: /une\s+fois\s+par\s+long\s+repos/i,
  dice: /\b(?:(\d+)\s*)?d(4|6|8|10|12|20)\b\s*(?:\+\s*(\d+))?/,
};
function featParse(desc) {
  const d = String(desc || '');
  const out = {};
  const mH = d.match(FEAT_RE.hope);
  if (mH) out.hope = mH[1] ? +mH[1] : 1;
  const mS = d.match(FEAT_RE.stress);
  if (mS) out.stress = mS[1] ? +mS[1] : 1;
  if (FEAT_RE.perRest.test(d)) out.perRest = true;
  if (FEAT_RE.perLong.test(d)) out.perLong = true;
  const mD = d.match(FEAT_RE.dice);
  if (mD) {
    const qty = mD[1] ? +mD[1] : 1;
    out.dice = `${qty}d${mD[2]}${mD[3] ? `+${mD[3]}` : ''}`;
  }
  return out;
}
function featCostBadges(cost) {
  const b = [];
  if (cost.hope) b.push(`<span class="fbadge cost">${cost.hope === 1 ? '1 Espoir' : `${cost.hope} Espoirs`}</span>`);
  if (cost.stress) b.push(`<span class="fbadge cost">${cost.stress === 1 ? '1 Stress' : `${cost.stress} Stress`}</span>`);
  if (cost.perRest) b.push(`<span class="fbadge use">${cost.perLong ? '1× / long repos' : '1× / repos'}</span>`);
  return b.join('');
}
function featureCardHTML(f, source, rank, c) {
  const cost = featParse(f.desc);
  const fname = f.name || f.fr || f.en || 'Aptitude';
  const featId = `feat:${source}:${fname}`;
  const useKey = `${cost.perLong ? 'long' : 'short'}:${featId}`;
  const isUsed = !!c?.cardUses?.[useKey];
  const actions = [];
  if (cost.hope) actions.push(`<button class="btn ghost small" data-fx-hope="${cost.hope}">Activer (${cost.hope === 1 ? '1 Espoir' : `${cost.hope} Espoirs`})</button>`);
  if (cost.stress) actions.push(`<button class="btn ghost small" data-fx-stress="${cost.stress}">Marquer ${cost.stress === 1 ? '1 Stress' : `${cost.stress} Stress`}</button>`);
  if (cost.dice) actions.push(`<button class="btn ghost small" data-fx-dice="${cost.dice}" title="Lancer ${cost.dice}">🎲 ${cost.dice}</button>`);
  const useBtn = cost.perRest
    ? `<button class="dc-use-btn ${isUsed ? 'used' : ''}" data-use-key="${esc(useKey)}">${cost.perLong ? '1×/long repos' : '1×/repos'}</button>`
    : '';
  return `<div class="dcard fcard">
    <div class="dc-head">
      <span class="dc-name">${esc(fname)}${rank ? ` <span class="fbadge rank">${rank}</span>` : ''}</span>
      <span class="fbadge src">${esc(source)}</span>
      ${featCostBadges(cost)}
      ${useBtn}
    </div>
    <div class="dc-desc">${esc(f.desc)}</div>
    ${actions.length ? `<div class="dc-actions">${actions.join('')}</div>` : ''}
  </div>`;
}
function featureSection(title, count, html) {
  return `<div class="panel">
    <div class="p-head"><span class="rb-lbl">${title}</span><span class="tag">${count}</span></div>
    ${html || '<div class="rl-sub" style="padding:.4rem 0">Aucune aptitude.</div>'}
  </div>`;
}

function tabFeatures(body, c, ctx) {
  const { cl, sub, classes = [], transformations = [], beastforms = [] } = ctx;
  const hopeName = typeof c.hopeAbility === 'string' ? c.hopeAbility : c.hopeAbility?.name;
  const hopeDesc = (typeof c.hopeAbility === 'object' ? c.hopeAbility?.desc : '') || cl?.hopeDesc || '';
  const hopeFeat = hopeName ? [{ name: `✦ ${hopeName}`, desc: hopeDesc }] : [];
  const classFeats = cl?.features || [];
  const sec1 = [...hopeFeat, ...classFeats];
  const RANKS = ['Fondation', 'Spécialisation', 'Spécialisation', 'Maîtrise', 'Maîtrise', 'Maîtrise'];
  const subFeats = (sub?.features || []).map((f, i) => ({ ...f, __rank: RANKS[i] || 'Maîtrise' }));
  const ancFeats = c.ancestry?.abilities || [];
  const comFeat = c.community?.ability ? [c.community.ability] : [];

  /* Multiclassage */
  const mcCl = (c.multiclassed && c.multiclassClassId) ? classes.find(x => x.id === c.multiclassClassId) : null;
  const mcSection = mcCl
    ? featureSection(`Multiclassage — ${esc(mcCl.fr)}`, (mcCl.features || []).length,
        (mcCl.features || []).map(f => featureCardHTML(f, 'Multiclassage', null, c)).join(''))
    : '';

  /* Transformation */
  const trRaw = (c.transformation || '').trim().toLowerCase();
  const trDef = trRaw ? transformations.find(t => t.fr.toLowerCase() === trRaw || t.en.toLowerCase() === trRaw || t.id.toLowerCase() === trRaw) : null;
  const trSection = trDef
    ? featureSection(`Transformation — ${esc(trDef.fr)}`, trDef.features.length,
        trDef.features.map(f => featureCardHTML(f, 'Transformation', null, c)).join(''))
    : '';

  /* Forme bestiale (Druide ou personnage transformé) */
  const isDruid = c.classId === DRUID_CLASS_ID || c.multiclassClassId === DRUID_CLASS_ID || !!c.beastform;
  const maxTier = tierOf(c.level);
  const availBf = beastforms.filter(b => b.tier <= maxTier);
  const bfMeta = c.beastform?.id ? beastforms.find(b => b.id === c.beastform.id) : null;
  const activeBf = resolveBeastform(bfMeta, c.beastform, beastforms, c.traits);
  const pickedMeta = bfMeta || null;
  const isVarPicked = pickedMeta?.trait === 'variable';
  const baseCandidates = (maxBaseTier) => beastforms.filter(b => b.tier <= maxBaseTier && !b.evolved && !b.hybrid && b.trait !== 'variable');
  const bfOptLabel = (b) => b.trait === 'variable'
    ? `P${b.tier} · ${esc(b.fr)} (+${b.traitBonus} Trait, Éva +${b.evasionBonus}, Dégâts +${b.dmgBonus})`
    : `P${b.tier} · ${esc(b.fr)} (${T.traits[b.trait] || b.trait} +${b.traitBonus}, Éva +${b.evasionBonus})`;
  const bfSection = isDruid ? `
    <div class="panel">
      <div class="p-head"><span class="rb-lbl">🐾 Forme bestiale</span><span class="tag">${activeBf ? `Active : ${esc(activeBf.fr)}` : `Palier ≤ ${maxTier}`}</span></div>
      ${activeBf ? `
        <div class="dh-bf-banner">
          <span><b>${esc(activeBf.fr)}</b> (${esc(activeBf.examples)}) — ${T.traits[activeBf.trait] || activeBf.trait} +${activeBf.traitBonus}, Évasion +${activeBf.evasionBonus}, Dégâts ${activeBf.dmgDice}${fmtBonus(activeBf.dmgBonus)} (${esc(activeBf.range)})${activeBf.advantages?.length ? ` · Avantages : ${esc(activeBf.advantages.join(', '))}` : ''}</span>
          <button class="btn ghost small" id="bf-exit">Quitter la forme</button>
        </div>
        ${(activeBf.features || []).map(f => featureCardHTML(f, 'Forme bestiale', null, c)).join('')}
      ` : '<div class="rl-sub" style="margin-bottom:.45rem">Choisissez une Forme bestiale pour appliquer ses bonus temporaires de Trait, d’Évasion et d’attaque naturelle.</div>'}
      <div style="display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.55rem;align-items:center">
        <select id="bf-pick" style="flex:1;min-width:190px;background:var(--panel-3);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:.4rem .5rem;font-size:.8rem">
          <option value="">— Choisir une Forme bestiale —</option>
          ${availBf.map(b => `<option value="${b.id}" ${c.beastform?.id === b.id ? 'selected' : ''}>${bfOptLabel(b)}</option>`).join('')}
        </select>
        <select id="bf-base" style="flex:1;min-width:190px;background:var(--panel-3);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:.4rem .5rem;font-size:.8rem;display:${isVarPicked ? '' : 'none'}">
          <option value="">— Forme de base (Palier ${pickedMeta?.tier >= 4 ? '1–2' : '1'}) —</option>
          ${baseCandidates(pickedMeta?.tier >= 4 ? 2 : 1).map(b => `<option value="${b.id}" ${c.beastform?.baseId === b.id ? 'selected' : ''}>P${b.tier} · ${esc(b.fr)} (${T.traits[b.trait]} +${b.traitBonus}, ${b.dmgDice}${fmtBonus(b.dmgBonus)})</option>`).join('')}
        </select>
        <label class="dhr-hopespend" style="margin:0"><input type="checkbox" id="bf-stress" checked> −1 Stress</label>
        <button class="btn small" id="bf-activate">🐾 Transformer</button>
      </div>
    </div>` : '';

  /* Compagnon animal (Rôdeur Maître des bêtes / Beastbound) */
  const compSection = c.companion ? `
    <div class="panel">
      <div class="p-head"><span class="rb-lbl">🐺 Compagnon animal</span><span class="tag">Stress ${c.companion.stress?.current || 0}/${c.companion.stress?.max || 3}</span></div>
      <div class="dh-wgrid">
        <label class="dh-fl"><span>Nom</span><input data-comp="name" value="${esc(c.companion.name || '')}"></label>
        <label class="dh-fl"><span>Espèce</span><input data-comp="species" value="${esc(c.companion.species || '')}"></label>
        <label class="dh-fl"><span>Évasion</span><input type="number" data-comp="evasion" value="${c.companion.evasion || 10}" min="1" max="30"></label>
        <label class="dh-fl"><span>Attaque</span><input data-comp="attackName" value="${esc(c.companion.attackName || '')}"></label>
        <label class="dh-fl"><span>Dé de dégâts</span>
          <select data-comp="dice">${DICE.map(d => `<option ${c.companion.dice === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label class="dh-fl"><span>Portée</span><input data-comp="range" value="${esc(c.companion.range || 'Mêlée')}"></label>
      </div>
      <div style="display:flex;align-items:center;gap:.45rem;margin:.6rem 0;flex-wrap:wrap">
        <span class="dh-g-lbl">Stress du compagnon :</span>
        ${Array.from({ length: c.companion.stress?.max || 3 }, (_, i) => `<button class="dh-box stress ${i < (c.companion.stress?.current || 0) ? 'on' : ''}" data-comp-st="${i}"></button>`).join('')}
        <button class="btn ghost small" id="comp-add-st">+1 Case</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem">
        ${(c.companion.experiences || []).map((ex, i) => `
          <div class="dh-exprow" style="margin:0">
            <input class="dh-exp-name" data-comp-exp="${i}:name" value="${esc(ex.name || '')}" placeholder="Expérience compagnon">
            <input type="number" class="dh-ribbon" data-comp-exp="${i}:mod" value="${ex.mod ?? 2}" min="-9" max="9">
          </div>`).join('')}
      </div>
    </div>` : '';

  body.innerHTML =
    featureSection(`Classe & Espoir${cl ? ` — ${esc(cl.fr)}` : ''}`, sec1.length,
      sec1.map(f => featureCardHTML(f, 'Classe', null, c)).join('')) +
    featureSection(`Sous-classe${sub ? ` — ${esc(sub.fr)}` : ''}`, subFeats.length,
      subFeats.map(f => featureCardHTML(f, 'Sous-classe', f.__rank, c)).join('')) +
    mcSection +
    trSection +
    bfSection +
    compSection +
    featureSection(`Ascendance${c.ancestry?.fr ? ` — ${esc(c.ancestry.fr)}` : ''}`, ancFeats.length,
      ancFeats.map(f => featureCardHTML(f, 'Ascendance', null, c)).join('')) +
    featureSection(`Communauté${c.community?.fr ? ` — ${esc(c.community.fr)}` : ''}`, comFeat.length,
      comFeat.map(f => featureCardHTML(f, 'Communauté', null, c)).join(''));

  /* cooldown 1x/repos sur aptitudes */
  $$('[data-use-key]', body).forEach(b => b.addEventListener('click', () => {
    c.cardUses = c.cardUses || {};
    const k = b.dataset.useKey;
    c.cardUses[k] = !c.cardUses[k];
    saveChar(c);
    render(ctx.main, ctx.params);
  }));

  /* Forme bestiale actions */
  $('#bf-pick', body)?.addEventListener('change', (e) => {
    const bf = beastforms.find(x => x.id === e.target.value);
    const baseSel = $('#bf-base', body);
    if (!baseSel) return;
    if (bf?.trait === 'variable') {
      const cap = bf.tier >= 4 ? 2 : 1;
      baseSel.style.display = '';
      baseSel.innerHTML = `<option value="">— Forme de base (Palier ${cap === 2 ? '1–2' : '1'}) —</option>`
        + baseCandidates(cap).map(b => `<option value="${b.id}">P${b.tier} · ${esc(b.fr)} (${T.traits[b.trait]} +${b.traitBonus}, ${b.dmgDice}${fmtBonus(b.dmgBonus)})</option>`).join('');
    } else {
      baseSel.style.display = 'none';
      baseSel.value = '';
    }
  });
  $('#bf-exit', body)?.addEventListener('click', () => {
    c.beastform = null;
    saveChar(c);
    toast('Forme bestiale quittée.');
    render(ctx.main, ctx.params);
  });
  $('#bf-activate', body)?.addEventListener('click', () => {
    const id = $('#bf-pick', body)?.value;
    if (!id) { toast('Sélectionnez une Forme bestiale.'); return; }
    const bf = beastforms.find(x => x.id === id);
    if (!bf) return;
    const baseId = bf.trait === 'variable' ? ($('#bf-base', body)?.value || '') : '';
    if (bf.trait === 'variable' && !baseId) {
      toast('Choisissez d’abord la forme de base à faire évoluer.');
      return;
    }
    if ($('#bf-stress', body)?.checked) {
      if (c.stress.current >= c.stress.max) { toast('Stress au maximum !'); return; }
      c.stress.current += 1;
    }
    const baseBf = baseId ? beastforms.find(x => x.id === baseId) : null;
    c.beastform = baseBf ? { id: bf.id, fr: `${bf.fr} (${baseBf.fr})`, baseId: baseBf.id } : { id: bf.id, fr: bf.fr };
    saveChar(c);
    toast(`🐾 Transformation : ${c.beastform.fr} active !`);
    render(ctx.main, ctx.params);
  });

  /* Compagnon animal bindings */
  $$('[data-comp]', body).forEach(inp => inp.addEventListener('change', () => {
    if (!c.companion) return;
    const k = inp.dataset.comp;
    c.companion[k] = k === 'evasion' ? Math.max(1, parseInt(inp.value, 10) || 10) : inp.value;
    saveChar(c);
  }));
  $$('[data-comp-st]', body).forEach(b => b.addEventListener('click', () => {
    if (!c.companion) return;
    const i = +b.dataset.compSt;
    c.companion.stress = c.companion.stress || { max: 3, current: 0 };
    c.companion.stress.current = (i < c.companion.stress.current) ? i : i + 1;
    saveChar(c);
    render(ctx.main, ctx.params);
  }));
  $('#comp-add-st', body)?.addEventListener('click', () => {
    if (!c.companion) return;
    c.companion.stress = c.companion.stress || { max: 3, current: 0 };
    c.companion.stress.max = Math.min(8, (c.companion.stress.max || 3) + 1);
    saveChar(c);
    render(ctx.main, ctx.params);
  });
  $$('[data-comp-exp]', body).forEach(inp => inp.addEventListener('change', () => {
    if (!c.companion) return;
    const [idx, k] = inp.dataset.compExp.split(':');
    c.companion.experiences = c.companion.experiences || [];
    if (!c.companion.experiences[+idx]) return;
    c.companion.experiences[+idx][k] = k === 'mod' ? (parseInt(inp.value, 10) || 0) : inp.value;
    saveChar(c);
  }));

  /* ---- boutons d'activation rapide : dépense Espoir ---- */
  $$('[data-fx-hope]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxHope;
    const effHopeMax = Math.max(0, 6 - (c.scars || 0));
    if (c.hope.current < n) { toast(`Espoir insuffisant ! (${c.hope.current}/${n} requis)`); return; }
    c.hope.current -= n;
    saveChar(c);
    toast(`✦ ${n === 1 ? '1 Espoir dépensé' : `${n} Espoirs dépensés`} — ${c.hope.current}/${effHopeMax} restants`);
    render(ctx.main, ctx.params);
  }));
  /* ---- dépense Stress ---- */
  $$('[data-fx-stress]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxStress;
    if (c.stress.current + n > c.stress.max) { toast(`Stress insuffisant ! (${c.stress.current}/${c.stress.max})`); return; }
    c.stress.current += n;
    saveChar(c);
    toast(`${n === 1 ? '1 Stress marqué' : `${n} Stress marqués`} — ${c.stress.current}/${c.stress.max}`);
    render(ctx.main, ctx.params);
  }));
  /* ---- jet de dés rapide ---- */
  $$('[data-fx-dice]', body).forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.fcard');
    const name = card?.querySelector('.dc-name')?.textContent?.trim() || 'Aptitude';
    rollDice(b.dataset.fxDice, { label: name });
  }));
}

function tabBackground(body, c, ctx) {
  const { main } = ctx;
  body.innerHTML = `
    <div class="panel">
      <div class="p-head"><span class="rb-lbl">Réponses de background</span></div>
      ${Object.values(c.backgroundAnswers || {}).filter(v => v && v.trim()).map(a => `<p style="font-size:.86rem;color:var(--text-dim);line-height:1.6;margin-bottom:.6rem">— ${esc(a)}</p>`).join('') || '<div class="li-sub">Aucune réponse de background enregistrée.</div>'}
    </div>
    <div class="panel" style="margin-top:.9rem">
      <div class="field" style="margin:0"><label>Notes de jeu</label>
        <textarea id="notes" rows="4" placeholder="Alliés, quêtes, secrets…">${esc(c.notes || '')}</textarea></div>
    </div>`;
  $('#notes', body).addEventListener('change', (e) => { c.notes = e.target.value; saveChar(c); });
}

function tabJournal(body, c, ctx) {
  const { main } = ctx;
  c.journal = c.journal || [];
  body.innerHTML = `
    <div class="panel">
      <div class="p-head">
        <span class="rb-lbl">Journal de bord</span>
        <span class="tag">${c.journal.length} entrée(s)</span>
      </div>
      ${c.journal.map((j, i) => `
      <div class="jrn-entry">
        <div class="jrn-head">
          <span class="jrn-date">${esc(j.date)}</span>
          <button class="icon-btn" style="width:26px;height:26px" data-del-jrn="${i}">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="jrn-text">${esc(j.text)}</div>
      </div>`).join('') || '<div class="li-sub" style="padding:.3rem 0">Le journal est vide. Consignez vos aventures au fil des sessions !</div>'}
      <div class="field" style="margin-top:.7rem">
        <textarea id="jrn-new" rows="3" placeholder="Nouvelle entrée de journal… (date auto)"></textarea>
        <button class="btn small" id="jrn-add" style="margin-top:.5rem">＋ Ajouter l'entrée</button>
      </div>
    </div>`;
  const update = () => { saveChar(c); tabJournal(body, c, ctx); };
  $('#jrn-add', body).addEventListener('click', () => {
    const t = $('#jrn-new', body);
    if (!t.value.trim()) return;
    const d = new Date();
    c.journal.unshift({ date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), text: t.value.trim() });
    saveChar(c); update();
  });
  $$('[data-del-jrn]', body).forEach(b => b.addEventListener('click', () => {
    c.journal.splice(+b.dataset.delJrn, 1);
    saveChar(c); update();
  }));
}

/* Fix 3 — invite : quelle carte ranger au caveau pour libérer une place en main ? */
function chooseCardToVault(c, wanted, cards, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  const inHand = c.domainCards.filter(x => x.inHand);
  sheet.innerHTML = `
    <h3>Main complète — 5 cartes en main</h3>
    <div class="ms-meta">Pour prendre « ${esc(wanted ? (cards.find(x => x.id === wanted.cardId)?.fr || 'cette carte') : 'cette carte')} », choisissez une carte à ranger au caveau :</div>
    <div class="wp-list">
      ${inHand.map(dc => {
        const cd = cards.find(x => x.id === dc.cardId);
        if (!cd) return '';
        return `<button class="inv-sug" data-vault="${dc.cardId}">
          <span class="is-body"><span class="is-name">${esc(cd.fr)}</span>
          <span class="is-sub">Niv. ${cd.level} · ranger au caveau</span></span>
          <span class="is-add">↧</span>
        </button>`;
      }).join('')}
    </div>
    <div style="margin-top:.8rem;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="cv-cancel">Annuler</button>
    </div>`;
  $('#cv-cancel', sheet).addEventListener('click', () => back.remove());
  $$('[data-vault]', sheet).forEach(b => b.addEventListener('click', () => {
    const dc = c.domainCards.find(x => x.cardId === b.dataset.vault);
    if (dc) dc.inHand = false;
    if (wanted) wanted.inHand = true;
    back.remove();
    onDone();
  }));
}
