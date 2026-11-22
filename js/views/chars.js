/* Liste des personnages */
import { $, $$, el, esc, go, getState, toast, data, importCharacterFromText, openPasteJsonModal } from '../core.js';
import { t } from '../i18n.js';

export async function render(main, params) {
  main.classList.remove('wide');
  const st = getState();
  main.innerHTML = `
  <div class="view">
    <h1 class="page-title">${t('charsTitle')}</h1>
    <p class="page-sub">${st.characters.length} ${t('charsCount')}</p>
    <button class="btn block" id="btn-new" style="max-width:420px">${t('newCharacter')}</button>
    <div id="list" style="margin-top:1rem"></div>
    <div class="section-title">${t('charsImport')}</div>
    <p class="page-sub">${t('charsImportSub')}</p>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap">
      <button class="btn ghost" id="btn-import">${t('charsChooseFile')}</button>
      <button class="btn ghost" id="btn-paste-import">${t('charsPasteJson')}</button>
    </div>
    <input type="file" id="file-import" accept=".json,application/json,text/plain" style="display:none">
  </div>`;

  const list = $('#list', main);
  if (!st.characters.length) {
    list.innerHTML = `<div class="empty"><div class="e-icon">✦</div><div class="e-title">${t('noCharacter')}</div><div class="e-sub">${t('charsEmptySub')}</div></div>`;
  } else {
    const needsClassLookup = st.characters.some(c => !c.className && c.classId);
    const classes = needsClassLookup ? await data('classes') : [];
    for (const c of [...st.characters].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const clsName = c.className || classes.find(x => x.id === c.classId)?.fr || '';
      const card = el(`<button class="char-card" data-id="${c.id}">
        <span class="ava">${c.portrait ? `<img src="${esc(c.portrait)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">` : esc((c.name || '?')[0].toUpperCase())}</span>
        <span class="cc-body">
          <span class="cc-name">${esc(c.name || t('unnamed'))}</span>
          <span class="cc-meta">
            <span>${esc(clsName)}</span>
            <span>${t('level')} ${c.level}</span>
            <span>${esc(c.heritage || c.ancestry?.fr || '')}</span>
          </span>
          <span class="cc-hp">♥ ${c.hp.current}/${c.hp.max} · ✦ ${c.hope.current} · ${t('stress')} ${c.stress.current}/${c.stress.max}</span>
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
      title: t('charsImportTitle'),
      onImport: (raw, close) => {
        const obj = importCharacterFromText(raw);
        close();
        toast(`« ${obj.name} » ${t('charsImported')}`);
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
        toast(`« ${obj.name} » ${t('charsImported')}`);
        render(main, params);
      } catch (err) {
        toast(t('charsInvalidFile'));
      }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}
