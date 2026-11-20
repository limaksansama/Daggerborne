/* Daggervault — no-build ES modules PWA (FR) */

// ---------- tiny helpers ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const toast = (msg) => {
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- persistence ----------
const LS_KEY = 'dh-compagnon-v1';
let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && s.characters) return s;
  } catch (e) { /* fresh */ }
  return { characters: [], rolls: [], fear: 0, countdowns: [], settings: { diceAnim: true } };
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
export function getState() { return state; }
export function setState(mut) { mut(state); save(); }
/* filet de sécurité pour les imports d'anciens JSON : complète les champs manquants */
export function ensureCharacter(obj) {
  const fresh = newCharacter();
  for (const k of Object.keys(fresh)) {
    if (obj[k] === undefined) obj[k] = fresh[k];
  }
  return obj;
}

// ---------- data cache ----------
const cache = {};
const DATA_VER = 'v25';
export async function data(name) {
  if (!cache[name]) {
    const r = await fetch(`data/${name}.json?${DATA_VER}`);
    if (!r.ok) throw new Error(`data ${name}: ${r.status}`);
    cache[name] = await r.json();
  }
  return cache[name];
}

// ---------- i18n-ish static strings ----------
export const T = {
  appName: 'Daggervault',
  pageHome: 'Accueil', pageChars: 'Personnages', pageDice: 'Dés', pageCompendium: 'Compendium', pageGM: 'MJ', pageSettings: 'Réglages',
  traits: { agility: 'Agilité', strength: 'Force', finesse: 'Finesse', instinct: 'Instinct', presence: 'Présence', knowledge: 'Savoir' },
  traitShort: { agility: 'AGI', strength: 'FOR', finesse: 'FIN', instinct: 'INS', presence: 'PRÉ', knowledge: 'SAV' },
  traitVerbs: {
    agility: 'Manœuvrer · Sauter · Sprinter',
    strength: 'Empoigner · Fracasser · Soulever',
    finesse: 'Bricoler · Cacher · Contrôler',
    instinct: 'Percevoir · Se repérer · Sentir',
    presence: 'Charmer · Duper · Jouer',
    knowledge: 'Analyser · Comprendre · Se souvenir',
  },
  cardType: { spell: 'Sort', ability: 'Capacité', grimoire: 'Grimoire' },
  burden: { oneHanded: 'Une main', twoHanded: 'Deux mains' },
  damageType: { phy: 'Physique', mag: 'Magique' },
  tiers: { 1: 'Palier 1 (Niveau 1)', 2: 'Palier 2 (Niv. 2–4)', 3: 'Palier 3 (Niv. 5–7)', 4: 'Palier 4 (Niv. 8–10)' },
};

// ---------- router ----------
const routes = {};
export function registerRoute(path, render) { routes[path] = render; }
export function go(path, param) {
  location.hash = `#${path}${param ? '/' + encodeURIComponent(param) : ''}`;
}
export function parseHash() {
  const h = location.hash.replace(/^#+\/?/, '') || 'home';
  const [path, ...rest] = h.split('/');
  return { path: routes[path] ? path : 'home', param: rest.join('/') ? decodeURIComponent(rest.join('/')) : null };
}

// ---------- character model ----------
/* Modèle complet « feuille officielle » — migrate() n'est plus qu'un filet de
   sécurité pour les imports d'anciens JSON (sheet.js). */
export function newCharacter(base) {
  return {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: '', pronouns: '', ancestry: null, community: null,
    classId: null, subclassId: null,
    heritage: '', subclassText: '',
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    experiences: [{ name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }],
    hp: { max: 6, current: 6, active: 6, unlocked: 0 },
    stress: { max: 6, current: 0, active: 6, unlocked: 0 },
    hope: { max: 6, current: 2 },
    hopeFeature: '', classFeature: '',
    evasion: 10,
    level: 1, proficiency: 1,
    traitMarks: [], subcardTaken: {}, subcardCount: 0, tierUses: {},
    multiclassed: false, extraDomains: [],
    thresholds: { bonus: 0 },
    armorSlots: { max: 12, used: 0 },
    armorCard: { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' },
    goldTrack: { handfuls: 0, bags: 0, chests: 0 },
    primaryWeaponId: null, secondaryWeaponId: null, armorId: null,
    weapons: [],            // cartes d'arme : {uid, compendiumId, name, trait, range, dice, dmgType, feature, hands, state, primary, secondary}
    inventory: [],
    domainCards: [],        // {cardId, inHand:bool}
    notes: '',
    journal: [],
    backgroundAnswers: {},
    ...base,
  };
}
export function getChar(id) { return state.characters.find(c => c.id === id); }
export function saveChar(c) {
  c.updatedAt = Date.now();
  const i = state.characters.findIndex(x => x.id === c.id);
  if (i >= 0) state.characters[i] = c; else state.characters.push(c);
  save();
}

// ---------- dice engine ----------
export function rollD(n) { return 1 + Math.floor(Math.random() * n); }

export function dualityRoll(opts = {}) {
  // Dés de Dualité : deux d12 (Espoir + Peur) — Livre de règles p.90
  const hopeDie = rollD(12);
  const fearDie = rollD(12);
  let mod = opts.mod ?? 0;
  // Avantage : +1d6 au total ; Désavantage : −1d6 (p.100)
  const advDice = [];
  if (opts.advantage) advDice.push(rollD(6));
  if (opts.extraAdv) advDice.push(rollD(6));
  const advBest = advDice.length ? Math.max(...advDice) : null;
  const disDie = opts.disadvantage ? rollD(6) : null;
  let total = hopeDie + fearDie + mod + (advBest ?? 0) - (disDie ?? 0);
  // Succès critique : les deux dés de Dualité donnent le même nombre (p.90)
  let result;
  if (hopeDie === fearDie) result = 'crit';
  else if (hopeDie > fearDie) result = 'hope';
  else result = 'fear';
  const rec = {
    id: uid(), t: Date.now(),
    hope: hopeDie, fear: fearDie, mod, adv: advBest, dis: disDie,
    total, result, label: opts.label || '',
    charName: opts.charName || null,
    difficulty: opts.difficulty ?? null,
  };
  if (rec.difficulty != null) rec.success = total >= rec.difficulty;
  state.rolls.unshift(rec);
  state.rolls = state.rolls.slice(0, 60);
  save();
  return rec;
}

/* Fix 3 — limite de 5 cartes en main : ajoute une carte en respectant la règle.
   Retourne true si la carte est entrée en main, false si elle part au caveau. */
export function addToHand(c, cardId) {
  const inHand = c.domainCards.filter(x => x.inHand).length;
  const toHand = inHand < 5;
  c.domainCards.push({ cardId, inHand: toHand });
  return toHand;
}
