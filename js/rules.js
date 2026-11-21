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

export function calcEncounterSpent(entries = []) {
  return entries.reduce((sum, e) => {
    const cost = ADVERSARY_POINT_COST[e.type] ?? 2;
    const count = Math.max(1, parseInt(e.qty, 10) || 1);
    /* pour les Sbires, chaque groupe de la taille du groupe coûte 1 point (1 entrée groupe = 1 pt) */
    return sum + cost * count;
  }, 0);
}

const NESTED_PLAIN_KEYS = ['traits', 'hp', 'stress', 'hope', 'thresholds', 'armorSlots', 'armorCard', 'goldTrack'];

export function sanitizeCharacter(obj, blankTemplate) {
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
  if (!obj.cardUses || typeof obj.cardUses !== 'object') obj.cardUses = {};
  if (!obj.cardTokens || typeof obj.cardTokens !== 'object') obj.cardTokens = {};
  if (!obj.subcardTaken || typeof obj.subcardTaken !== 'object') obj.subcardTaken = {};
  if (!obj.tierUses || typeof obj.tierUses !== 'object') obj.tierUses = {};
  if (!obj.backgroundAnswers || typeof obj.backgroundAnswers !== 'object') obj.backgroundAnswers = {};
  if (typeof obj.shortRestsSinceLong !== 'number') obj.shortRestsSinceLong = 0;
  return obj;
}

function structuredCloneSafe(val) {
  return val === undefined ? undefined : JSON.parse(JSON.stringify(val));
}
