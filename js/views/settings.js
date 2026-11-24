/* Réglages + Sauvegardes + Option Cloud Pro + À propos */
import {
  $$,
  $, esc, getState, setState, toast, confirmModal, exportJsonFile,
  importFullBackupFromText, openPasteJsonModal, getStorageInfo, cloudSync, MAX_BACKUP_IMPORT_BYTES,
} from '../core.js';
import { t, getLang } from '../i18n.js';

export async function render(main, params) {
  main.classList.remove('wide');
  const st = getState();
  const info = getStorageInfo();
  const cs = cloudSync.getStatus();

  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Réglages</h1>

    <div class="section-title" style="margin-top:0">Données &amp; Sauvegarde locale</div>
    <div class="card">
      <p class="ch-desc" style="margin-bottom:.6rem">
        Vos données sont enregistrées localement sur cet appareil (${info.idb ? 'IndexedDB haute capacité + repli localStorage' : 'localStorage'}) —
        <b>${info.chars}</b> personnage(s), <b>${info.rolls}</b> jet(s), <b>${info.kb} Ko</b> utilisés.
      </p>
      <div style="display:flex;gap:.55rem;flex-wrap:wrap">
        <button class="btn small" id="exp-all">⬆ Exporter tout (JSON)</button>
        <button class="btn ghost small" id="imp-all">⬇ Importer sauvegarde (fichier)</button>
        <button class="btn ghost small" id="imp-paste">📋 Coller une sauvegarde</button>
        <button class="btn ghost small" id="wipe">Effacer les jets</button>
        <button class="btn danger small" id="wipe-all">Tout effacer</button>
      </div>
      <input type="file" id="file-backup" accept=".json,application/json,text/plain" style="display:none">
    </div>

    <div class="section-title">${t('setSyncCloud')}</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem">
        <b style="color:var(--golden)">☁ Google Drive</b>
        <span class="tag">${esc(cs.tierLabel)}</span>
      </div>
      <p class="ch-desc">${esc(cs.summary)}</p>
    </div>

    <div class="section-title">${t('settingsLang')}</div>
    <div class="card">
      <p class="ch-desc" style="margin-bottom:.6rem">${t('settingsLangDesc')}</p>
      <div class="lang-select-row">
        <button class="lang-pill ${getLang() === 'fr' ? 'on' : ''}" data-lang="fr">🇫🇷 Français<small>Français — contenu du SRD 2.0 traduit</small></button>
        <button class="lang-pill ${getLang() === 'en' ? 'on' : ''}" data-lang="en">🇬🇧 English<small>English — official SRD 2.0 content</small></button>
      </div>
    </div>

    <div class="section-title">Règles &amp; Préférences</div>
    <div class="card" style="display:flex;flex-direction:column;gap:.75rem">
      <label style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;font-size:.86rem;color:var(--text-dim)">
        <input type="checkbox" id="opt-massive" ${st.settings?.massiveDamageRule ? 'checked' : ''} style="margin-top:.2rem;accent-color:var(--golden)">
        <span><b style="color:var(--text)">Dégâts Massifs (SRD 2.0, p. 50)</b><br>Si un personnage subit des dégâts ≥ 2 × son seuil Grave, il marque <b>4 PV</b> au lieu de 3.</span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;font-size:.86rem;color:var(--text-dim)">
        <input type="checkbox" id="opt-dice3d" ${st.settings?.diceAnim !== false ? 'checked' : ''} style="margin-top:.2rem;accent-color:var(--golden)">
        <span><b style="color:var(--text)">Animations des dés 3D</b><br>Affiche les lancers physiques 3D à l'écran (désactivez pour des jets instantanés sur tablette ancienne).</span>
      </label>
    </div>

    <div class="section-title">À propos</div>
    <div class="card">
      <div class="about-logo-row">
        <img src="assets/dpcgl-community-logo-light.png" alt="Daggerborne — Daggerheart Compatible">
        <div>
          <div style="font-family:var(--font-title);font-weight:800;color:var(--golden);font-size:1.15rem">${t('setCompanion')}</div>
          <div style="font-size:.78rem;color:var(--text-dim)">${t('setUnofficial')}</div>
        </div>
      </div>
      <div class="ms-body" style="font-size:.86rem;color:var(--text-dim);line-height:1.6">
        <p>Fiche de personnage numérique interactive <b>${t('setCompatible')}</b> : création guidée, dés de Dualité, compendium et outils du MJ. Fonctionne hors-ligne après le premier chargement, sur mobile et tablette.</p>
        ${getLang() === 'en'
          ? '<p style="margin-top:.6rem">English content based on the <b>official Daggerheart 2.0 SRD</b> (Darrington Press), with community translations for the <b>Hope &amp; Fear</b> supplement (marked “H&amp;F”).</p>'
          : `<p style="margin-top:.6rem">Contenu en français issu du <b>${t('setRuleBook')}</b> (traduction Black Book Éditions) pour le cœur des règles, et traductions amateurs pour le supplément <b>Hope &amp; Fear</b> (marqué « H&F »).</p>`}
      </div>
    </div>

    <div class="section-title">${t('setCredits')}</div>
    <div class="license-box">
      <b>${t('setDiceCredit')}</b><br>
      <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">${t('setDiceCreditDesc')} <a href="https://github.com/3d-dice/dice-box" style="color:var(--golden)" target="_blank" rel="noopener noreferrer">github.com/3d-dice/dice-box</a></span>
    </div>
    <div class="license-box">
      <b>Attribution officielle — DPCGL 2.0</b><br>
      <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">This product includes materials from the Daggerheart System Reference Document 2.0, Critical Role, LLC. under the terms of the Darrington Press Community Gaming (DPCGL) License. More information can be found at https://www.daggerheart.com. This content has been translated into French and adapted for an interactive digital character sheet.</span>
    </div>
    <div class="license-box">
      <div class="license-logo-row">
        <img src="assets/dpcgl-community-logo.png" alt="Daggerheart Compatible">
        <div>
          <b>${t('setCommunityLogo')}</b><br>
          <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">Darrington Press™ and the Darrington Press authorized work logo are trademarks of Critical Role, LLC and used with permission. Daggerheart™ Compatible. Terms at Daggerheart.com</span>
        </div>
      </div>
    </div>
    <div class="license-box">
      <b>Licence Open Source (code technique)</b><br>
      <span style="font-size:.8rem;color:var(--text-dim);line-height:1.6;display:inline-block;margin-top:.3rem">Portions of the data architecture and system logic are adapted from the Foundryborne Daggerheart system, licensed under the MIT License (Copyright © Foundryborne contributors).</span>
      <span style="font-size:.78rem;color:var(--text-faint);display:inline-block;margin-top:.4rem">Texte complet : <a href="https://github.com/Foundryborne/daggerheart/blob/main/LICENSE" style="color:var(--golden)" target="_blank" rel="noopener noreferrer">github.com/Foundryborne/daggerheart/LICENSE</a></span>
    </div>
    <div class="section-title" style="font-size:.9rem">Contributeurs du module (MIT)</div>
    <div class="credit-list">
      ${['WBHarry', 'Supe (CarlosFdez)', 'cptn-cosmo', 'Ikraik', 'IrkTheImp', 'jacobwojoski', 'moliloo', 'Mysteryusy', 'JimCanE', 'Po0lp', 'JoaquinP', '+ la communauté Foundryborne'].map(n => `<div class="cr"><span>${esc(n)}</span><span class="cr-role">Module Foundry</span></div>`).join('')}
    </div>
    <p class="ch-desc" style="font-size:.72rem;color:var(--text-faint);margin-top:.9rem;line-height:1.6">
      Application non officielle, sans affiliation avec Critical Role, Darrington Press, Black Book Éditions ni Foundry Gaming LLC. Créée pour un usage personnel et communautaire dans le respect des licences ci-dessus.
    </p>
  </div>`;

  const applyBackupText = async (rawText) => {
    const replace = await confirmModal(t('setImportConfirm'));
    if (!replace) return;
    try {
      const res = importFullBackupFromText(rawText, 'merge');
      toast(`Sauvegarde importée : ${res.added} ajouté(s), ${res.updated} mis à jour.`);
      render(main, params);
    } catch (err) {
      toast(err?.message || 'Fichier de sauvegarde invalide.');
    }
  };

  /* un seul écouteur : le doublon provoquait deux rendus par clic */
  $$('[data-lang]', main).forEach(b => b.addEventListener('click', () => {
    const l = b.dataset.lang;
    if (l !== getLang()) {
      /* app.js reconstruit le shell et re-rend la vue dans la nouvelle langue */
      window.dispatchEvent(new CustomEvent('dh:langchange', { detail: { lang: l } }));
    }
  }));
  $('#exp-all', main).addEventListener('click', () => {
    exportJsonFile('daggerborne-sauvegarde.json', cloudSync.exportPayload(), 'Exporter toute la sauvegarde');
  });
  $('#imp-all', main).addEventListener('click', () => $('#file-backup', main).click());
  $('#file-backup', main).addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_BACKUP_IMPORT_BYTES) {
      toast('Sauvegarde trop volumineuse (max 10 Mo).');
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      try { applyBackupText(rd.result); }
      catch (err) { toast(err?.message || 'Fichier de sauvegarde invalide.'); }
    };
    rd.readAsText(f);
  });
  $('#imp-paste', main).addEventListener('click', () => {
    openPasteJsonModal({
      title: 'Importer une sauvegarde complète (JSON)',
      onImport: (raw, close) => {
        const res = importFullBackupFromText(raw, 'merge');
        close();
        toast(`Sauvegarde importée : ${res.added} ajouté(s), ${res.updated} mis à jour.`);
        render(main, params);
      },
    });
  });
  $('#opt-massive', main).addEventListener('change', (e) => {
    setState(s => { s.settings = s.settings || {}; s.settings.massiveDamageRule = e.target.checked; });
    toast(e.target.checked ? 'Règle Dégâts Massifs activée.' : 'Règle Dégâts Massifs désactivée.');
  });
  $('#opt-dice3d', main).addEventListener('change', (e) => {
    setState(s => { s.settings = s.settings || {}; s.settings.diceAnim = e.target.checked; });
    toast(e.target.checked ? 'Dés 3D activés.' : 'Dés 3D désactivés (jets instantanés).');
  });
  $('#wipe', main).addEventListener('click', () => {
    setState(s => { s.rolls = []; });
    toast(t('setRollsCleared'));
    render(main, params);
  });
  $('#wipe-all', main).addEventListener('click', async () => {
    if (!await confirmModal(t('setWipeConfirm'), { danger: true })) return;
    setState(s => { s.characters = []; s.rolls = []; s.fear = 0; s.countdowns = []; s.encounter = { pcCount: 4, adj: {}, active: [], environmentId: null }; });
    toast(t('setWiped'));
    render(main, params);
  });
}
