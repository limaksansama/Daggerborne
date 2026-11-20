/* Réglages + À propos */
import { $, $$, el, esc, go, data, getState, setState, toast } from '../core.js';

export async function render(main, params) {
  main.classList.remove('wide');
  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Réglages</h1>

    <div class="section-title" style="margin-top:0">Données</div>
    <div class="card">
      <p class="ch-desc" style="margin-bottom:.8rem">Vos personnages, jets et outils MJ sont stockés localement sur cet appareil (localStorage). Aucune donnée n'est envoyée en ligne.</p>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn ghost small" id="exp-all">⬆ Exporter tout (JSON)</button>
        <button class="btn ghost small" id="wipe">Effacer les jets</button>
        <button class="btn danger small" id="wipe-all">Tout effacer</button>
      </div>
    </div>

    <div class="section-title">À propos</div>
    <div class="card">
      <div class="about-logo-row">
        <img src="assets/icons/icon-192.png" alt="Daggervault">
        <div>
          <div style="font-family:var(--font-title);font-weight:800;color:var(--golden);font-size:1.15rem">Daggervault · Compagnon JDR</div>
          <div style="font-size:.78rem;color:var(--text-dim)">Application PWA non officielle — français</div>
        </div>
      </div>
      <div class="ms-body" style="font-size:.86rem;color:var(--text-dim);line-height:1.6">
        <p>Fiche de personnage numérique interactive <b>compatible avec Daggerheart™</b> : création guidée, dés de Dualité, compendium et outils du MJ. Fonctionne hors-ligne après le premier chargement, sur mobile et tablette.</p>
        <p style="margin-top:.6rem">Contenu en français issu du <b>Livre de règles Daggerheart</b> (traduction Black Book Éditions) pour le cœur des règles, et traductions amateurs pour le supplément <b>Hope &amp; Fear</b> (marqué « H&F »).</p>
      </div>
    </div>

    <div class="section-title">Crédits &amp; Licences</div>
    <!-- logo communautaire officiel DPCGL en tête de la section (section 2.5(b)) -->
    <div class="license-head">
      <img src="public/assets/dpcgl-community-logo.png" alt="Daggerheart Compatible">
    </div>
    <div class="license-box">
      <b>Attribution officielle — DPCGL 2.0</b><br>
      <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">This product includes materials from the Daggerheart System Reference Document 2.0, Critical Role, LLC. under the terms of the Darrington Press Community Gaming (DPCGL) License. More information can be found at https://www.daggerheart.com. This content has been translated into French and adapted for an interactive digital character sheet.</span>
    </div>
    <div class="license-box">
      <b>Mention légale du logo communautaire</b><br>
      <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">Darrington Press™ and the Darrington Press authorized work logo are trademarks of Critical Role, LLC and used with permission. Daggerheart™ Compatible. Terms at Daggerheart.com</span>
    </div>
    <div class="license-box">
      <b>Licence Open Source (code technique)</b><br>
      <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">Portions of the data architecture and system logic are adapted from the Foundryborne Daggerheart system, licensed under the MIT License (Copyright © Foundryborne contributors).</span>
      <span style="font-size:.78rem;color:var(--text-faint);display:inline-block;margin-top:.4rem">Texte complet : <a href="https://github.com/Foundryborne/daggerheart/blob/main/LICENSE" style="color:var(--golden)" target="_blank" rel="noopener">github.com/Foundryborne/daggerheart/LICENSE</a></span>
    </div>
    <div class="section-title" style="font-size:.9rem">Contributeurs du module (MIT)</div>
    <div class="credit-list">
      ${['WBHarry', 'Supe (CarlosFdez)', 'cptn-cosmo', 'Ikraik', 'IrkTheImp', 'jacobwojoski', 'moliloo', 'Mysteryusy', 'JimCanE', 'Po0lp', 'JoaquinP', '+ la communauté Foundryborne'].map(n => `<div class="cr"><span>${esc(n)}</span><span class="cr-role">Module Foundry</span></div>`).join('')}
    </div>
    <p class="ch-desc" style="font-size:.72rem;color:var(--text-faint);margin-top:.9rem;line-height:1.6">
      Application non officielle, sans affiliation avec Critical Role, Darrington Press, Black Book Éditions ni Foundry Gaming LLC. Créée pour un usage personnel et communautaire dans le respect des licences ci-dessus.
    </p>
  </div>`;

  $('#exp-all', main).addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'daggervault-sauvegarde.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#wipe', main).addEventListener('click', () => {
    setState(s => { s.rolls = []; });
    toast('Historique de jets effacé.');
  });
  $('#wipe-all', main).addEventListener('click', () => {
    if (!confirm('Effacer TOUS les personnages, jets et outils ? Irréversible.')) return;
    setState(s => { s.characters = []; s.rolls = []; s.fear = 0; s.countdowns = []; });
    toast('Données effacées.');
  });
}
