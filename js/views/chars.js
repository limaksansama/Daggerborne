/* Liste des personnages */
import { $, $$, el, esc, go, getState, toast, importCharacterFromText, openPasteJsonModal } from '../core.js';

export async function render(main, params) {
  main.classList.remove('wide');
  const st = getState();
  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">Personnages</h1>
    <p class="page-sub">${st.characters.length} personnage${st.characters.length > 1 ? 's' : ''} enregistré${st.characters.length > 1 ? 's' : ''} sur cet appareil.</p>
    <button class="btn block" id="btn-new" style="max-width:420px">✦ Nouveau personnage</button>
    <div id="list" style="margin-top:1rem"></div>
    <div class="section-title">Importer</div>
    <p class="page-sub">Chargez un personnage exporté au format JSON (fichier ou texte collé).</p>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap">
      <button class="btn ghost" id="btn-import">⬇ Choisir un fichier…</button>
      <button class="btn ghost" id="btn-paste-import">📋 Coller un JSON</button>
    </div>
    <input type="file" id="file-import" accept=".json,application/json,text/plain" style="display:none">
  </div>`;

  const list = $('#list', main);
  if (!st.characters.length) {
    list.innerHTML = `<div class="empty"><div class="e-icon">✦</div><div class="e-title">Aucun personnage</div><div class="e-sub">Créez votre premier héros avec l'assistant guidé en 9 étapes.</div></div>`;
  } else {
    for (const c of [...st.characters].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const card = el(`<button class="char-card" data-id="${c.id}">
        <span class="ava">${c.portrait ? `<img src="${esc(c.portrait)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">` : esc((c.name || '?')[0].toUpperCase())}</span>
        <span class="cc-body">
          <span class="cc-name">${esc(c.name || 'Sans nom')}</span>
          <span class="cc-meta">
            <span>${esc(c.className || '')}</span>
            <span>Niv. ${c.level}</span>
            <span>${esc(c.heritage || c.ancestry?.fr || '')}</span>
          </span>
          <span class="cc-hp">♥ ${c.hp.current}/${c.hp.max} · ✦ ${c.hope.current} · Stress ${c.stress.current}/${c.stress.max}</span>
        </span>
      </button>`);
      card.addEventListener('click', () => go('sheet', c.id));
      list.appendChild(card);
    }
  }

  $('#btn-new', main).addEventListener('click', () => go('create'));
  $('#btn-import', main).addEventListener('click', () => $('#file-import', main).click());
  $('#btn-paste-import', main).addEventListener('click', () => {
    openPasteJsonModal({
      title: 'Importer un personnage (JSON)',
      onImport: (raw, close) => {
        const obj = importCharacterFromText(raw);
        close();
        toast(`« ${obj.name} » importé.`);
        render(main, params);
      },
    });
  });
  $('#file-import', main).addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = importCharacterFromText(rd.result);
        toast(`« ${obj.name} » importé.`);
        render(main, params);
      } catch (err) {
        toast('Fichier invalide : export de personnage attendu.');
      }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}
