/* Daggerborne — no-build ES modules PWA (FR) */
import { sanitizeCharacter, isPlainObject, stripUnsafeKeys, sanitizeId } from './rules.js';

export const MAX_CHAR_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_BACKUP_IMPORT_BYTES = 10 * 1024 * 1024;

import { t, getLang, T } from './i18n.js';
// ---------- tiny helpers ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const el = (html) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const toast = (msg) => {
  const node = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2600);
};
export function confirmModal(msg, { title = '', okLabel = '', cancelLabel = '', danger = false } = {}) {
  const en = getLang() === 'en';
  const hdr = title || (en ? 'Confirmation' : 'Confirmation');
  const okTxt = okLabel || (en ? 'Confirm' : 'Confirmer');
  const cancelTxt = cancelLabel || (en ? 'Cancel' : 'Annuler');
  return new Promise((resolve) => {
    const back = el(`<div class="modal-back"></div>`);
    const sheet = el(`<div class="modal-sheet"></div>`);
    back.appendChild(sheet);
    sheet.innerHTML = `
      <h3>${esc(hdr)}</h3>
      <p style="font-size:.9rem;color:var(--text-dim);line-height:1.5;margin:.5rem 0 1rem">${esc(msg)}</p>
      <div style="display:flex;gap:.5rem;justify-content:flex-end">
        <button type="button" class="btn ghost small" id="cm-cancel">${esc(cancelTxt)}</button>
        <button type="button" class="btn ${danger ? 'danger ' : ''}small" id="cm-ok">${esc(okTxt)}</button>
      </div>`;
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      back.remove();
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => { if (e.target === back) finish(false); });
    $('#cm-cancel', sheet).addEventListener('click', () => finish(false));
    $('#cm-ok', sheet).addEventListener('click', () => finish(true));
    document.body.appendChild(back);
    $('#cm-ok', sheet).focus?.();
  });
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const utf8ByteLength = (str) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str).length : str.length);

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

const clampInt = (v, fallback, min, max) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
};

function sanitizeRoll(r) {
  if (!isPlainObject(r)) return null;
  const hasDuality = r.hope !== null && r.hope !== undefined && r.fear !== null && r.fear !== undefined;
  const result = (r.result === 'crit' || r.result === 'hope' || r.result === 'fear' || r.result === 'plain')
    ? r.result
    : (hasDuality ? 'hope' : 'plain');
  return {
    id: sanitizeId(r.id) || ('r' + uid()),
    t: clampInt(r.t, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    hope: hasDuality ? clampInt(r.hope, 1, 1, 12) : null,
    fear: hasDuality ? clampInt(r.fear, 1, 1, 12) : null,
    mod: clampInt(r.mod, 0, -99, 99),
    adv: r.adv != null ? clampInt(r.adv, 1, 1, 6) : null,
    dis: r.dis != null ? clampInt(r.dis, 1, 1, 6) : null,
    total: clampInt(r.total, 0, -999, 9999),
    result,
    label: typeof r.label === 'string' ? r.label.slice(0, 200) : '',
    notation: typeof r.notation === 'string' ? r.notation.slice(0, 80) : '',
    charName: typeof r.charName === 'string' ? r.charName.slice(0, 120) : null,
    difficulty: r.difficulty != null ? clampInt(r.difficulty, 0, 0, 99) : null,
    ...(typeof r.success === 'boolean' ? { success: r.success } : {}),
  };
}

function sanitizeCountdown(cd) {
  if (!isPlainObject(cd)) return null;
  const max = clampInt(cd.max, 4, 1, 24);
  const value = clampInt(cd.value, 0, 0, max);
  return {
    id: sanitizeId(cd.id) || uid(),
    name: typeof cd.name === 'string' ? cd.name.slice(0, 160) : 'Compte à rebours',
    max,
    value,
  };
}

function sanitizeEncounterInst(inst) {
  if (!isPlainObject(inst)) return null;
  const hpMax = clampInt(inst.hpMax, 4, 1, 40);
  const stressMax = clampInt(inst.stressMax, 0, 0, 20);
  return {
    uid: sanitizeId(inst.uid) || uid(),
    advId: typeof inst.advId === 'string' ? inst.advId.slice(0, 120) : null,
    name: typeof inst.name === 'string' ? inst.name.slice(0, 160) : 'Adversaire',
    type: typeof inst.type === 'string' ? inst.type.slice(0, 40) : 'standard',
    tier: clampInt(inst.tier, 1, 1, 4),
    difficulty: inst.difficulty != null ? clampInt(inst.difficulty, 12, 1, 40) : null,
    hpMax,
    hpMarked: clampInt(inst.hpMarked, 0, 0, hpMax),
    stressMax,
    stressMarked: clampInt(inst.stressMarked, 0, 0, stressMax),
    major: inst.major != null ? clampInt(inst.major, 7, 0, 99) : null,
    severe: inst.severe != null ? clampInt(inst.severe, 14, 0, 199) : null,
    atkBonus: inst.atkBonus != null && inst.atkBonus !== '' ? String(inst.atkBonus).slice(0, 16) : null,
    atkName: typeof inst.atkName === 'string' ? inst.atkName.slice(0, 120) : '',
    atkDamage: typeof inst.atkDamage === 'string' ? inst.atkDamage.slice(0, 60) : '',
    conditions: (Array.isArray(inst.conditions) ? inst.conditions : []).filter(x => typeof x === 'string').slice(0, 12).map(x => x.slice(0, 40)),
  };
}

function sanitizeEncounter(enc) {
  const def = defaultState().encounter;
  if (!isPlainObject(enc)) return def;
  const cleanAdj = {};
  if (isPlainObject(enc.adj)) {
    for (const k of ['easier', 'twoSolos', 'extraDmg', 'lowerTier', 'noHeavy', 'harder']) {
      if (enc.adj[k]) cleanAdj[k] = true;
    }
  }
  return {
    pcCount: clampInt(enc.pcCount, 4, 1, 10),
    adj: cleanAdj,
    active: (Array.isArray(enc.active) ? enc.active : []).map(sanitizeEncounterInst).filter(Boolean).slice(0, 100),
    environmentId: typeof enc.environmentId === 'string' ? enc.environmentId.slice(0, 120) : null,
  };
}

function sanitizeSettings(st) {
  const def = defaultState().settings;
  if (!isPlainObject(st)) return def;
  return {
    diceAnim: st.diceAnim !== false,
    massiveDamageRule: Boolean(st.massiveDamageRule),
  };
}

function safeJsonParse(rawText) {
  return stripUnsafeKeys(JSON.parse(rawText));
}

function normalizeState(raw) {
  const def = defaultState();
  if (!isPlainObject(raw)) return def;
  const s = stripUnsafeKeys(raw);
  return {
    ...def,
    ...(typeof s._savedAt === 'number' && Number.isFinite(s._savedAt) ? { _savedAt: s._savedAt } : {}),
    characters: Array.isArray(s.characters)
      ? s.characters
        .filter(isPlainObject)
        .map(c => sanitizeCharacter(c, newCharacter()))
      : [],
    rolls: Array.isArray(s.rolls) ? s.rolls.map(sanitizeRoll).filter(Boolean).slice(0, 60) : [],
    fear: clampInt(s.fear, 0, 0, 30),
    countdowns: Array.isArray(s.countdowns) ? s.countdowns.map(sanitizeCountdown).filter(Boolean).slice(0, 40) : [],
    encounter: sanitizeEncounter(s.encounter),
    settings: sanitizeSettings(s.settings),
  };
}

function loadSync() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeState(safeJsonParse(raw));
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
    let lsRaw = null;
    let lsParsed = null;
    try {
      lsRaw = localStorage.getItem(LS_KEY);
      if (lsRaw) lsParsed = safeJsonParse(lsRaw);
    } catch (e) { /* stockage indisponible */ }
    const idbUpdated = fromIdb._savedAt || 0;
    const lsUpdated = state?._savedAt || 0;
    if (!lsRaw || idbUpdated >= lsUpdated) {
      state = normalizeState(fromIdb);
    } else {
      if (lsParsed?._strippedPortraits) {
        const idbPortraits = new Map(fromIdb.characters.filter(c => c?.id && c?.portrait).map(c => [c.id, c.portrait]));
        for (const ch of state.characters) {
          if (!ch.portrait && idbPortraits.has(ch.id)) ch.portrait = idbPortraits.get(ch.id);
        }
      }
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
        _strippedPortraits: true,
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
      tierLabel: t('settingsProSoon'),
      summary: t('settingsCloudDesc'),
    };
  },
  exportPayload() {
    return {
      schema: 'daggerborne-backup-v1',
      exportedAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(getState())),
    };
  },
};

/* filet de sécurité pour les imports d'anciens JSON : complète les champs manquants */
export function ensureCharacter(obj) {
  return sanitizeCharacter(obj, newCharacter());
}

/* Import d'un personnage depuis un texte JSON */
export function importCharacterFromText(rawText) {
  if (typeof rawText !== 'string' || utf8ByteLength(rawText) > MAX_CHAR_IMPORT_BYTES) {
    throw new Error('Fichier trop volumineux (max 2 Mo).');
  }
  const raw = safeJsonParse(rawText);
  if (!isPlainObject(raw) || typeof raw.name !== 'string' || !isPlainObject(raw.traits)) {
    throw new Error('Format de personnage invalide.');
  }
  const clean = ensureCharacter(raw);
  if (!clean.name.trim()) clean.name = 'Sans nom';
  clean.id = uid();
  clean.updatedAt = Date.now();
  setState(s => { s.characters.push(clean); });
  return clean;
}

/* Import d'une sauvegarde globale (remplacement ou fusion) */
export function importFullBackupFromText(rawText, mode = 'merge') {
  if (typeof rawText !== 'string' || utf8ByteLength(rawText) > MAX_BACKUP_IMPORT_BYTES) {
    throw new Error('Sauvegarde trop volumineuse (max 10 Mo).');
  }
  const parsed = safeJsonParse(rawText);
  const payload = isPlainObject(parsed) && parsed.schema === 'daggerborne-backup-v1' && isPlainObject(parsed.data) ? parsed.data : parsed;
  if (!isPlainObject(payload) || !Array.isArray(payload.characters)) {
    throw new Error('Sauvegarde invalide : liste de personnages introuvable.');
  }
  const incomingChars = payload.characters.filter(isPlainObject).map(c => ensureCharacter(c));
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
        s.countdowns = payload.countdowns.map(sanitizeCountdown).filter(Boolean).slice(0, 40);
      }
      if (Number.isFinite(payload.fear) && s.fear === 0) {
        s.fear = clampInt(payload.fear, 0, 0, 30);
      }
    });
  }
  return { added, updated, total: state.characters.length };
}

// ---------- data cache ----------
const cache = {};
const DATA_VER = 'v37';
export async function data(name, lang = getLang()) {
  const dir = lang === 'en' ? 'data/en' : 'data';
  const key = lang + ':' + name;
  if (!cache[key]) {
    const r = await fetch(`${dir}/${name}.json?${DATA_VER}`);
    if (!r.ok) throw new Error(`data ${name}: ${r.status}`);
    cache[key] = await r.json();
  }
  return cache[key];
}

// ---------- i18n : dictionnaire dynamique partagé (FR/EN) ----------
/* T vient de i18n.js : il suit la langue courante. Garder une copie statique
   en français ici laissait la navigation et les traits en français en mode EN. */
export { T };

// ---------- router ----------
const routes = {};
export function registerRoute(path, render) { routes[path] = render; }
export function go(path, param) {
  location.hash = `#${path}${param ? '/' + encodeURIComponent(param) : ''}`;
}
export function parseHash() {
  const h = location.hash.replace(/^#+\/?/, '') || 'home';
  const [path, ...rest] = h.split('/');
  const rawParam = rest.join('/');
  let param = null;
  if (rawParam) {
    try { param = decodeURIComponent(rawParam); } catch (e) { param = rawParam; }
  }
  return { path: routes[path] ? path : 'home', param };
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
    hopeFeature: '', classFeature: '', customClassFeature: false,
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
      ${canShareApi ? `<button class="btn" id="exp-share">📤 ${t('coreShare')}</button>` : ''}
      <button class="btn ${canShareApi ? 'ghost' : ''}" id="exp-copy">📋 ${t('coreCopyJson')}</button>
      <button class="btn ghost" id="exp-dl">💾 ${t('coreDownload')}</button>
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
    <div class="ms-meta">${t('corePasteJson')}</div>
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
