/* Daggerborne — no-build ES modules PWA (FR) */
import { sanitizeCharacter } from './rules.js';

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

// ---------- persistence (IndexedDB principal + repli localStorage rétro-compatible) ----------
const LS_KEY = 'dh-compagnon-v1';
const IDB_NAME = 'daggerborne-db';
const IDB_STORE = 'app';
const IDB_KEY = 'state';

function defaultState() {
  return {
    characters: [],
    rolls: [],
    fear: 0,
    countdowns: [],
    encounter: { pcCount: 4, adj: {}, active: [], environmentId: null },
    settings: { diceAnim: true, massiveDamageRule: false },
  };
}

let state = loadSync();
let idbReady = false;
let idbAvailable = typeof indexedDB !== 'undefined';

function normalizeState(s) {
  const def = defaultState();
  if (!s || typeof s !== 'object') return def;
  return {
    ...def,
    ...s,
    characters: Array.isArray(s.characters) ? s.characters : [],
    rolls: Array.isArray(s.rolls) ? s.rolls : [],
    fear: Number.isFinite(s.fear) ? s.fear : 0,
    countdowns: Array.isArray(s.countdowns) ? s.countdowns : [],
    encounter: { ...def.encounter, ...(s.encounter || {}), active: Array.isArray(s.encounter?.active) ? s.encounter.active : [] },
    settings: { ...def.settings, ...(s.settings || {}) },
  };
}

function loadSync() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { /* fresh */ }
  return defaultState();
}

function openIdb() {
  if (!idbAvailable) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { idbAvailable = false; resolve(null); };
    } catch (e) {
      idbAvailable = false;
      resolve(null);
    }
  });
}

async function idbGet(key) {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

async function idbSet(key, val) {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) { resolve(false); }
  });
}

/* Initialise IndexedDB au démarrage : récupère l'état complet (avec portraits HD) ou migre localStorage → IDB */
export async function initStorage() {
  const fromIdb = await idbGet(IDB_KEY);
  if (fromIdb && Array.isArray(fromIdb.characters)) {
    const lsRaw = localStorage.getItem(LS_KEY);
    const idbUpdated = fromIdb._savedAt || 0;
    const lsUpdated = state?._savedAt || 0;
    if (!lsRaw || idbUpdated >= lsUpdated) {
      state = normalizeState(fromIdb);
    } else {
      await idbSet(IDB_KEY, state);
    }
    idbReady = true;
    return state;
  }
  await idbSet(IDB_KEY, state);
  idbReady = true;
  return state;
}

function save() {
  state._savedAt = Date.now();
  const snapshot = JSON.parse(JSON.stringify(state));
  if (idbAvailable) idbSet(IDB_KEY, snapshot);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
  } catch (e) {
    /* Quota localStorage dépassé (souvent à cause de plusieurs portraits) :
       on conserve la sauvegarde complète en IndexedDB et un repli allégé sans portraits en localStorage */
    try {
      const lite = {
        ...snapshot,
        characters: snapshot.characters.map(c => ({ ...c, portrait: '' })),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(lite));
    } catch (e2) { /* IndexedDB garde tout */ }
  }
}

export function getState() { return state; }
export function setState(mut) { mut(state); save(); }

export function getStorageInfo() {
  const json = JSON.stringify(state);
  return {
    bytes: json.length,
    kb: (json.length / 1024).toFixed(1),
    chars: state.characters.length,
    rolls: state.rolls.length,
    idb: idbReady && idbAvailable,
  };
}

/* Point d'extension Cloud Sync — préparé pour l'option payante Google Drive (Pro) */
export const cloudSync = {
  provider: 'google-drive',
  tier: 'pro-upcoming',
  enabled: false,
  getStatus() {
    return {
      configured: false,
      tierLabel: 'Option Pro (à venir)',
      summary: 'La synchronisation automatique vers Google Drive sera proposée en option payante. Exportez vos sauvegardes JSON gratuitement à tout moment.',
    };
  },
  exportPayload() {
    return {
      schema: 'daggerborne-backup-v1',
      exportedAt: new Date().toISOString(),
      data: getState(),
    };
  },
};

/* filet de sécurité pour les imports d'anciens JSON : complète les champs manquants */
export function ensureCharacter(obj) {
  return sanitizeCharacter(obj, newCharacter());
}

/* Import d'un personnage depuis un texte JSON */
export function importCharacterFromText(rawText) {
  const obj = JSON.parse(rawText);
  if (!obj || typeof obj !== 'object' || !obj.name || !obj.traits) {
    throw new Error('Format de personnage invalide.');
  }
  ensureCharacter(obj);
  obj.id = uid();
  obj.updatedAt = Date.now();
  setState(s => { s.characters.push(obj); });
  return obj;
}

/* Import d'une sauvegarde globale (remplacement ou fusion) */
export function importFullBackupFromText(rawText, mode = 'merge') {
  const parsed = JSON.parse(rawText);
  const payload = parsed?.schema === 'daggerborne-backup-v1' && parsed.data ? parsed.data : parsed;
  if (!payload || !Array.isArray(payload.characters)) {
    throw new Error('Sauvegarde invalide : liste de personnages introuvable.');
  }
  const incomingChars = payload.characters.map(c => ensureCharacter({ ...c }));
  let added = 0;
  let updated = 0;
  if (mode === 'replace') {
    state = normalizeState({
      ...payload,
      characters: incomingChars,
    });
    added = incomingChars.length;
    save();
  } else {
    setState(s => {
      for (const ic of incomingChars) {
        const idx = s.characters.findIndex(x => x.id === ic.id);
        if (idx >= 0) {
          s.characters[idx] = ic;
          updated++;
        } else {
          s.characters.push(ic);
          added++;
        }
      }
      if (Array.isArray(payload.countdowns) && !s.countdowns.length) {
        s.countdowns = payload.countdowns;
      }
      if (Number.isFinite(payload.fear) && s.fear === 0) s.fear = payload.fear;
    });
  }
  return { added, updated, total: state.characters.length };
}

// ---------- data cache ----------
const cache = {};
const DATA_VER = 'v27';
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
  appName: 'Daggerborne',
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
    name: '', pronouns: '', portrait: '', ancestry: null, community: null,
    mixedAncestry: null,
    classId: null, subclassId: null,
    heritage: '', subclassText: '', transformation: '',
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    experiences: [{ name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }],
    hp: { max: 6, current: 6, active: 6, unlocked: 0 },
    stress: { max: 6, current: 0, active: 6, unlocked: 0 },
    hope: { max: 6, current: 2 },
    scars: 0,
    hopeFeature: '', classFeature: '',
    evasion: 10,
    level: 1, proficiency: 1,
    traitMarks: [], subcardTaken: {}, subcardCount: 0, tierUses: {},
    multiclassed: false, extraDomains: [],
    conditions: [],
    beastform: null,
    companion: null,
    cardUses: {},
    cardTokens: {},
    shortRestsSinceLong: 0,
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

/* ---------- export JSON compatible Desktop, Android navigateur/PWA et APK/WebView ---------- */
export function exportJsonFile(filename, dataObj, title = 'Export JSON') {
  const json = JSON.stringify(dataObj, null, 2);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isWebView = /;\s*wv\)/i.test(navigator.userAgent) || !!window.Capacitor?.isNativePlatform?.();

  const triggerDownload = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 30000);
  };

  if (!isAndroid && !isWebView) {
    triggerDownload();
    toast(`Export téléchargé : ${filename}`);
    return;
  }

  if (!isWebView) {
    try { triggerDownload(); } catch (e) { /* fallback via modal ci-dessous */ }
  }

  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const canShareApi = typeof navigator.share === 'function';
  sheet.innerHTML = `
    <h3>${esc(title)}</h3>
    <div class="ms-meta">${esc(filename)} · ${(json.length / 1024).toFixed(1)} Ko</div>
    <p class="page-sub" style="margin:.4rem 0 .8rem;font-size:.8rem">
      ${isWebView
        ? 'Sur Android (APK/WebView), utilisez Partager/Enregistrer ou Copier le JSON pour sauvegarder vos données.'
        : 'Si le téléchargement ne démarre pas automatiquement sur votre tablette ou mobile, utilisez Partager ou Copier ci-dessous.'}
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem">
      ${canShareApi ? '<button class="btn" id="exp-share">📤 Partager / Enregistrer</button>' : ''}
      <button class="btn ${canShareApi ? 'ghost' : ''}" id="exp-copy">📋 Copier le JSON</button>
      <button class="btn ghost" id="exp-dl">📥 Télécharger (.json)</button>
    </div>
    <details style="margin-top:.2rem">
      <summary style="cursor:pointer;font-size:.78rem;color:var(--text-faint)">Afficher le JSON brut</summary>
      <textarea id="exp-raw" readonly rows="6" style="width:100%;margin-top:.45rem;background:var(--panel-3);border:1px solid var(--border);border-radius:8px;color:var(--text-dim);font-family:monospace;font-size:.72rem;padding:.45rem"></textarea>
    </details>
    <div class="modal-close-row"><button class="btn ghost small" id="exp-close">Fermer</button></div>`;

  $('#exp-raw', sheet).value = json;
  $('#exp-close', sheet).addEventListener('click', () => back.remove());

  $('#exp-copy', sheet).addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      } else {
        const ta = $('#exp-raw', sheet);
        ta.closest('details').open = true;
        ta.select();
        document.execCommand('copy');
      }
      toast('JSON copié dans le presse-papiers.');
    } catch (err) {
      const ta = $('#exp-raw', sheet);
      ta.closest('details').open = true;
      ta.focus();
      ta.select();
      toast('Sélectionnez et copiez le texte ci-dessous.');
    }
  });

  $('#exp-dl', sheet).addEventListener('click', async () => {
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        toast(`Fichier enregistré : ${filename}`);
        return;
      }
      triggerDownload();
      toast(`Téléchargement lancé : ${filename}`);
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Téléchargement bloqué sur cet appareil — utilisez Partager ou Copier.');
    }
  });

  $('#exp-share', sheet)?.addEventListener('click', async () => {
    try {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, files: [file] });
      } else {
        await navigator.share({ title, text: json });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.share({ title, text: json });
        } catch (err2) {
          if (err2?.name !== 'AbortError') toast('Partage impossible — utilisez « Copier le JSON ».');
        }
      }
    }
  });
}

/* Modal universel « Coller un JSON » (tablette / Android sans explorateur de fichiers) */
export function openPasteJsonModal({ title = 'Coller un JSON', placeholder = '{ ... }', onImport }) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  sheet.innerHTML = `
    <h3>${esc(title)}</h3>
    <div class="ms-meta">Collez le contenu JSON copié depuis un autre appareil ou une sauvegarde.</div>
    <textarea id="paste-json-ta" rows="8" placeholder="${esc(placeholder)}" style="width:100%;margin:.6rem 0;background:var(--panel-3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:monospace;font-size:.75rem;padding:.55rem"></textarea>
    <div style="display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost small" id="pj-cancel">Annuler</button>
      <button class="btn small" id="pj-ok">Importer</button>
    </div>`;
  $('#pj-cancel', sheet).addEventListener('click', () => back.remove());
  $('#pj-ok', sheet).addEventListener('click', () => {
    const raw = $('#paste-json-ta', sheet).value.trim();
    if (!raw) { toast('Collez un JSON valide avant d\'importer.'); return; }
    try {
      onImport(raw, () => back.remove());
    } catch (err) {
      toast(err?.message || 'JSON invalide.');
    }
  });
}
