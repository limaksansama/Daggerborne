/* Dés de Dualité */
import { $, el, esc, T, data, toast, getState, getChar, saveChar, parseHash } from '../core.js';
import { equipmentPenalty } from '../rules.js';
import { rollDuality } from '../dice3d.js';

import { t, getLang } from '../i18n.js';
let ui = { mod: 0, adv: false, disadv: false, trait: null, expMod: 0, label: '', charId: null };

export async function render(main, params) {
  main.classList.remove('wide');
  if (params) ui.charId = params;
  const st = getState();
  const c = ui.charId ? getChar(ui.charId) : null;
  /* le personnage mémorisé a été supprimé : purge la sélection persistante */
  if (!c) { ui.charId = null; ui.trait = null; }

  let effTraits = c ? { ...c.traits } : null;
  let bfMeta = null;
  let gearPen = {};
  if (c) {
    const beastforms = c.beastform?.id ? await data('beastforms') : [];
    bfMeta = c.beastform?.id ? beastforms.find(b => b.id === c.beastform.id) : null;
    let bfTrait = bfMeta?.trait;
    let bfBonus = bfMeta?.traitBonus || 0;
    if (bfMeta && bfTrait === 'variable') {
      const baseBf = c.beastform?.baseId ? beastforms.find(b => b.id === c.beastform.baseId) : null;
      if (baseBf) {
        bfTrait = baseBf.trait;
        bfBonus += baseBf.traitBonus || 0;
      } else {
        bfTrait = Object.keys(c.traits || {}).reduce((best, k) => ((c.traits[k] || 0) > (c.traits[best] || 0) ? k : best), 'agility');
      }
    }
    gearPen = equipmentPenalty([
      c.armorCard?.feature,
      ...(c.weapons || []).filter(w => (w.state || 'active') === 'active').map(w => w.feature),
    ]);
    for (const k of Object.keys(T.traits)) {
      effTraits[k] = (c.traits[k] || 0) + (bfMeta && bfTrait === k ? bfBonus : 0) + (gearPen[k] || 0);
    }
  }

  const en = getLang() === 'en';
  const charOptNone = en ? '— Free roll (no character) —' : '— Jet libre (aucun personnage) —';

  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Dés de Dualité</h1>
    <p class="page-sub">${c ? `Jet pour <b style="color:var(--golden)">${esc(c.name)}</b> — ` : ''}Deux d12 : dé d'Espoir + dé de Peur. Espoir > Peur = jet avec Espoir ; mêmes résultats = succès critique.</p>

    <div class="dice-hero">
      <div class="duality-pair">
        <div class="die-big hope" id="die-hope"><span class="lbl">Espoir d12</span><span class="val" id="val-hope">—</span></div>
        <span class="duality-vs">+</span>
        <div class="die-big fear" id="die-fear"><span class="lbl">Peur d12</span><span class="val" id="val-fear">—</span></div>
      </div>
      <div class="roll-result" id="roll-result"></div>
      <div class="roll-controls">
        ${st.characters.length ? `<select id="roll-char" style="grid-column:1/-1;background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.55rem .6rem;font-weight:700">
          <option value="">${esc(charOptNone)}</option>
          ${st.characters.map(ch => `<option value="${esc(ch.id)}" ${ui.charId === ch.id ? 'selected' : ''}>${esc(ch.name || t('unnamed'))}${ch.level ? ` (${t('level')} ${ch.level})` : ''}</option>`).join('')}
        </select>` : ''}
        ${c ? `<select id="roll-trait" style="grid-column:1/-1;background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.6rem;font-weight:700">
          <option value="">— Trait (aucun) —</option>
          ${Object.entries(T.traits).map(([k, v]) => `<option value="${esc(k)}" ${ui.trait === k ? 'selected' : ''}>${esc(v)} ${effTraits[k] > 0 ? '+' : ''}${esc(effTraits[k])}</option>`).join('')}
          ${c.experiences.map((e, i) => ({ e, i })).filter(x => x.e.name && x.e.name.trim()).map(x => `<option value="exp${x.i}" ${ui.trait === `exp${x.i}` ? 'selected' : ''}>✦ ${esc(x.e.name)} (+${esc(x.e.mod)} · −1 ${en ? 'Hope' : 'Espoir'})</option>`).join('')}
        </select>` : ''}
        <button class="btn ghost ${ui.adv ? 'sel' : ''}" id="btn-adv">${t('sheetAdv6')}</button>
        <button class="btn ghost ${ui.disadv ? 'sel' : ''}" id="btn-disadv">${t('sheetDisadv6')}</button>
      </div>
      <button class="btn block" id="btn-roll" style="max-width:420px">${t('sheetRollDice')}</button>
    </div>

    <div class="section-title">Historique</div>
    <div class="hist" id="hist"></div>
  </div>`;

  const histEl = $('#hist', main);
  if (!st.rolls.length) {
    histEl.innerHTML = '<div class="empty"><div class="e-title">Aucun jet</div><div class="e-sub">Lancez vos Dés de Dualité (deux d12) : si votre dé d\'Espoir dépasse celui de la Peur, vous gagnez un Espoir.</div></div>';
  }
  for (const r of st.rolls.slice(0, 25)) {
    if (r.hope == null) {
      const notation = r.notation || 'Dés';
      histEl.appendChild(el(`<div class="hist-item">
        <span class="hi-out plain" title="${esc(notation)}">${esc(notation)}</span>
        <span class="hi-detail">${esc(r.label || 'Jet de dés')}</span>
        <span class="hi-total">${esc(r.total)}</span>
      </div>`));
      continue;
    }
    const cls = r.result === 'crit' ? 'crit' : (r.result === 'fear' ? 'fear' : 'hope');
    const label = r.result === 'crit' ? 'Critique' : r.result === 'hope' ? 'Espoir' : 'Peur';
    histEl.appendChild(el(`<div class="hist-item">
      <span class="hi-out ${cls}">${esc(label)}</span>
      <span class="hi-detail">${esc(r.label || 'Jet')}${r.difficulty ? ` (Diff. ${esc(r.difficulty)}${r.success !== undefined ? (r.success ? ' ✓' : ' ✗') : ''})` : ''} · Espoir d12:${esc(r.hope)} Peur d12:${esc(r.fear)}${r.mod ? ` mod:${r.mod > 0 ? '+' : ''}${esc(r.mod)}` : ''}${r.adv ? ` avantage d6:+${esc(r.adv)}` : ''}${r.dis ? ` désavantage d6:−${esc(r.dis)}` : ''}</span>
      <span class="hi-total">${esc(r.total)}</span>
    </div>`));
  }

  const setSel = (btn, on) => { btn.classList.toggle('sel', on); };
  $('#roll-char', main)?.addEventListener('change', (e) => {
    ui.charId = e.target.value || null;
    ui.trait = null;
    render(main, null);
  });
  $('#btn-adv', main).addEventListener('click', () => {
    ui.adv = !ui.adv; if (ui.adv) ui.disadv = false;
    setSel($('#btn-adv', main), ui.adv); setSel($('#btn-disadv', main), ui.disadv);
  });
  $('#btn-disadv', main).addEventListener('click', () => {
    ui.disadv = !ui.disadv; if (ui.disadv) ui.adv = false;
    setSel($('#btn-adv', main), ui.adv); setSel($('#btn-disadv', main), ui.disadv);
  });
  $('#roll-trait', main)?.addEventListener('change', (e) => { ui.trait = e.target.value || null; });

  const btnRoll = $('#btn-roll', main);
  btnRoll.addEventListener('click', async () => {
    /* anti double-clic : verrou pendant l'animation 3D */
    if (btnRoll.dataset.rolling === '1') return;
    btnRoll.dataset.rolling = '1';
    btnRoll.disabled = true;
    const unlock = () => { btnRoll.dataset.rolling = ''; btnRoll.disabled = false; };

    let mod = 0;
    let label = 'Jet d\'action';
    let spentHope = false;
    let prevHope = c?.hope?.current ?? 0;
    if (ui.trait?.startsWith('exp')) {
      if (!c) { ui.trait = null; unlock(); return; }
      const e = c.experiences[+ui.trait.slice(3)];
      if (!e) { ui.trait = null; unlock(); return; }
      if ((c.hope?.current || 0) < 1) {
        toast(en ? 'Not enough Hope to use this Experience.' : "Pas assez d'Espoir pour utiliser cette Expérience.");
        unlock();
        return;
      }
      prevHope = c.hope.current;
      c.hope.current -= 1;
      saveChar(c);
      spentHope = true;
      mod += e.mod; label = `✦ ${e.name}`;
    } else if (ui.trait && c) {
      mod += effTraits[ui.trait] ?? c.traits[ui.trait]; label = `Jet de ${T.traits[ui.trait]}`;
    }

    /* UNIFICATION : jet de Dualité 3D (avec d6 3D avantage/désavantage si actif) */
    const r = await rollDuality({
      mod,
      label,
      charId: c ? c.id : null,
      advantage: ui.adv,
      disadvantage: ui.disadv,
    });
    unlock();
    if (!r) {
      if (spentHope && c) { c.hope.current = prevHope; saveChar(c); }
      return;
    }
    if (parseHash().path !== 'dice') return;
    render(main, params).then(() => {
      if (parseHash().path !== 'dice') return;
      const res = $('#roll-result', main);
      if (res) {
        const cls = r.result === 'crit' ? 'crit' : r.result;
        const word = r.result === 'crit' ? '★ Succès critique' : r.result === 'hope' ? 'Avec Espoir' : 'Avec Peur';
        res.innerHTML = `
          <span class="total">${r.total}</span>
          <span class="outcome ${cls}">${word}</span>
          ${r.adv ? `<span class="stat-chip">+${r.adv} Avantage</span>` : ''}
          ${r.dis ? `<span class="stat-chip">−${r.dis} Désavantage</span>` : ''}`;
        $('#val-hope', main).textContent = r.hope;
        $('#val-fear', main).textContent = r.fear;
      }
    });
  });
}
