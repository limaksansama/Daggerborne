/* Liste des personnages */
import { $, $$, el, esc, go, data, getState, toast, uid, ensureCharacter } from '../core.js';

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
    <p class="page-sub">Chargez un personnage exporté au format JSON.</p>
    <button class="btn ghost" id="btn-import">⬇ Choisir un fichier…</button>
    <input type="file" id="file-import" accept="application/json" style="display:none">
  </div>`;

  const list = $('#list', main);
  if (!st.characters.length) {
    list.innerHTML = `<div class="empty"><div class="e-icon">✦</div><div class="e-title">Aucun personnage</div><div class="e-sub">Créez votre premier héros avec l'assistant guidé en 9 étapes.</div></div>`;
  } else {
    for (const c of [...st.characters].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const card = el(`<button class="char-card" data-id="${c.id}">
        <span class="ava">${esc((c.name || '?')[0].toUpperCase())}</span>
        <span class="cc-body">
          <span class="cc-name">${esc(c.name || 'Sans nom')}</span>
          <span class="cc-meta">
            <span>${esc(c.className || '')}</span>
            <span>Niv. ${c.level}</span>
            <span>${esc(c.ancestry?.fr || '')}</span>
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
  $('#file-import', main).addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj.name || !obj.traits) throw new Error('format');
        ensureCharacter(obj); /* complète les champs manquants (anciens exports) */
        import('../core.js').then(({ setState }) => {
          setState(s => {
            obj.id = uid();
            obj.updatedAt = Date.now();
            s.characters.push(obj);
          });
          toast(`« ${obj.name} » importé.`);
          render(main, params);
        });
      } catch (err) {
        toast('Fichier invalide : export de personnage attendu.');
      }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}
