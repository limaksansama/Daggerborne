/* Dés de Dualité */
import { $, el, esc, parseHash, T, getState, getChar } from '../core.js';
import { rollDuality } from '../dice3d.js';

import { t } from '../i18n.js';
let ui = { mod: 0, adv: false, disadv: false, trait: null, expMod: 0, label: '', charId: null };

export async function render(main, params) {
  main.classList.remove('wide');
  if (params) ui.charId = params;
  const st = getState();
  const c = ui.charId ? getChar(ui.charId) : null;
  /* le personnage mémorisé a été supprimé : purge la sélection persistante */
  if (!c) { ui.charId = null; ui.trait = null; }

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
        ${c ? `<select id="roll-trait" style="grid-column:1/-1;background:var(--panel-3);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:.6rem;font-weight:700">
          <option value="">— Trait (aucun) —</option>
          ${Object.entries(T.traits).map(([k, v]) => `<option value="${k}" ${ui.trait === k ? 'selected' : ''}>${v} ${c.traits[k] > 0 ? '+' : ''}${c.traits[k]}</option>`).join('')}
          ${c.experiences.map((e, i) => ({ e, i })).filter(x => x.e.name && x.e.name.trim()).map(x => `<option value="exp${x.i}" ${ui.trait === `exp${x.i}` ? 'selected' : ''}>✦ ${esc(x.e.name)} (+${x.e.mod})</option>`).join('')}
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
      histEl.appendChild(el(`<div class="hist-item">
        <span class="hi-out plain">${esc(r.notation || 'Dés')}</span>
        <span class="hi-detail">${esc(r.label || 'Jet de dés')}</span>
        <span class="hi-total">${r.total}</span>
      </div>`));
      continue;
    }
    const cls = r.result === 'crit' ? 'crit' : r.result;
    const label = r.result === 'crit' ? 'Critique' : r.result === 'hope' ? 'Espoir' : 'Peur';
    histEl.appendChild(el(`<div class="hist-item">
      <span class="hi-out ${cls}">${label}</span>
      <span class="hi-detail">${esc(r.label || 'Jet')}${r.difficulty ? ` (Diff. ${r.difficulty}${r.success !== undefined ? (r.success ? ' ✓' : ' ✗') : ''})` : ''} · Espoir d12:${r.hope} Peur d12:${r.fear}${r.mod ? ` mod:${r.mod > 0 ? '+' : ''}${r.mod}` : ''}${r.adv ? ` avantage d6:+${r.adv}` : ''}${r.dis ? ` désavantage d6:−${r.dis}` : ''}</span>
      <span class="hi-total">${r.total}</span>
    </div>`));
  }

  const setSel = (btn, on) => { btn.classList.toggle('sel', on); };
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
    if (ui.trait?.startsWith('exp')) {
      if (!c) { ui.trait = null; unlock(); return; }
      const e = c.experiences[+ui.trait.slice(3)];
      if (!e) { ui.trait = null; unlock(); return; }
      mod += e.mod; label = `✦ ${e.name}`;
    } else if (ui.trait && c) {
      mod += c.traits[ui.trait]; label = `Jet de ${T.traits[ui.trait]}`;
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
    if (!r || parseHash().path !== 'dice') return;
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
