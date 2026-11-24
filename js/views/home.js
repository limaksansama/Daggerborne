/* Home view */
import { $, $$, el, esc, go, T, data, getState, toast } from '../core.js';
import { t, isEN } from '../i18n.js';

export async function render(main, params) {
  const st = getState();
  const chars = st.characters;
  main.classList.remove('wide');

  const lastChar = chars.length ? [...chars].sort((a, b) => b.updatedAt - a.updatedAt)[0] : null;

  main.innerHTML = `
  <div class="view">
    <div class="hero">
      <h2>Daggerborne</h2>
      <span class="hero-badge">${t('compatBadge')}</span>
      <p>${t('homeHero')}</p>
      <div class="cta">
        <button class="btn" id="btn-new">${t('newCharacter')}</button>
        ${lastChar ? `<button class="btn ghost" id="btn-resume">${esc(lastChar.name || t('unnamed'))}</button>` : ''}
      </div>
    </div>

    ${chars.length ? `
    <div class="section-title">${t('homeYourChars')}</div>
    <div class="choice-grid" id="char-grid"></div>` : `
    <div class="empty">
      <div class="e-icon">🗡️</div>
      <div class="e-title">${t('noCharacter')}</div>
      <div class="e-sub">${t('homeEmptySub')}</div>
    </div>`}

    <div class="section-title">${t('homeQuickAccess')}</div>
    <div class="home-grid">
      <button class="home-tile" data-go="dice">
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".5"/></svg></span>
        <span class="tt">${t('homeDualityDice')}</span>
        <span class="td">${t('homeDiceDesc')}</span>
      </button>
      <button class="home-tile" data-go="compendium">
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2V5z"/><path d="M8 7h7M8 11h7"/></svg></span>
        <span class="tt">${t('compTitle')}</span>
        <span class="td">${t('homeCompendiumDesc')}</span>
      </button>
      <button class="home-tile" data-go="gm">
        <span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span>
        <span class="tt">${t('gmTitle')}</span>
        <span class="td">${t('homeGMDesc')}</span>
      </button>
      <button class="home-tile" data-go="settings">
        <span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z"/></svg></span>
        <span class="tt">${t('settingsTitle')}</span>
        <span class="td">${t('homeSettingsDesc')}</span>
      </button>
    </div>

    <!-- Pied de licence DPCGL 2.0 : logo communautaire officiel (fiole) + mention obligatoire -->
    <footer class="dpcgl-footer">
      <img src="assets/dpcgl-community-logo.png" alt="Daggerheart Compatible" class="dpcgl-logo">
      <p class="dpcgl-note">Daggerheart™ Compatible. Terms at Daggerheart.com</p>
    </footer>
  </div>`;

  if (chars.length) {
    const grid = $('#char-grid', main);
    const recent = [...chars].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
    const classes = recent.some(c => !c.className && c.classId) ? await data('classes') : [];
    for (const c of recent) {
      const cl = classes.find(x => x.id === c.classId);
      const card = el(`<button class="choice" data-char="${esc(c.id)}">
        <div class="ch-head"><span class="ch-name">${esc(c.name || t('unnamed'))}</span></div>
        <div class="ch-sub">${esc(c.ancestry?.fr || c.heritage || '')}${c.ancestry && c.community ? ' · ' : ''}${esc(c.community?.fr || '')}</div>
        <div class="ch-stats">
          <span class="stat-chip">${t('level')} <b>${c.level}</b></span>
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
