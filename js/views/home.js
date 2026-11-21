/* Home view */
import { $, $$, el, esc, go, T, data, getState, toast } from '../core.js';

export async function render(main, params) {
  const st = getState();
  const chars = st.characters;
  main.classList.remove('wide');

  const lastChar = chars.length ? [...chars].sort((a, b) => b.updatedAt - a.updatedAt)[0] : null;

  main.innerHTML = `
  <div class="view">
    <div class="hero">
      <h2>Daggerborne</h2>
      <span class="hero-badge">Compatible avec Daggerheart™</span>
      <p>Compagnon JDR : créez vos personnages pas à pas, lancez les Dés de Dualité et explorez le compendium en français.</p>
      <div class="cta">
        <button class="btn" id="btn-new">✦ Nouveau personnage</button>
        ${lastChar ? `<button class="btn ghost" id="btn-resume">${esc(lastChar.name || 'Sans nom')}</button>` : ''}
      </div>
    </div>

    ${chars.length ? `
    <div class="section-title">Vos personnages</div>
    <div class="choice-grid" id="char-grid"></div>` : `
    <div class="empty">
      <div class="e-icon">🗡️</div>
      <div class="e-title">Aucun personnage</div>
      <div class="e-sub">Lancez la création guidée en 9 étapes : classe, sous-classe, ascendance, communauté, traits, équipement, expériences et liens.</div>
    </div>`}

    <div class="section-title">Accès rapide</div>
    <div class="home-grid">
      <button class="home-tile" data-go="dice">
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".5"/></svg></span>
        <span class="tt">Dés de Dualité</span>
        <span class="td">deux d12 (Espoir + Peur), avantages et historique.</span>
      </button>
      <button class="home-tile" data-go="compendium">
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2V5z"/><path d="M8 7h7M8 11h7"/></svg></span>
        <span class="tt">Compendium</span>
        <span class="td">210 cartes de domaine, classes, ascendances, équipement…</span>
      </button>
      <button class="home-tile" data-go="gm">
        <span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span>
        <span class="tt">Outils du MJ</span>
        <span class="td">Pool de Peur, comptes à rebours, référence rapide.</span>
      </button>
      <button class="home-tile" data-go="settings">
        <span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z"/></svg></span>
        <span class="tt">Réglages</span>
        <span class="td">À propos, licences et crédits.</span>
      </button>
    </div>

    <!-- Pied de licence DPCGL 2.0 : logo communautaire officiel (fiole) + mention obligatoire -->
    <footer class="dpcgl-footer">
      <img src="public/assets/dpcgl-community-logo.png" alt="Daggerheart Compatible" class="dpcgl-logo">
      <p class="dpcgl-note">Daggerheart™ Compatible. Terms at Daggerheart.com</p>
    </footer>
  </div>`;

  if (chars.length) {
    const grid = $('#char-grid', main);
    const recent = [...chars].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
    const classes = recent.some(c => !c.className && c.classId) ? await data('classes') : [];
    for (const c of recent) {
      const cl = classes.find(x => x.id === c.classId);
      const card = el(`<button class="choice" data-char="${c.id}">
        <div class="ch-head"><span class="ch-name">${esc(c.name || 'Sans nom')}</span></div>
        <div class="ch-sub">${esc(c.ancestry?.fr || c.heritage || '')}${c.ancestry && c.community ? ' · ' : ''}${esc(c.community?.fr || '')}</div>
        <div class="ch-stats">
          <span class="stat-chip">Niv. <b>${c.level}</b></span>
          <span class="stat-chip">${esc(c.className || cl?.fr || '—')}</span>
          <span class="stat-chip">♥ <b>${c.hp.current}/${c.hp.max}</b></span>
          <span class="stat-chip">✦ <b>${c.hope.current}</b></span>
        </div>
      </button>`);
      card.addEventListener('click', () => go('sheet', c.id));
      grid.appendChild(card);
    }
  }

  $('#btn-new')?.addEventListener('click', () => go('create'));
  $('#btn-resume')?.addEventListener('click', () => lastChar && go('sheet', lastChar.id));
  $$('.home-tile', main).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
}
