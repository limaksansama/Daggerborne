/* rollService — moteur de dés 3D global (@3d-dice/dice-box).
   Tous les jets de l'application passent par ici : traits, Expériences,
   attaques d'armes, dégâts, Dualité (Espoir + Peur) et lanceur flottant.

   - Canvas 3D en overlay plein écran, pointer-events:none au repos.
   - Dualité : 2 dés lancés séparément → d12 doré (Espoir) + d12 indigo (Peur).
   - Dés standards : thème « nebula-gold » (marbré violet/indigo/bleu, chiffres dorés).
   - Bannière de résultat interactive : statut, gain d'Espoir, enchaînement dégâts. */

import { $, el, esc, getState, setState, saveChar, getChar } from './core.js';

let diceBox = null;
let initPromise = null;
let busy = false;               /* un jet à la fois */
let bannerEl = null;
let pendingDamage = null;       /* {charId, weaponUid} pour enchaîner attaque → dégâts */

/* ---------- initialisation paresseuse (au 1er jet) ---------- */
/* dice-box assemble ses URLs comme \`\${origin}\${assetPath}...\` côté Worker :
   il faut donc un « origin » = base du site (avec sous-chemin GitHub Pages éventuel)
   et un assetPath RELATIF (sans slash initial). */
function siteOrigin() {
  if (location.protocol === 'file:') return ''; /* APK/local : le worker résout relatif au document */
  return new URL('.', document.baseURI).href;
}
/* Échelle des dés : plus compacts qu'avant (v17 = 5-12 selon l'aspect, trop grand
   sur desktop). Cible : mobile < 768px → 4.5, tablette/desktop → 5.5. */
function diceScale() {
  return window.innerWidth < 768 ? 4.5 : 5.5;
}
async function ensureInit() {
  if (diceBox) return diceBox;
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import('./vendor/dice-box.es.min.js');
      const DiceBox = mod.default;
      diceBox = new DiceBox({
        assetPath: 'assets/dice-box/',
        origin: siteOrigin(),
        theme: 'nebula-gold',           /* thème par défaut : tous les jets hors Dualité */
        scale: diceScale(),
        gravity: 1.8,
        originX: 50, originY: 80,
        throwoutStrength: 1.6,
        sound: false,
        /* couleurs vives sur le fond sombre de l'app : lumière +, ombres plus douces */
        lightIntensity: 1.45,
        shadowTransparency: 0.45,
        preloadThemes: ['nebula-gold', 'hope', 'fear'],
      });
      await diceBox.init();
      /* le canvas .dice-box-canvas est stylé plein écran par app.css DÈS sa création
         (dice-box lit clientWidth/Height à l'init — un style après coup donnerait un
         monde physique de 300×150 et fausserait la lecture des faces).
         On force un resize au cas où la taille ait changé entre-temps, et on
         réapplique l'échelle (updateConfig recalcule le scaling des meshes). */
      window.dispatchEvent(new Event('resize'));
      return diceBox;
    })();
    initPromise.catch(() => { initPromise = null; });
  }
  return initPromise;
}

/* ---------- bannière de résultat ---------- */
function closeBanner() {
  bannerEl?.remove();
  bannerEl = null;
  /* pas de hide() ici : le cycle show/hide/clear casse la lecture des faces (dice-box #74) */
}

function showBanner(html, { onClick, buttons = [] }) {
  closeBanner();
  bannerEl = el(`<div class="d3d-banner" role="status">
    <div class="d3d-card">
      <div class="d3d-body">${html}</div>
      <div class="d3d-btns">${buttons.map(b => `<button class="d3d-btn ${b.cls || ''}" data-b="${b.id}">${b.label}</button>`).join('')}</div>
    </div>
  </div>`);
  document.body.appendChild(bannerEl);
  /* tap sur le fond ou sur la carte (hors boutons) → fermer + effacer les dés */
  bannerEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-b]')) return;
    try { diceBox?.clear(); } catch (err) { /* noop */ }
    closeBanner();
    onClick?.(null);
  });
  for (const b of buttons) {
    bannerEl.querySelector(`[data-b="${b.id}"]`)?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      b.action?.();
    });
  }
}

const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);

/* ---------- utilitaires ---------- */
const rng = (n) => 1 + Math.floor(Math.random() * n);
/* dice-box #74/#100 : la lecture de face échoue parfois (value 0, impossible pour un dé).
   Fallback : on tire la valeur localement — l'animation 3D reste visuelle, la valeur de jeu est juste. */
const safeValue = (r, sides) => (Number.isInteger(r?.value) && r.value >= 1 && r.value <= sides ? r.value : rng(sides));

/* ---------- jet de Dualité : 2d12 Espoir + Peur, avec modificateur ---------- */
async function rollDuality({ mod = 0, label = '', charId = null, weaponUid = null }) {
  if (busy) return null;
  busy = true;
  try {
    const db = await ensureInit();
    /* les deux dés avec leur thème propre + teinte themeColor :
       d12 « hope » doré lumineux #fbbf24 (chiffres blancs peints dans la texture)
       + d12 « fear » indigo profond #5b21b6 (chiffres blancs peints). Les deux
       thèmes partagent les masques de chiffres HD du thème default. */
    const rolls = await db.roll([
      { sides: 12, qty: 1, theme: 'hope', themeColor: '#fbbf24' },
      { sides: 12, qty: 1, theme: 'fear', themeColor: '#5b21b6' },
    ]);
    const hope = safeValue(rolls[0], 12);
    const fear = safeValue(rolls[1], 12);
    const total = hope + fear + mod;
    const result = hope === fear ? 'crit' : hope > fear ? 'hope' : 'fear';
    const word = result === 'crit' ? '★ Succès Critique !' : result === 'hope' ? 'Avec Espoir' : 'Avec Peur';

    /* effets de jeu : gain d'Espoir / Peur du MJ (via core.dualityRoll côté données) */
    const rec = { hope, fear, mod, total, result, label };
    if (charId) {
      const c = getChar(charId);
      if (c) {
        if (result === 'hope' || result === 'crit') c.hope.current = Math.min(c.hope.max, c.hope.current + 1);
        if (result === 'crit') c.stress.current = Math.max(0, c.stress.current - 1);
        if (result === 'fear') setState(s => { s.fear = Math.min(30, s.fear + 1); });
        saveChar(c);
      }
    } else if (result === 'fear') {
      setState(s => { s.fear = Math.min(30, s.fear + 1); });
    }

    /* historique de session */
    setState(s => {
      s.rolls.unshift({ id: 'r' + Date.now(), t: Date.now(), hope, fear, mod, total, result, label: label || 'Jet de Dualité', charName: charId ? getChar(charId)?.name : null });
      s.rolls = s.rolls.slice(0, 60);
    });

    /* bannière interactive */
    const modTxt = mod ? ` ${fmt(mod)} (${label})` : (label ? ` (${label})` : '');
    pendingDamage = (charId && weaponUid) ? { charId, weaponUid } : null;
    showBanner(`
      <div class="d3d-dice"><span class="d3d-die hope">${hope}</span><span class="d3d-die fear">${fear}</span></div>
      <div class="d3d-total">${total}</div>
      <div class="d3d-status ${result}">${word}</div>
      <div class="d3d-detail">Espoir ${hope} · Peur ${fear}${modTxt} = ${total}</div>`,
      {
        buttons: [
          ...(result === 'hope' || result === 'crit'
            ? [{ id: 'gain', label: '✦ +1 Espoir appliqué', cls: 'ghost', action: () => { try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); } }]
            : []),
          ...(pendingDamage
            ? [{ id: 'dmg', label: `🎲 Jet de dégâts →`, cls: 'primary', action: () => { const pd = pendingDamage; pendingDamage = null; try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); rollDamage(pd.charId, pd.weaponUid); } }]
            : []),
          { id: 'close', label: 'Fermer', cls: 'ghost', action: () => { try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); } },
        ],
      });
    return rec;
  } catch (e) {
    console.error('rollDuality:', e);
    closeBanner();
    return null;
  } finally {
    busy = false;
  }
}

/* ---------- jet de dés standards (notation dn) — thème nebula-gold ---------- */
async function rollDice(notation, { label = '' } = {}) {
  if (busy) return null;
  busy = true;
  try {
    const db = await ensureInit();
    const rolls = await db.roll(notation);
    /* lecture sûre : fallback local si la physique n'a pas pu lire une face (dice-box #74) */
    const sidesOf = r => parseInt(r?.dieType?.replace('d', '') || (notation.match(/d(\d+)/) || [])[1] || '6', 10);
    const values = rolls.map(r => safeValue(r, sidesOf(r)));
    const total = values.reduce((a, b) => a + b, 0);
    setState(s => {
      s.rolls.unshift({ id: 'r' + Date.now(), t: Date.now(), notation, total, label: label || notation, hope: null, fear: null, result: 'plain' });
      s.rolls = s.rolls.slice(0, 60);
    });
    showBanner(`
      <div class="d3d-total">${total}</div>
      <div class="d3d-status plain">${esc(label || notation)}</div>
      <div class="d3d-detail">${esc(notation)} : ${values.join(' + ')} = ${total}</div>`,
      { buttons: [{ id: 'close', label: 'Fermer', cls: 'ghost', action: () => { try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); } }] });
    return { total, rolls: values };
  } catch (e) {
    console.error('rollDice:', e);
    closeBanner();
    return null;
  } finally {
    busy = false;
  }
}

/* ---------- jet de dégâts d'arme : Maîtrise × dé de l'arme + bonus ---------- */
export async function rollDamage(charId, weaponUid) {
  const c = getChar(charId);
  if (!c) return null;
  const w = c.weapons?.find(x => x.uid === weaponUid) || c.weapons?.find(x => x.primary);
  if (!w) return null;
  const n = c.proficiency;                                  /* Maîtrise */
  const face = parseInt((w.dice || 'd6').replace('d', ''), 10) || 6;
  const notation = `${n}d${face}`;
  return rollDice(notation, { label: `Dégâts — ${w.name}` });
}

/* ---------- jet d'attaque d'arme : Dualité + Trait de l'arme ---------- */
export async function rollAttack(charId, weaponUid) {
  const c = getChar(charId);
  if (!c) return null;
  const w = c.weapons?.find(x => x.uid === weaponUid);
  if (!w) return null;
  const mod = c.traits[w.trait] || 0;
  return rollDuality({
    mod,
    label: `${w.name} · ${w.trait ? (await traitLabel(w.trait)) : ''}`.trim(),
    charId, weaponUid,
  });
}
async function traitLabel(k) {
  /* T.traits est dans core.js ; import cyclique évité via import dynamique */
  const { T } = await import('./core.js');
  return T.traits[k] || k;
}

export { rollDuality, rollDice };
export function isRolling() { return busy; }
export function clear3d() { try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); }
