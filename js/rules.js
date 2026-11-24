/* Règles pures et calculs Daggerheart (SRD 2.0) — module sans dépendance DOM.
   Importable directement par les vues navigateur ET par la suite de tests Node.js. */

export const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

export function tierOf(level) {
  const lvl = Number(level) || 1;
  if (lvl <= 1) return 1;
  if (lvl <= 4) return 2;
  if (lvl <= 7) return 3;
  return 4;
}

/* Bonus de seuils de dégâts accordé par la feature de certaines armures (SRD 2.0).
   4 familles d'armures accordent un bonus aux seuils — dépendances dynamiques :
   - Enchantée (Robes de mage)         : bonus = trait d'Incantation
   - Éclatante (Armure de cercueil)    : bonus = emplacements d'armure non cochés
   - Harmonisée (Exosquelette runique) : bonus = palier
   - Renforcée (Cuirasse d'irontree)   : +2 tant que le dernier emplacement est coché
   La détection est bilingue (texte FR et EN de la feature) et insensible à la casse. */
export function armorThresholdBonus({ feature = '', spellcastValue = 0, tier = 1, armorMax = 0, armorUsed = 0 } = {}) {
  const f = String(feature || '').toLowerCase();
  const parts = [];
  let flat = 0;
  let detail = [];
  const fr = /enchantée\s*:|éclatante\s*:|harmonisée\s*:|renforcée\s*:/;
  const en = /enchanted\s*:|splintering\s*:|attuned\s*:|reinforced\s*:/;
  if (!fr.test(f) && !en.test(f)) return { bonus: 0, parts: [] };

  if (/enchantée|enchanted/.test(f)) {
    // Bonus aux seuils de dégâts égal à votre trait d'Incantation.
    flat += Math.max(0, Number(spellcastValue) || 0);
    detail.push('Incantation');
  }
  if (/éclatante|splintering/.test(f)) {
    // Bonus aux seuils de dégâts égal à vos emplacements d'armure non cochés.
    flat += Math.max(0, (Number(armorMax) || 0) - (Number(armorUsed) || 0));
    detail.push('Emplacements d\u2019armure libres');
  }
  if (/harmonisée|attuned/.test(f)) {
    // Bonus aux seuils de dégâts égal à votre palier.
    flat += Math.max(1, Number(tier) || 1);
    detail.push('Palier');
  }
  if (/renforcée|reinforced/.test(f)) {
    // +2 aux seuils quand le dernier emplacement d'armure est coché.
    if ((Number(armorMax) || 0) > 0 && (Number(armorUsed) || 0) >= (Number(armorMax) || 0)) {
      flat += 2;
      detail.push('Renforcée (+2)');
    }
  }
  return { bonus: flat, parts: detail };
}

/* Malus passifs portés par l'équipement (SRD 2.0), décrits dans le texte de la feature :
   - Lourde / Heavy               : −1 en Évasion
   - Très lourde / Very Heavy     : −2 en Évasion ; −1 en Agilité
   - Encombrante / Cumbersome     : −1 en Finesse
   - Massive                      : −1 en Évasion
   La détection est bilingue et insensible à la casse. */
export function equipmentPenalty(descriptions = []) {
  const total = { evasion: 0, agility: 0, finesse: 0, parts: [] };
  for (const raw of descriptions) {
    const d = String(raw || '');
    if (!d) continue;
    if (/\btrès lourde\b|\bvery heavy\b/i.test(d)) {
      total.evasion -= 2;
      total.agility -= 1;
      total.parts.push('Très lourde (−2 Évasion, −1 Agilité)');
    } else if (/\blourde\b|\bheavy\b/i.test(d)) {
      total.evasion -= 1;
      total.parts.push('Lourde (−1 Évasion)');
    }
    if (/\bencombrante\b|\bcumbersome\b/i.test(d)) {
      total.finesse -= 1;
      total.parts.push('Encombrante (−1 Finesse)');
    }
    if (/\bmassive\b/i.test(d)) {
      total.evasion -= 1;
      total.parts.push('Massive (−1 Évasion)');
    }
  }
  return total;
}

export function formatSigned(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : `${v}`;
}

export function formatBonus(b) {
  const n = parseInt(b, 10) || 0;
  return n ? (n > 0 ? `+${n}` : `${n}`) : '';
}

export function formatAtkBonus(b) {
  if (b === null || b === undefined || b === '') return '';
  const s = String(b).trim();
  if (!s) return '';
  if (/^[+-]\d+$/.test(s)) return s;
  const n = Number(s);
  if (Number.isFinite(n)) return n >= 0 ? `+${n}` : `${n}`;
  return s;
}

const DIE_STEPS = ['d4', 'd6', 'd8', 'd10', 'd12'];
export function nextDieStep(dice) {
  const idx = DIE_STEPS.indexOf(String(dice || '').toLowerCase());
  if (idx < 0) return 'd8';
  return DIE_STEPS[Math.min(DIE_STEPS.length - 1, idx + 1)];
}

export function multiclassDomainCap(level) {
  return Math.ceil(Math.max(1, Number(level) || 1) / 2);
}

/* Seuils de dégâts : base d'armure + niveau + bonus d'aptitudes */
export function calcThresholds(c) {
  const level = Math.max(1, Number(c?.level) || 1);
  const baseMajor = Number(c?.armorCard?.baseMajor) || 0;
  const baseSevere = Number(c?.armorCard?.baseSevere) || 0;
  const bonus = Number(c?.thresholds?.bonus) || 0;
  return {
    major: baseMajor + level + bonus,
    severe: baseSevere + level + bonus,
  };
}

/* Classification des dégâts reçus selon le SRD 2.0 (p. 50) :
   - <= 0 : 0 PV
   - < Majeur : Mineurs (1 PV)
   - >= Majeur et < Grave : Majeurs (2 PV)
   - >= Grave : Graves (3 PV) ; règle optionnelle Massifs >= 2 * Grave : 4 PV */
export function classifyDamage(dmg, major, severe, { massiveRule = false } = {}) {
  const amount = Math.floor(Number(dmg) || 0);
  if (amount <= 0) return { level: 0, label: 'Aucun', hp: 0 };
  if (massiveRule && severe > 0 && amount >= severe * 2) {
    return { level: 4, label: 'Massifs', hp: 4 };
  }
  if (amount >= severe) return { level: 3, label: 'Graves', hp: 3 };
  if (amount >= major) return { level: 2, label: 'Majeurs', hp: 2 };
  return { level: 1, label: 'Mineurs', hp: 1 };
}

/* Calcul complet avec dépense éventuelle de 1 emplacement d'armure (réduit la gravité d'un palier).
   Les dégâts directs ne peuvent pas être réduits par l'armure. */
export function computeDamageApplication({
  dmg,
  major,
  severe,
  useArmor = false,
  armorAvailable = 0,
  direct = false,
  massiveRule = false,
}) {
  const base = classifyDamage(dmg, major, severe, { massiveRule });
  if (base.hp === 0) {
    return { base, finalLevel: 0, finalLabel: 'Aucun', hpMarked: 0, armorSpent: 0 };
  }
  const canSpendArmor = !!useArmor && !direct && armorAvailable > 0;
  const armorSpent = canSpendArmor ? 1 : 0;
  const finalLevel = canSpendArmor ? Math.max(0, base.level - 1) : base.level;
  const labels = ['Aucun (absorbé)', 'Mineurs', 'Majeurs', 'Graves', 'Massifs'];
  return {
    base,
    finalLevel,
    finalLabel: labels[finalLevel] || 'Mineurs',
    hpMarked: finalLevel,
    armorSpent,
  };
}

export function parseDiceNotation(notation) {
  const clean = String(notation || '1d6').replace(/\s+/g, '');
  const modMatch = clean.match(/([+-]\d+)$/);
  const mod = modMatch ? parseInt(modMatch[1], 10) : 0;
  const dicePart = modMatch ? clean.slice(0, -modMatch[1].length) : clean;
  const m = dicePart.match(/^(\d*)d(\d+)$/i);
  return {
    clean,
    dicePart,
    qty: m ? (parseInt(m[1], 10) || 1) : 1,
    sides: m ? (parseInt(m[2], 10) || 6) : 6,
    mod,
  };
}

/* Calcul de dégâts selon le SRD 2.0 :
   - Normal : N dX + bonus fixe (N = Maîtrise bornée 1..6)
   - Succès critique : max des dés de dégâts (N × X) + jet normal (N dX) + bonus fixe (non doublé) */
export function calcDamageSpec(proficiency, dice = 'd6', dmgBonus = 0, { crit = false } = {}) {
  const qty = Math.max(1, Math.min(6, parseInt(proficiency, 10) || 1));
  const sides = Math.max(2, parseInt(String(dice || 'd6').replace(/^d/i, ''), 10) || 6);
  const flatBonus = parseInt(dmgBonus, 10) || 0;
  const critMax = crit ? qty * sides : 0;
  const diceOnlyNotation = `${qty}d${sides}`;
  const normalNotation = flatBonus
    ? `${diceOnlyNotation}${flatBonus > 0 ? '+' + flatBonus : flatBonus}`
    : diceOnlyNotation;
  const fullNotation = crit
    ? `${diceOnlyNotation}+${critMax}${flatBonus ? (flatBonus > 0 ? '+' + flatBonus : flatBonus) : ''}`
    : normalNotation;
  return {
    qty,
    sides,
    flatBonus,
    crit: !!crit,
    critMax,
    diceOnlyNotation,
    normalNotation,
    fullNotation,
  };
}

/* Points de combat recommandés pour un affrontement (SRD 2.0) */
export const ADVERSARY_POINT_COST = {
  minion: 1,    /* par groupe de Sbires = taille du groupe de PJ */
  social: 1,
  support: 1,
  horde: 2,
  ranged: 2,
  skulk: 2,
  standard: 2,
  leader: 3,
  bruiser: 4,
  solo: 5,
};

export function calcEncounterBudget(pcCount, adj = {}) {
  const pcs = Math.max(1, Math.min(10, parseInt(pcCount, 10) || 4));
  let total = (3 * pcs) + 2;
  if (adj.easier) total -= 1;
  if (adj.twoSolos) total -= 2;
  if (adj.extraDmg) total -= 2;
  if (adj.lowerTier) total += 1;
  if (adj.noHeavy) total += 1;
  if (adj.harder) total += 2;
  return Math.max(1, total);
}

export function calcEncounterSpent(entries = [], pcCount = 4) {
  const pcs = Math.max(1, Math.min(10, parseInt(pcCount, 10) || 4));
  let minions = 0;
  let total = 0;
  for (const e of entries) {
    const count = Math.max(1, parseInt(e.qty, 10) || 1);
    /* SRD 2.0 : les Sbires coûtent 1 point par groupe égal à la taille du groupe de PJ,
       pas 1 point par instance. On cumule donc toutes les instances puis on arrondit au groupe. */
    if (e.type === 'minion') { minions += count; continue; }
    total += (ADVERSARY_POINT_COST[e.type] ?? 2) * count;
  }
  if (minions) total += Math.ceil(minions / pcs);
  return total;
}

const NESTED_PLAIN_KEYS = ['traits', 'hp', 'stress', 'hope', 'thresholds', 'armorSlots', 'armorCard', 'goldTrack'];
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ALLOWED_WEAPON_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12']);
const SAFE_PORTRAIT_RE = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clampNum = (v, fallback, min, max) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function stripUnsafeKeys(val, depth = 0) {
  if (depth > 16) return null;
  if (Array.isArray(val)) return val.map(v => stripUnsafeKeys(v, depth + 1));
  if (!isPlainObject(val)) return val;
  const out = {};
  for (const k of Object.keys(val)) {
    if (UNSAFE_OBJECT_KEYS.has(k)) continue;
    out[k] = stripUnsafeKeys(val[k], depth + 1);
  }
  return out;
}

export function sanitizePortrait(val) {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 2 * 1024 * 1024) return '';
  return SAFE_PORTRAIT_RE.test(trimmed) ? trimmed : '';
}

export function sanitizeId(val, fallback = '') {
  if (typeof val !== 'string') return fallback;
  const s = val.trim();
  return SAFE_ID_RE.test(s) ? s : fallback;
}

function sanitizeWeapon(w) {
  const dice = typeof w.dice === 'string' && ALLOWED_WEAPON_DICE.has(w.dice.toLowerCase()) ? w.dice.toLowerCase() : 'd6';
  const trait = typeof w.trait === 'string' && TRAIT_KEYS.includes(w.trait) ? w.trait : 'agility';
  return {
    uid: sanitizeId(w.uid) || ('w' + Math.random().toString(36).slice(2, 10)),
    compendiumId: typeof w.compendiumId === 'string' ? w.compendiumId.slice(0, 120) : null,
    name: typeof w.name === 'string' ? w.name.slice(0, 160) : '',
    trait,
    range: typeof w.range === 'string' ? w.range.slice(0, 80) : '',
    dice,
    dmgBonus: clampNum(w.dmgBonus, 0, -20, 50),
    dmgType: w.dmgType === 'mag' ? 'mag' : 'phy',
    feature: typeof w.feature === 'string' ? w.feature.slice(0, 1200) : '',
    hands: w.hands === 'two' ? 'two' : 'one',
    state: w.state === 'inventory' ? 'inventory' : 'active',
    primary: Boolean(w.primary),
    secondary: Boolean(w.secondary) && !Boolean(w.primary),
    ...(w.customName ? { customName: true } : {}),
    ...(w.customStats ? { customStats: true } : {}),
    ...(w.customFeature ? { customFeature: true } : {}),
  };
}

function sanitizeInventoryItem(it) {
  const out = {
    name: typeof it.name === 'string' ? it.name.slice(0, 160) : '',
    qty: clampNum(it.qty, 1, 0, 999),
  };
  if (typeof it.desc === 'string' && it.desc) out.desc = it.desc.slice(0, 2000);
  if (typeof it.itemId === 'string' && it.itemId) out.itemId = it.itemId.slice(0, 120);
  if (typeof it.type === 'string' && it.type) out.type = it.type.slice(0, 60);
  return out;
}

function sanitizeCompanion(comp) {
  if (!isPlainObject(comp)) return null;
  const dice = typeof comp.dice === 'string' && ALLOWED_WEAPON_DICE.has(comp.dice.toLowerCase()) ? comp.dice.toLowerCase() : 'd6';
  const stMax = clampNum(comp.stress?.max, 3, 1, 8);
  const stCur = clampNum(comp.stress?.current, 0, 0, stMax);
  const exps = (Array.isArray(comp.experiences) ? comp.experiences : [])
    .filter(isPlainObject)
    .slice(0, 8)
    .map(e => ({ name: typeof e.name === 'string' ? e.name.slice(0, 120) : '', mod: clampNum(e.mod, 2, -9, 9) }));
  return {
    name: typeof comp.name === 'string' ? comp.name.slice(0, 120) : '',
    species: typeof comp.species === 'string' ? comp.species.slice(0, 120) : '',
    evasion: clampNum(comp.evasion, 10, 1, 30),
    dice,
    range: typeof comp.range === 'string' ? comp.range.slice(0, 80) : 'Mêlée',
    dmgType: comp.dmgType === 'mag' ? 'mag' : 'phy',
    attackName: typeof comp.attackName === 'string' ? comp.attackName.slice(0, 120) : '',
    stress: { max: stMax, current: stCur },
    experiences: exps,
    upgrades: (Array.isArray(comp.upgrades) ? comp.upgrades : []).filter(x => typeof x === 'string').slice(0, 20),
  };
}

function sanitizeBeastform(bf) {
  if (!isPlainObject(bf) || typeof bf.id !== 'string' || !bf.id.trim()) return null;
  const out = {
    id: bf.id.slice(0, 120),
    fr: typeof bf.fr === 'string' ? bf.fr.slice(0, 160) : '',
  };
  if (typeof bf.baseId === 'string' && bf.baseId) out.baseId = bf.baseId.slice(0, 120);
  return out;
}

const EXTRA_CHAR_KEYS = ['className', 'subclassName', 'hopeAbility', 'multiclassClassId', 'gold'];

function sanitizeAncestry(anc) {
  if (!isPlainObject(anc)) return null;
  const abilities = (Array.isArray(anc.abilities) ? anc.abilities : [])
    .filter(isPlainObject)
    .slice(0, 6)
    .map(ab => ({
      ...(typeof ab.fr === 'string' ? { fr: ab.fr.slice(0, 160) } : {}),
      ...(typeof ab.en === 'string' ? { en: ab.en.slice(0, 160) } : {}),
      ...(typeof ab.desc === 'string' ? { desc: ab.desc.slice(0, 2000) } : {}),
    }));
  return {
    id: typeof anc.id === 'string' ? anc.id.slice(0, 160) : '',
    fr: typeof anc.fr === 'string' ? anc.fr.slice(0, 160) : '',
    abilities,
  };
}

function sanitizeCommunity(com) {
  if (!isPlainObject(com)) return null;
  let ability = '';
  if (typeof com.ability === 'string') {
    ability = com.ability.slice(0, 2000);
  } else if (isPlainObject(com.ability)) {
    ability = {
      ...(typeof com.ability.fr === 'string' ? { fr: com.ability.fr.slice(0, 160) } : {}),
      ...(typeof com.ability.en === 'string' ? { en: com.ability.en.slice(0, 160) } : {}),
      ...(typeof com.ability.desc === 'string' ? { desc: com.ability.desc.slice(0, 2000) } : {}),
    };
  }
  return {
    id: typeof com.id === 'string' ? com.id.slice(0, 120) : '',
    fr: typeof com.fr === 'string' ? com.fr.slice(0, 160) : '',
    ability,
  };
}

function sanitizeMixedAncestry(ma) {
  if (!isPlainObject(ma)) return null;
  if (typeof ma.primaryId !== 'string' || typeof ma.secondaryId !== 'string') return null;
  return {
    primaryId: ma.primaryId.slice(0, 120),
    secondaryId: ma.secondaryId.slice(0, 120),
    firstFrom: ma.firstFrom === 2 ? 2 : 1,
  };
}

function sanitizeTierUses(tu) {
  const out = {};
  if (!isPlainObject(tu)) return out;
  for (const [tierKey, opts] of Object.entries(tu)) {
    if (!/^[1-4]$/.test(tierKey) || UNSAFE_OBJECT_KEYS.has(tierKey) || !isPlainObject(opts)) continue;
    const cleanOpts = {};
    for (const [optKey, cnt] of Object.entries(opts)) {
      if (UNSAFE_OBJECT_KEYS.has(optKey)) continue;
      const n = clampNum(cnt, 0, 0, 10);
      if (n > 0) cleanOpts[optKey.slice(0, 60)] = Math.trunc(n);
    }
    if (Object.keys(cleanOpts).length) out[tierKey.slice(0, 16)] = cleanOpts;
  }
  return out;
}

export function sanitizeCharacter(rawObj, blankTemplate) {
  const src = isPlainObject(rawObj) ? stripUnsafeKeys(rawObj) : {};
  const allowedKeys = new Set([...Object.keys(blankTemplate), ...EXTRA_CHAR_KEYS]);
  const obj = {};
  for (const k of Object.keys(src)) {
    if (allowedKeys.has(k)) obj[k] = src[k];
  }
  /* Anciens modèles : hp/stress n'avaient pas encore active/unlocked. */
  const hadHpActive = isPlainObject(obj.hp) && obj.hp.active !== undefined;
  const hadStressActive = isPlainObject(obj.stress) && obj.stress.active !== undefined;
  for (const k of Object.keys(blankTemplate)) {
    const tmplVal = blankTemplate[k];
    if (obj[k] === undefined || obj[k] === null) {
      if (tmplVal !== null) obj[k] = structuredCloneSafe(tmplVal);
      else if (obj[k] === undefined) obj[k] = null;
    } else if (NESTED_PLAIN_KEYS.includes(k) && tmplVal && typeof tmplVal === 'object' && !Array.isArray(tmplVal)) {
      if (typeof obj[k] !== 'object' || Array.isArray(obj[k])) {
        obj[k] = structuredCloneSafe(tmplVal);
      } else {
        for (const subK of Object.keys(tmplVal)) {
          if (obj[k][subK] === undefined || obj[k][subK] === null) {
            obj[k][subK] = structuredCloneSafe(tmplVal[subK]);
          }
        }
      }
    }
  }
  if (!Array.isArray(obj.conditions)) obj.conditions = [];
  if (!Array.isArray(obj.experiences)) obj.experiences = structuredCloneSafe(blankTemplate.experiences || []);
  if (!Array.isArray(obj.weapons)) obj.weapons = [];
  if (!Array.isArray(obj.inventory)) obj.inventory = [];
  if (!Array.isArray(obj.domainCards)) obj.domainCards = [];
  if (!Array.isArray(obj.journal)) obj.journal = [];
  if (!Array.isArray(obj.traitMarks)) obj.traitMarks = [];
  if (!Array.isArray(obj.extraDomains)) obj.extraDomains = [];
  if (!isPlainObject(obj.cardUses)) obj.cardUses = {};
  if (!isPlainObject(obj.cardTokens)) obj.cardTokens = {};
  if (!isPlainObject(obj.subcardTaken)) obj.subcardTaken = {};
  if (!isPlainObject(obj.tierUses)) obj.tierUses = {};
  if (!isPlainObject(obj.backgroundAnswers)) obj.backgroundAnswers = {};

  obj.id = sanitizeId(obj.id, sanitizeId(blankTemplate.id, 'c' + Math.random().toString(36).slice(2, 10)));
  obj.createdAt = clampNum(obj.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER);
  obj.updatedAt = clampNum(obj.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER);

  /* Normalisation des types : un JSON importé peut contenir des chaînes,
     des tableaux ou des null à la place des nombres attendus par les vues. */
  for (const k of ['name', 'pronouns', 'heritage', 'subclassText', 'transformation', 'classFeature', 'hopeFeature', 'notes', 'className']) {
    if (typeof obj[k] !== 'string') obj[k] = typeof obj[k] === 'number' ? String(obj[k]) : '';
  }
  obj.portrait = sanitizePortrait(obj.portrait);
  for (const k of ['classId', 'subclassId', 'multiclassClassId', 'primaryWeaponId', 'secondaryWeaponId', 'armorId']) {
    if (obj[k] !== null && obj[k] !== undefined) {
      obj[k] = typeof obj[k] === 'string' ? obj[k].slice(0, 120) : null;
    }
  }
  obj.level = clampNum(obj.level, 1, 1, 10);
  obj.proficiency = clampNum(obj.proficiency, 1, 1, 6);
  obj.evasion = clampNum(obj.evasion, 10, 0, 30);
  obj.scars = clampNum(obj.scars, 0, 0, 6);
  obj.shortRestsSinceLong = clampNum(obj.shortRestsSinceLong, 0, 0, 99);
  obj.subcardCount = clampNum(obj.subcardCount, 0, 0, 6);
  obj.multiclassed = Boolean(obj.multiclassed);
  obj.customClassFeature = Boolean(obj.customClassFeature);

  if (!isPlainObject(obj.traits)) obj.traits = {};
  for (const k of TRAIT_KEYS) obj.traits[k] = clampNum(obj.traits[k], 0, -9, 9);

  const groups = {
    hp: { max: [6, 0, 12], current: [6, 0, 12], active: [6, 0, 12], unlocked: [0, 0, 12] },
    stress: { max: [6, 0, 12], current: [0, 0, 12], active: [6, 0, 12], unlocked: [0, 0, 12] },
    hope: { max: [6, 0, 6], current: [2, 0, 6] },
    armorSlots: { max: [12, 0, 12], used: [0, 0, 12] },
    thresholds: { bonus: [0, -9, 20] },
    goldTrack: { handfuls: [0, 0, 10], bags: [0, 0, 10], chests: [0, 0, 1] },
  };
  for (const [group, fields] of Object.entries(groups)) {
    const tpl = isPlainObject(blankTemplate[group]) ? blankTemplate[group] : {};
    const cur = isPlainObject(obj[group]) ? obj[group] : {};
    obj[group] = { ...tpl, ...cur };
    for (const [field, [fallback, min, max]] of Object.entries(fields)) {
      obj[group][field] = clampNum(obj[group][field], fallback, min, max);
    }
  }
  obj.armorSlots.max = 12;
  if (!hadHpActive) {
    obj.hp.active = clampNum(obj.hp.max, 6, 0, 12);
    obj.hp.unlocked = 0;
  }
  if (!hadStressActive) {
    obj.stress.active = clampNum(obj.stress.max, 6, 0, 12);
    obj.stress.unlocked = 0;
  }
  const armorTpl = isPlainObject(blankTemplate.armorCard) ? blankTemplate.armorCard : {};
  obj.armorCard = {
    ...armorTpl,
    ...(isPlainObject(obj.armorCard) ? {
      compendiumId: typeof obj.armorCard.compendiumId === 'string' ? obj.armorCard.compendiumId.slice(0, 120) : null,
      name: typeof obj.armorCard.name === 'string' ? obj.armorCard.name : '',
      baseScore: clampNum(obj.armorCard.baseScore, 0, 0, 12),
      baseMajor: clampNum(obj.armorCard.baseMajor, 0, 0, 40),
      baseSevere: clampNum(obj.armorCard.baseSevere, 0, 0, 60),
      feature: typeof obj.armorCard.feature === 'string' ? obj.armorCard.feature : '',
      ...(obj.armorCard.customName ? { customName: true } : {}),
      ...(obj.armorCard.customStats ? { customStats: true } : {}),
      ...(obj.armorCard.customFeature ? { customFeature: true } : {}),
    } : {}),
  };
  obj.hp.unlocked = Math.min(obj.hp.unlocked, 12 - obj.hp.active);
  obj.stress.unlocked = Math.min(obj.stress.unlocked, 12 - obj.stress.active);
  obj.hp.current = Math.min(obj.hp.current, obj.hp.active + obj.hp.unlocked);
  obj.stress.current = Math.min(obj.stress.current, obj.stress.active + obj.stress.unlocked);
  obj.hope.current = Math.min(obj.hope.current, obj.hope.max);

  obj.experiences = (Array.isArray(obj.experiences) ? obj.experiences : [])
    .filter(isPlainObject)
    .map(e => ({ name: typeof e.name === 'string' ? e.name : '', mod: clampNum(e.mod, 2, -9, 9) }));
  while (obj.experiences.length < 2) obj.experiences.push({ name: '', mod: 2 });

  obj.weapons = (Array.isArray(obj.weapons) ? obj.weapons : []).filter(isPlainObject).map(sanitizeWeapon);
  obj.inventory = (Array.isArray(obj.inventory) ? obj.inventory : []).filter(isPlainObject).map(sanitizeInventoryItem);
  obj.domainCards = (Array.isArray(obj.domainCards) ? obj.domainCards : [])
    .filter(x => isPlainObject(x) && typeof x.cardId === 'string' && x.cardId.trim())
    .map(x => ({
      cardId: x.cardId.slice(0, 120),
      ...(x.inHand !== undefined ? { inHand: Boolean(x.inHand) } : {}),
    }));
  obj.journal = (Array.isArray(obj.journal) ? obj.journal : [])
    .filter(isPlainObject)
    .map(j => ({
      date: typeof j.date === 'string' ? j.date.slice(0, 80) : '',
      text: typeof j.text === 'string' ? j.text.slice(0, 10000) : '',
    }));
  obj.conditions = (Array.isArray(obj.conditions) ? obj.conditions : []).filter(x => typeof x === 'string').map(x => x.slice(0, 80));
  obj.traitMarks = (Array.isArray(obj.traitMarks) ? obj.traitMarks : []).filter(x => typeof x === 'string').map(x => x.slice(0, 40));
  obj.extraDomains = (Array.isArray(obj.extraDomains) ? obj.extraDomains : []).filter(x => typeof x === 'string').map(x => x.slice(0, 80));
  obj.ancestry = sanitizeAncestry(obj.ancestry);
  obj.community = sanitizeCommunity(obj.community);
  obj.mixedAncestry = sanitizeMixedAncestry(obj.mixedAncestry);
  obj.companion = sanitizeCompanion(obj.companion);
  obj.beastform = sanitizeBeastform(obj.beastform);

  const cleanBoolMap = (m) => {
    const out = {};
    if (!isPlainObject(m)) return out;
    for (const [k, v] of Object.entries(m)) {
      if (!UNSAFE_OBJECT_KEYS.has(k)) out[k.slice(0, 160)] = Boolean(v);
    }
    return out;
  };
  const cleanIntMap = (m, min, max) => {
    const out = {};
    if (!isPlainObject(m)) return out;
    for (const [k, v] of Object.entries(m)) {
      if (!UNSAFE_OBJECT_KEYS.has(k)) out[k.slice(0, 160)] = clampNum(v, 0, min, max);
    }
    return out;
  };
  const cleanStrMap = (m) => {
    const out = {};
    if (!isPlainObject(m)) return out;
    for (const [k, v] of Object.entries(m)) {
      if (!UNSAFE_OBJECT_KEYS.has(k) && typeof v === 'string') out[k.slice(0, 80)] = v.slice(0, 5000);
    }
    return out;
  };
  obj.cardUses = cleanBoolMap(obj.cardUses);
  obj.subcardTaken = cleanBoolMap(obj.subcardTaken);
  obj.tierUses = sanitizeTierUses(obj.tierUses);
  obj.cardTokens = cleanIntMap(obj.cardTokens, 0, 20);
  obj.backgroundAnswers = cleanStrMap(obj.backgroundAnswers);

  if (obj.hopeAbility !== undefined && obj.hopeAbility !== null) {
    if (typeof obj.hopeAbility === 'string') obj.hopeAbility = obj.hopeAbility.slice(0, 200);
    else if (isPlainObject(obj.hopeAbility)) {
      obj.hopeAbility = {
        name: typeof obj.hopeAbility.name === 'string' ? obj.hopeAbility.name.slice(0, 200) : '',
        desc: typeof obj.hopeAbility.desc === 'string' ? obj.hopeAbility.desc.slice(0, 2000) : '',
      };
    } else obj.hopeAbility = '';
  }
  return obj;
}

function structuredCloneSafe(val) {
  return val === undefined ? undefined : JSON.parse(JSON.stringify(val));
}
