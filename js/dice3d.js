/* rollService — moteur de dés 3D global (@3d-dice/dice-box).
   Tous les jets de l'application passent par ici : traits, Expériences,
   attaques d'armes, dégâts, Dualité (Espoir + Peur) et lanceur flottant.

   - Canvas 3D en overlay plein écran, pointer-events:none au repos.
   - Dualité : 2 dés lancés séparément → d12 doré (Espoir) + d12 indigo (Peur).
   - Dés standards : thème « nebula-gold-v2 » (marbré violet/indigo/bleu, chiffres dorés).
   - Bannière de résultat interactive : statut, gain d'Espoir, enchaînement dégâts. */

import { $, el, esc, getState, setState, saveChar, getChar } from './core.js';
import { calcDamageSpec } from './rules.js';

import { t } from './i18n.js';
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
        theme: 'nebula-gold-v2',           /* thème par défaut : tous les jets hors Dualité */
        scale: diceScale(),
        gravity: 1.8,
        originX: 50, originY: 80,
        throwoutStrength: 1.6,
        sound: false,
        /* couleurs vives sur le fond sombre de l'app : lumière +, ombres plus douces */
        lightIntensity: 1.45,
        shadowTransparency: 0.45,
        preloadThemes: ['nebula-gold-v2', 'hope-v2', 'fear-v2'],
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
      <div class="d3d-btns">${buttons.map(b => `<button class="d3d-btn ${esc(b.cls || '')}" data-b="${esc(b.id)}">${esc(b.label)}</button>`).join('')}</div>
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

/* ---------- jet de Dualité : 2d12 Espoir + Peur (+ d6 avantage/désavantage optionnel) ---------- */
async function rollDuality({ mod = 0, label = '', charId = null, weaponUid = null, customDamage = null, advantage = false, disadvantage = false }) {
  if (busy) return null;
  busy = true;
  try {
    const hasAdvDis = Boolean(advantage ^ disadvantage);
    const use3d = getState().settings?.diceAnim !== false;
    let hope, fear, advVal = 0, disVal = 0;
    if (use3d) {
      try {
        const db = await ensureInit();
        const diceReq = [
          { sides: 12, qty: 1, theme: 'hope-v2' },
          { sides: 12, qty: 1, theme: 'fear-v2' },
        ];
        if (hasAdvDis) diceReq.push({ sides: 6, qty: 1, theme: 'nebula-gold-v2' });
        const rolls = await db.roll(diceReq);
        hope = safeValue(rolls[0], 12);
        fear = safeValue(rolls[1], 12);
        advVal = (hasAdvDis && advantage) ? safeValue(rolls[2], 6) : 0;
        disVal = (hasAdvDis && disadvantage) ? safeValue(rolls[2], 6) : 0;
      } catch (err3d) {
        console.warn('rollDuality 3D fallback:', err3d);
        hope = rng(12);
        fear = rng(12);
        advVal = (hasAdvDis && advantage) ? rng(6) : 0;
        disVal = (hasAdvDis && disadvantage) ? rng(6) : 0;
      }
    } else {
      hope = rng(12);
      fear = rng(12);
      advVal = (hasAdvDis && advantage) ? rng(6) : 0;
      disVal = (hasAdvDis && disadvantage) ? rng(6) : 0;
    }
    const total = hope + fear + mod + advVal - disVal;
    const result = hope === fear ? 'crit' : hope > fear ? 'hope' : 'fear';
    const word = result === 'crit' ? '★ Succès Critique !' : result === 'hope' ? 'Avec Espoir' : 'Avec Peur';

    /* effets de jeu + historique en une seule écriture atomique */
    let stressCleared = false;
    const rec = { hope, fear, mod, adv: advVal || null, dis: disVal || null, total, result, label };
    const fullLabel = `${label || 'Jet de Dualité'}${advVal ? ` · ▲ Avantage +${advVal}` : ''}${disVal ? ` · ▼ Désavantage −${disVal}` : ''}`;
    const c = charId ? getChar(charId) : null;
    if (c) {
      const effHopeMax = Math.max(0, (c.hope.max || 6) - (c.scars || 0));
      if (result === 'hope' || result === 'crit') c.hope.current = Math.min(effHopeMax, c.hope.current + 1);
      if (result === 'crit' && c.stress.current > 0) {
        c.stress.current = Math.max(0, c.stress.current - 1);
        stressCleared = true;
      }
      c.updatedAt = Date.now();
    }
    setState(s => {
      if (result === 'fear') s.fear = Math.min(30, s.fear + 1);
      s.rolls.unshift({ id: 'r' + Date.now(), t: Date.now(), hope, fear, mod, adv: advVal || null, dis: disVal || null, total, result, label: fullLabel, charName: c ? c.name : null });
      s.rolls = s.rolls.slice(0, 60);
    });

    /* bannière interactive */
    const modTxt = mod ? ` ${fmt(mod)} (${esc(label)})` : (label ? ` (${esc(label)})` : '');
    const advTxt = advVal ? ` + ${advVal} (Avantage)` : disVal ? ` − ${disVal} (Désavantage)` : '';
    const critSummary = result === 'crit'
      ? '<div class="d3d-detail" style="color:#fde68a;margin-top:4px">' + t('d3dAutoSuccess') + '</div>'
      : '';
    pendingDamage = (charId && (weaponUid || customDamage))
      ? { charId, weaponUid, customDamage, crit: result === 'crit' }
      : null;

    const gainLabel = result === 'crit'
      ? (charId ? (stressCleared ? '✦ +1 Espoir · −1 Stress appliqués' : '✦ +1 Espoir appliqué (Stress déjà à 0)') : '✦ Critique : réussite auto · +1 Espoir · −1 Stress')
      : '✦ +1 Espoir appliqué';

    showBanner(`
      <div class="d3d-dice"><span class="d3d-die hope">${hope}</span><span class="d3d-die fear">${fear}</span>${advVal ? `<span class="d3d-die" title="${t('d3dAdv')}">+${advVal}</span>` : ''}${disVal ? `<span class="d3d-die" title="${t('d3dDisadv')}">−${disVal}</span>` : ''}</div>
      <div class="d3d-total">${total}</div>
      <div class="d3d-status ${result}">${word}</div>
      <div class="d3d-detail">Espoir ${hope} · Peur ${fear}${modTxt}${advTxt} = ${total}</div>
      ${critSummary}`,
      {
        buttons: [
          ...(result === 'hope' || result === 'crit'
            ? [{ id: 'gain', label: gainLabel, cls: 'ghost', action: () => { try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); } }]
            : []),
          ...(pendingDamage
            ? [{
                id: 'dmg',
                label: pendingDamage.crit ? '💥 Dégâts critiques →' : '🎲 Jet de dégâts →',
                cls: 'primary',
                action: () => {
                  const pd = pendingDamage;
                  pendingDamage = null;
                  try { diceBox?.clear(); } catch (e) { /* noop */ }
                  closeBanner();
                  if (pd.weaponUid) rollDamage(pd.charId, pd.weaponUid, { crit: pd.crit });
                  else if (pd.customDamage) rollCustomDamage({ ...pd.customDamage, crit: pd.crit });
                },
              }]
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

/* ---------- parseur multi-dés (ex. "1d8 + 2d6 + 3") ---------- */
function parseMultiDice(notation) {
  const clean = String(notation || '1d6').replace(/\s+/g, '');
  const terms = clean.match(/[+-]?[^+-]+/g) || ['1d6'];
  const diceReqs = [];
  const expectedSides = [];
  let flatMod = 0;

  for (const term of terms) {
    const m = term.match(/^([+-]?)(\d*)d(\d+)$/i);
    if (m) {
      const sign = m[1] === '-' ? -1 : 1;
      const qty = Math.max(1, parseInt(m[2], 10) || 1);
      const sides = Math.max(2, parseInt(m[3], 10) || 6);
      diceReqs.push({ sides, qty, theme: 'nebula-gold-v2', _sign: sign });
      for (let i = 0; i < qty; i++) expectedSides.push({ sides, sign });
    } else if (/^[+-]?\d+$/.test(term)) {
      flatMod += parseInt(term, 10);
    }
  }
  if (!diceReqs.length) {
    diceReqs.push({ sides: 6, qty: 1, theme: 'nebula-gold-v2' });
    expectedSides.push({ sides: 6, sign: 1 });
  }
  return { clean, diceReqs, expectedSides, flatMod };
}

/* ---------- jet de dés standards (notation multi-dés ex: 1d8+2d6+3) — thème nebula-gold-v2 ---------- */
async function rollDice(notation, { label = '', critInfo = null } = {}) {
  if (busy) return null;
  busy = true;
  try {
    const { clean, diceReqs, expectedSides, flatMod } = parseMultiDice(notation);
    const dbPayload = diceReqs.map(({ sides, qty, theme }) => ({ sides, qty, theme }));
    const use3d = getState().settings?.diceAnim !== false;
    let rolls = [];
    if (use3d) {
      try {
        const db = await ensureInit();
        rolls = await db.roll(dbPayload);
      } catch (err3d) {
        console.warn('rollDice 3D fallback:', err3d);
        rolls = [];
      }
    }
    /* lecture sûre par dé : fallback local aux faces exactes du dé concerné (dice-box #74) */
    const values = [];
    let diceSum = 0;
    const count = Math.max(rolls.length, expectedSides.length);
    for (let i = 0; i < count; i++) {
      const r = rolls[i];
      const exp = expectedSides[i] || expectedSides[0] || { sides: 6, sign: 1 };
      const sides = parseInt(String(r?.dieType || '').replace('d', '') || r?.sides || exp.sides, 10) || exp.sides;
      const v = r ? safeValue(r, sides) : rng(sides);
      values.push(exp.sign < 0 ? -v : v);
      diceSum += exp.sign < 0 ? -v : v;
    }
    const total = diceSum + flatMod;
    const modTxt = flatMod ? ` (${flatMod > 0 ? '+' + flatMod : flatMod})` : '';
    const detailHtml = critInfo
      ? `Max ${critInfo.critMax} (${esc(critInfo.diceOnly)}) + [${values.join(' + ')}]${critInfo.flatBonus ? (critInfo.flatBonus > 0 ? ' + ' + critInfo.flatBonus : ' − ' + Math.abs(critInfo.flatBonus)) : ''} = ${total}`
      : `${esc(clean)} : ${values.join(' + ')}${modTxt} = ${total}`;
    const statusCls = critInfo ? 'crit' : 'plain';
    setState(s => {
      s.rolls.unshift({ id: 'r' + Date.now(), t: Date.now(), notation: clean, total, label: label || clean, hope: null, fear: null, result: 'plain' });
      s.rolls = s.rolls.slice(0, 60);
    });
    showBanner(`
      <div class="d3d-total">${total}</div>
      <div class="d3d-status ${statusCls}">${esc(label || clean)}</div>
      <div class="d3d-detail">${detailHtml}</div>`,
      { buttons: [{ id: 'close', label: 'Fermer', cls: 'ghost', action: () => { try { diceBox?.clear(); } catch (e) { /* noop */ } closeBanner(); } }] });
    return { total, rolls: values, mod: flatMod, critMax: critInfo?.critMax || 0 };
  } catch (e) {
    console.error('rollDice:', e);
    closeBanner();
    return null;
  } finally {
    busy = false;
  }
}

/* ---------- jet de dégâts générique (arme, Forme bestiale, Compagnon) avec support Critique SRD 2.0 ---------- */
export async function rollCustomDamage({ qty = 1, dice = 'd6', bonus = 0, label = t('sheetDamage'), crit = false } = {}) {
  const spec = calcDamageSpec(qty, dice, bonus, { crit });
  if (spec.crit) {
    return rollDice(spec.fullNotation, {
      label: `💥 Critique — ${label}`,
      critInfo: { critMax: spec.critMax, diceOnly: spec.diceOnlyNotation, flatBonus: spec.flatBonus },
    });
  }
  return rollDice(spec.normalNotation, { label });
}

/* ---------- jet de dégâts d'arme : Maîtrise × dé de l'arme + bonus (+ max des dés sur Critique) ---------- */
export async function rollDamage(charId, weaponUid, { crit = false } = {}) {
  const c = getChar(charId);
  if (!c) return null;
  const w = c.weapons?.find(x => x.uid === weaponUid) || c.weapons?.find(x => x.primary);
  if (!w) return null;
  return rollCustomDamage({
    qty: c.proficiency,
    dice: w.dice || 'd6',
    bonus: w.dmgBonus || 0,
    label: `Dégâts — ${w.name}`,
    crit,
  });
}

/* ---------- jet d'attaque d'arme : Dualité + Trait de l'arme ---------- */
export async function rollAttack(charId, weaponUid, opts = {}) {
  const c = getChar(charId);
  if (!c) return null;
  const w = c.weapons?.find(x => x.uid === weaponUid);
  if (!w) return null;
  const baseMod = c.traits[w.trait] || 0;
  const extraMod = parseInt(opts.extraMod, 10) || 0;
  const extraTxt = opts.extraLabel ? ` + ${opts.extraLabel}` : '';
  return rollDuality({
    mod: baseMod + extraMod,
    label: `${w.name} · ${w.trait ? (await traitLabel(w.trait)) : ''}${extraTxt}`.trim(),
    charId, weaponUid,
    advantage: !!opts.advantage,
    disadvantage: !!opts.disadvantage,
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
