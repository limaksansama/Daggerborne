/* Fiche de personnage — placement calqué sur la feuille officielle Daggerheart :
   en-tête identité + badge Niveau · bande Évasion/Armure + 6 cartes de traits ·
   2 colonnes (Dégâts&Santé/Espoir/Expériences/Or/Aptitude || Armes/Armure/Inventaire).
   Thème sombre conservé, mobile = onglets Combat / Stats / Équipement / Plus. */
import { $, $$, el, esc, go, T, data, toast, getChar, saveChar, setState, uid, rollD, ensureCharacter } from '../core.js';
import { rollDuality, rollDice, rollAttack, rollDamage } from '../dice3d.js';
import { openLevelUp } from './levelup.js';

const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const MORE_TABS = [
  { id: 'cards', label: 'Cartes' },
  { id: 'features', label: 'Aptitudes' },
  { id: 'background', label: 'Background' },
  { id: 'journal', label: 'Journal' },
];
const MTABS = [
  { id: 'combat', label: 'Combat' },
  { id: 'stats', label: 'Stats & Ressources' },
  { id: 'equip', label: 'Équipement' },
  { id: 'more', label: 'Plus' },
];
let ui = { mtab: 'combat', more: 'cards' };

/* ============ migration vers le modèle « feuille officielle » ============ */
function migrate(c, weapons, armors, subclasses) {
  let dirty = false;
  /* undefined OU chaîne vide : les personnages créés avant le fix arrivaient avec
     heritage/subclassText définis mais vides (le wizard ne les remplissait pas) */
  if (!c.heritage && c.ancestry?.fr) { c.heritage = c.ancestry.fr; dirty = true; }
  if (!c.subclassText) {
    /* subclassName manque sur les très vieux personnages : retrouver via subclassId */
    const subName = c.subclassName
      || subclasses?.find(s => s.id === c.subclassId)?.fr || '';
    if (subName) { c.subclassText = subName; dirty = true; }
  }
  if (c.transformation === undefined) { c.transformation = ''; dirty = true; }
  if (!Array.isArray(c.experiences)) { c.experiences = []; dirty = true; }
  while (c.experiences.length < 5) { c.experiences.push({ name: '', mod: 2 }); dirty = true; }
  if (c.hp.active === undefined) { c.hp.active = c.hp.max || 6; c.hp.unlocked = 0; dirty = true; }
  if (c.stress.active === undefined) { c.stress.active = c.stress.max || 6; c.stress.unlocked = 0; dirty = true; }
  if (c.hope.max !== 6) { c.hope.max = 6; c.hope.current = Math.min(c.hope.current, 6); dirty = true; }
  if (c.hopeFeature === undefined) {
    c.hopeFeature = c.hopeAbility ? `✦ ${c.hopeAbility.name} — ${c.hopeAbility.desc}` : '';
    dirty = true;
  }
  if (c.classFeature === undefined) { c.classFeature = ''; dirty = true; }
  if (!Array.isArray(c.weapons)) {
    const mk = (id, extra) => {
      const w = weapons.find(x => x.id === id);
      if (!w) return null;
      return {
        uid: uid(), compendiumId: w.id, name: w.fr, trait: w.trait, range: w.range,
        dice: w.dice, dmgType: w.dmgType, feature: '',
        hands: w.burden === 'twoHanded' ? 'two' : 'one',
        state: 'active', primary: false, secondary: false, ...extra,
      };
    };
    c.weapons = [
      c.primaryWeaponId ? mk(c.primaryWeaponId, { primary: true }) : null,
      c.secondaryWeaponId ? mk(c.secondaryWeaponId, { secondary: true }) : null,
    ].filter(Boolean);
    dirty = true;
  }
  if (!c.thresholds || c.thresholds.bonus === undefined) {
    const oldBonus = (c.thresholds?.major ?? 0) - c.level - (c.armorCard?.baseMajor || 0);
    c.thresholds = { bonus: Number.isFinite(oldBonus) ? oldBonus : 0 };
    dirty = true;
  }
  if (!c.armorCard) {
    const ar = armors.find(a => a.id === c.armorId);
    c.armorCard = ar
      ? { compendiumId: ar.id, name: ar.fr, baseScore: ar.armorScore, baseMajor: ar.major, baseSevere: ar.severe, feature: '' }
      : { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' };
    dirty = true;
  }
  if (!c.armorSlots || c.armorSlots.max !== 12) {
    c.armorSlots = { max: 12, used: Math.min(c.armorSlots?.used || 0, 12) };
    dirty = true;
  }
  if (!c.goldTrack) { c.goldTrack = { handfuls: c.gold || 0, bags: 0, chests: 0 }; dirty = true; }
  if (c.traitMarks === undefined) { c.traitMarks = []; dirty = true; }
  if (c.subcardTaken === undefined) { c.subcardTaken = {}; dirty = true; }
  if (c.goldTrack.chests > 1) { c.goldTrack.bags += (c.goldTrack.chests - 1) * 10; c.goldTrack.chests = 1; dirty = true; }
  const hpMax = c.hp.active + c.hp.unlocked;
  if (c.hp.max !== hpMax) { c.hp.max = hpMax; c.hp.current = Math.min(c.hp.current, hpMax); dirty = true; }
  const stMax = c.stress.active + c.stress.unlocked;
  if (c.stress.max !== stMax) { c.stress.max = stMax; c.stress.current = Math.min(c.stress.current, stMax); dirty = true; }
  if (dirty) saveChar(c);
}

const thresholds = (c) => ({
  major: (c.armorCard.baseMajor || 0) + c.level + (c.thresholds.bonus || 0),
  severe: (c.armorCard.baseSevere || 0) + c.level + (c.thresholds.bonus || 0),
});
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const syncMaxes = (c) => {
  c.hp.max = c.hp.active + c.hp.unlocked;
  c.hp.current = Math.max(0, Math.min(c.hp.current, c.hp.max));
  c.stress.max = c.stress.active + c.stress.unlocked;
  c.stress.current = Math.max(0, Math.min(c.stress.current, c.stress.max));
};

/* ============================ RENDER ============================ */
export async function render(main, params) {
  main.classList.add('wide');
  const c = getChar(params);
  if (!c) { toast('Personnage introuvable'); go('chars'); return; }
  /* B15 : préserve le focus et la position de saisie à travers le re-render */
  const active = document.activeElement;
  const focusKey = active?.dataset?.f || active?.dataset?.ef || active?.dataset?.wf || active?.dataset?.af || null;
  const focusSel = focusKey ? `[data-f="${focusKey}"],[data-ef="${focusKey}"],[data-wf="${focusKey}"],[data-af="${focusKey}"]` : null;
  const scrollY = window.scrollY;
  const [classes, subclasses, weapons, armors, cards, domains, generalItems] = await Promise.all([
    data('classes'), data('subclasses'), data('weapons'), data('armors'), data('domainCards'), data('domains'), data('generalItems'),
  ]);
  migrate(c, weapons, armors, subclasses);
  const cl = classes.find(x => x.id === c.classId);
  const sub = subclasses.find(x => x.id === c.subclassId);
  const thr = thresholds(c);
  const gt = c.goldTrack;
  const goldTotal = gt.handfuls + gt.bags * 10 + gt.chests * 100;

  main.innerHTML = `
  <div class="view dh-sheet" data-mtab="${ui.mtab}">
    <!-- dégradés partagés des boucliers SVG -->
    <svg class="dh-svgdefs" aria-hidden="true">
      <defs>
        <linearGradient id="dhShieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2b2440"/><stop offset="1" stop-color="#1a1628"/>
        </linearGradient>
        <linearGradient id="dhAspipOff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#26223a"/><stop offset="1" stop-color="#1c192b"/>
        </linearGradient>
        <linearGradient id="dhAspipOn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#cdd9e6"/><stop offset="1" stop-color="#67788c"/>
        </linearGradient>
      </defs>
    </svg>

    <!-- ===== EN-TÊTE : bannière + identité + badge NIVEAU ===== -->
    <header class="dh-header">
      <div class="dh-brand" title="Classe principale"><span class="b1">${esc(c.className || 'Classe')}</span></div>
      <div class="dh-idfields">
        <label class="dh-idf w2"><span>Nom</span><input data-f="name" value="${esc(c.name)}" placeholder="Nom du personnage"></label>
        <label class="dh-idf"><span>Pronoms</span><input data-f="pronouns" value="${esc(c.pronouns)}" placeholder="iel · elle · il"></label>
        <label class="dh-idf w2"><span>Héritage</span><input data-f="heritage" value="${esc(c.heritage)}" placeholder="Ascendance / peuple"></label>
        <label class="dh-idf"><span>Sous-classe</span><input data-f="subclassText" value="${esc(c.subclassText)}" placeholder="${esc(sub?.fr || 'Sous-classe')}"></label>
        <label class="dh-idf w2"><span>Transformation (optionnelle)</span><input data-f="transformation" value="${esc(c.transformation || '')}" placeholder="Aucune · ex. Loup-garou, Vampire…" list="transf-list"></label>
        <datalist id="transf-list">${(await data('transformations')).map(t => `<option value="${esc(t.fr)}">`).join('')}</datalist>
      </div>
      <div class="dh-level" title="Niveau ${c.level} — les seuils de dégâts l'utilisent">
        <span class="dh-lv-shield">
          <svg viewBox="0 0 64 74" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 63,1 63,50 32,73 1,50"/></svg>
          <span class="dh-lv-num">${c.level}</span>
          <span class="dh-lv-lbl">Niveau</span>
        </span>
        <span class="dh-lv-btns">
          <button data-lvl="-1" title="Baisser le niveau (ajustement manuel)">−</button>
          <button id="dh-levelup" title="Montée de niveau guidée (règles p. 109-111) : récompense, 2 améliorations, carte de domaine">★ Monter</button>
        </span>
      </div>
    </header>

    <!-- ===== Barre d'outils ===== -->
    <div class="dh-actions">
      <span class="dh-sp"></span>
      <button class="btn ghost small" id="rest-short" title="Repos court : efface les Stress">Repos court</button>
      <button class="btn ghost small" id="rest-long" title="Repos long : PV max, Stress 0, Espoir 2">Repos long</button>
      <button class="btn ghost small" id="btn-export" title="Exporter en JSON">⬆</button>
      <button class="btn ghost small" id="btn-import" title="Importer un personnage JSON">⬇</button>
      <button class="btn danger small" id="btn-delete" title="Supprimer le personnage">🗑</button>
      <input type="file" id="file-import" accept="application/json" style="display:none">
    </div>

    <!-- ===== ONGLETS MOBILE (sticky, sous le header) ===== -->
    <div class="dh-mtabs">
      ${MTABS.map(t => `<button class="mt ${ui.mtab === t.id ? 'active' : ''}" data-mtab="${t.id}">${t.label}</button>`).join('')}
    </div>

    <!-- ===== BANDE DÉFENSES : Évasion · Armure + 12 cases · 6 TRAITS ===== -->
    <div class="dh-defstrip s-combat">
      <div class="dh-shield-block">
        <div class="dh-shield eva" title="Difficulté de base pour vous toucher">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 99,1 99,72 50,99 1,72"/></svg>
          <span class="dh-sh-lbl">Évasion</span>
          <input type="number" class="dh-sh-val" data-f="evasion" value="${c.evasion}" min="0" max="30">
        </div>
        <div class="dh-shield arm" title="Score d'armure + emplacements">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 99,1 99,72 50,99 1,72"/></svg>
          <span class="dh-sh-lbl">Armure</span>
          <input type="number" class="dh-sh-val" data-f="armorScore" value="${c.armorCard.baseScore}" min="0" max="12">
        </div>
        <div class="dh-aspots" title="Emplacements d'armure — cliquez pour marquer les dégâts absorbés">
          ${Array.from({ length: 12 }, (_, i) => `<button class="dh-aspip ${i < c.armorSlots.used ? 'on' : ''}" data-apip="${i}" aria-label="Emplacement d'armure ${i + 1}" aria-pressed="${i < c.armorSlots.used}"><svg viewBox="0 0 22 26" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,1 21,1 21,18 11,25 1,18"/></svg></button>`).join('')}
        </div>
      </div>
      <div class="dh-traitrow">
        ${TRAIT_KEYS.map(k => `
        <button class="dh-trait ${c.traitMarks?.includes(k) ? 'marked' : ''}" data-troll="${k}" title="Jet de ${T.traits[k]} — Dés de Dualité (2d12)${c.traitMarks?.includes(k) ? ' · trait coché (amélioré ce palier)' : ''}">
          <span class="dh-tr-head"><span class="dh-tr-name">${T.traits[k]}</span><span class="dh-tr-mark ${c.traitMarks?.includes(k) ? 'on' : ''}" title="${c.traitMarks?.includes(k) ? 'Trait amélioré ce palier' : 'Améliorable à la prochaine montée de niveau'}">${c.traitMarks?.includes(k) ? '✓' : '·'}</span></span>
          <span class="dh-tr-body">${signed(c.traits[k])}</span>
          <span class="dh-tr-verbs">${T.traitVerbs[k].split(' · ').join('<br>')}</span>
        </button>`).join('')}
      </div>
    </div>

    <!-- ===== 2 COLONNES ===== -->
    <div class="dh-main">

      <!-- ---- COLONNE GAUCHE ---- -->
      <div class="dh-col">

        <!-- DÉGÂTS & SANTÉ -->
        <section class="dh-panel s-combat">
          <div class="dh-banner"><i></i><span>Dégâts &amp; Santé</span><i></i></div>
          <div class="dh-thrrow">
            <div class="dh-thrbar minor"><span>Dégâts mineurs</span><em>Cochez 1 PV</em></div>
            <button class="dh-thrval" data-thr="1" title="Modifier les seuils">${thr.major}</button>
            <div class="dh-thrbar major"><span>Dégâts majeurs</span><em>Cochez 2 PV</em></div>
            <button class="dh-thrval" data-thr="2" title="Modifier les seuils">${thr.severe}</button>
            <div class="dh-thrbar severe"><span>Dégâts graves</span><em>Cochez 3 PV</em></div>
          </div>
          <p class="dh-help">Seuils = base d'armure ${c.armorCard.baseMajor}/${c.armorCard.baseSevere} + Niveau ${c.level}${c.thresholds.bonus ? ` ${signed(c.thresholds.bonus)} (aptitudes)` : ''}. Comparez les dégâts reçus aux seuils.</p>

          <div class="dh-gauge">
            <div class="dh-g-head"><span class="dh-g-lbl">PV</span>
              <span class="dh-g-nums"><b>${c.hp.current}</b>/${c.hp.max}</span>
              <button class="dh-g-lock" data-hlock title="Masquer les cases déblocables vides">⟲</button></div>
            <div class="dh-boxrow">
              ${Array.from({ length: c.hp.active + 6 }, (_, i) => {
                const avail = i < c.hp.active;
                const extraOn = !avail && i < c.hp.active + c.hp.unlocked;
                const filled = i < c.hp.current;
                return `<button class="dh-box${avail ? '' : ' dash'}${extraOn ? ' xtra' : ''}${filled ? ' on' : ''}" data-hpbox="${i}" ${!avail && !extraOn ? 'title="Case déblocable — cliquez pour débloquer"' : ''}></button>`;
              }).join('')}
            </div>
          </div>

          <div class="dh-gauge">
            <div class="dh-g-head"><span class="dh-g-lbl">Stress</span>
              <span class="dh-g-nums"><b>${c.stress.current}</b>/${c.stress.max}</span>
              <button class="dh-g-lock" data-slock title="Masquer les cases déblocables vides">⟲</button></div>
            <div class="dh-boxrow">
              ${Array.from({ length: c.stress.active + 6 }, (_, i) => {
                const avail = i < c.stress.active;
                const extraOn = !avail && i < c.stress.active + c.stress.unlocked;
                const filled = i < c.stress.current;
                return `<button class="dh-box stress${avail ? '' : ' dash'}${extraOn ? ' xtra' : ''}${filled ? ' on' : ''}" data-stbox="${i}" ${!avail && !extraOn ? 'title="Case déblocable — cliquez pour débloquer"' : ''}></button>`;
              }).join('')}
            </div>
          </div>
        </section>

        <!-- ESPOIR -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Espoir</span><i></i></div>
          <div class="dh-hopetrack" title="Espoir — cliquez un losange">
            ${Array.from({ length: 6 }, (_, i) => `<button class="dh-diamond ${i < c.hope.current ? 'on' : ''}" data-hoped="${i}"></button>`).join('')}
          </div>
          <p class="dh-help">Dépensez un Espoir pour utiliser une Expérience ou aider un allié.</p>
          <label class="dh-fl dh-fl-hope"><span>Feature d'Espoir</span>
            <textarea data-f="hopeFeature" rows="4" placeholder="Feature d'Espoir de votre classe…">${esc(c.hopeFeature)}</textarea></label>
        </section>

        <!-- EXPÉRIENCES -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Expériences</span><i></i></div>
          ${c.experiences.slice(0, 5).map((e, i) => `
          <div class="dh-exprow">
            <input class="dh-exp-name" data-ef="${i}:name" value="${esc(e.name)}" placeholder="Expérience ${i + 1}…">
            <input type="number" class="dh-ribbon" data-ef="${i}:mod" value="${e.mod}" min="-9" max="9" title="Modificateur — 🎲 pour l'ajouter à un jet">
            <button class="dh-exp-roll" data-eroll="${i}" title="Utiliser cette Expérience (dépense 1 Espoir)">🎲</button>
          </div>`).join('')}
        </section>

        <!-- OR -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Or</span><i></i></div>
          <div class="dh-gold">
            <div class="dh-goldgrp">
              <div class="dh-gpips" title="Poignées — cliquez la ${gt.handfuls}e pastille pour ajuster">${Array.from({ length: 10 }, (_, i) => `<button class="gpip g1 ${i < gt.handfuls ? 'on' : ''}" data-goldpip="handfuls:${i}"></button>`).join('')}</div>
              <div class="dh-gold-lbl"><span>Poignées</span><b class="dh-gold-n">${gt.handfuls}/10</b>
                <span class="dh-gold-btns"><button data-goldbtn="handfuls:-1" title="−1 poignée">−</button><button data-goldbtn="handfuls:1" title="+1 poignée">+</button></span></div>
            </div>
            <div class="dh-goldgrp">
              <div class="dh-gpips" title="Sacs — 1 sac = 10 poignées">${Array.from({ length: 10 }, (_, i) => `<button class="gpip g2 ${i < gt.bags ? 'on' : ''}" data-goldpip="bags:${i}"></button>`).join('')}</div>
              <div class="dh-gold-lbl"><span>Sacs</span><b class="dh-gold-n">${gt.bags}/10</b>
                <span class="dh-gold-btns"><button data-goldbtn="bags:-1" title="−1 sac">−</button><button data-goldbtn="bags:1" title="+1 sac">+</button></span></div>
            </div>
            <div class="dh-goldgrp chest">
              <div class="dh-gpips" title="Coffre — 1 coffre = 10 sacs">${Array.from({ length: 1 }, (_, i) => `<button class="gpip g3 ${i < gt.chests ? 'on' : ''}" data-goldpip="chests:${i}"></button>`).join('')}</div>
              <div class="dh-gold-lbl"><span>Coffres</span><b class="dh-gold-n">${gt.chests}/1</b>
                <span class="dh-gold-btns"><button data-goldbtn="chests:-1" title="−1 coffre">−</button><button data-goldbtn="chests:1" title="+1 coffre">+</button></span></div>
            </div>
          </div>
          <div class="dh-gold-foot">
            <span>Total : <b>${goldTotal}</b> poignées · 10 poignées = 1 sac · 10 sacs = 1 coffre</span>
            <button class="btn ghost small" data-goldconv title="Convertir automatiquement 10 poignées en 1 sac, 10 sacs en 1 coffre">⇄ Convertir</button>
          </div>
        </section>

        <!-- APTITUDE DE CLASSE -->
        <section class="dh-panel s-stats">
          <div class="dh-banner"><i></i><span>Aptitude de classe</span><i></i></div>
          <div class="dh-cf">
            <textarea data-f="classFeature" rows="6" placeholder="Capacités de classe, features de sous-classe…">${esc(c.classFeature)}</textarea>
          </div>
        </section>
      </div>

      <!-- ---- COLONNE DROITE ---- -->
      <div class="dh-col">

        <!-- ARMES -->
        <section class="dh-panel s-equip">
          <div class="dh-banner"><i></i><span>Armes</span><i></i></div>

          <!-- ===== ACTIONS & ATTAQUES : tableau tactique rapide (style D&D Beyond) ===== -->
          <div class="dha-block" id="dh-actions">
            <div class="dha-head">
              <span class="dha-t">Actions &amp; Attaques</span>
              <span class="dha-sub">1 tap = jet 3D</span>
            </div>
            ${(c.weapons.filter(w => w.primary || w.secondary).length ? c.weapons.filter(w => w.primary || w.secondary) : c.weapons.filter(w => w.state === 'active')).map(w => {
              const mod = c.traits[w.trait] || 0;
              const n = Math.max(1, Math.min(6, c.proficiency));
              return `<div class="dha-row">
                <span class="dha-icon" title="${w.dmgType === 'mag' ? 'Magique' : 'Physique'}">${w.dmgType === 'mag' ? '✦' : '⚔'}</span>
                <span class="dha-name">
                  <b>${esc(w.name || 'Arme')}</b>
                  <small>${T.traits[w.trait] || ''} · ${w.hands === 'two' ? '2 mains' : '1 main'} · ${esc(w.range || '')}</small>
                </span>
                <span class="dha-range">${esc(w.range || '—')}</span>
                <button class="dha-btn atk" data-dha-atk="${w.uid}" title="Jet de Dualité + ${T.traits[w.trait] || ''}">${mod >= 0 ? '+' + mod : mod}</button>
                <button class="dha-btn dmg" data-dha-dmg="${w.uid}" title="Dégâts : ${n} × ${w.dice}">${n}${w.dice}</button>
              </div>`;
            }).join('') || '<div class="dh-help">Équipez une arme pour voir vos attaques rapides.</div>'}
          </div>

          <div class="dh-prof" title="Maîtrise — nombre de dés de dégâts lancés">
            <span class="dh-g-lbl">Maîtrise</span>
            <span class="dh-prof-pips">
              ${Array.from({ length: 6 }, (_, i) => `<button class="dh-profpip ${i < c.proficiency ? 'on' : ''}" data-prof="${i}"></button>`).join('')}
            </span>
            <span class="dh-g-nums">×${c.proficiency} dé${c.proficiency > 1 ? 's' : ''}</span>
          </div>
          <div id="dh-wlist">
            ${c.weapons.map((w, i) => weaponCardHTML(w, i, c)).join('')}
            ${c.weapons.length < 4 ? `<button class="dh-wadd" data-wadd>＋ Ajouter une arme</button>` : ''}
          </div>
        </section>

        <!-- ARMURE ACTIVE -->
        <section class="dh-panel s-equip">
          <div class="dh-banner"><i></i><span>Armure active</span><i></i></div>
          <div class="dh-wgrid armor">
            <label class="dh-fl w2"><span>Nom</span><input data-af="name" value="${esc(c.armorCard.name)}" placeholder="Ex. : Cotte de mailles"></label>
            <label class="dh-fl"><span>Score de base</span><input type="number" data-af="baseScore" value="${c.armorCard.baseScore}" min="0" max="12"></label>
            <label class="dh-fl"><span>Seuil majeur de base</span><input type="number" data-af="baseMajor" value="${c.armorCard.baseMajor}" min="0" max="40"></label>
            <label class="dh-fl"><span>Seuil grave de base</span><input type="number" data-af="baseSevere" value="${c.armorCard.baseSevere}" min="0" max="60"></label>
          </div>
          <p class="dh-help">Ces valeurs alimentent le score d'armure en haut et les seuils de la colonne gauche (base + niveau).</p>
          <label class="dh-fl"><span>Feature</span><input data-af="feature" value="${esc(c.armorCard.feature)}" placeholder="Feature d'armure…"></label>
          <button class="dh-wadd" data-aadd>＋ Ajouter une armure</button>
        </section>

        <!-- INVENTAIRE -->
        <section class="dh-panel s-equip">
          <div class="dh-banner"><i></i><span>Inventaire</span><i></i></div>
          <div class="search-bar">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
            <input type="text" id="inv-q" placeholder="Rechercher un objet à ajouter…" autocomplete="off">
          </div>
          <div id="inv-suggest"></div>
          <div id="inv-list">
            ${c.inventory.map((it, i) => {
              /* détection équipement : armure (itemId → armors) ou arme (itemId → weapons) */
              const armorDef = it.itemId ? armors.find(a => a.id === it.itemId) : null;
              const weaponDef = it.itemId ? weapons.find(w => w.id === it.itemId) : null;
              if (armorDef) {
                const equipped = c.armorCard?.compendiumId === armorDef.id;
                return `<div class="inv-item ${equipped ? 'equipped' : ''}">
                  <span class="ii-name">${esc(it.name)} <span class="tag" style="margin-left:4px">Armure</span></span>
                  ${it.desc ? `<span class="ii-desc">${esc(it.desc)}</span>` : ''}
                  <span class="ii-sub">Score ${armorDef.armorScore} · Seuils ${armorDef.major}/${armorDef.severe}${armorDef.heavy ? ' · Lourd' : ''}</span>
                  <div class="ii-actions">
                    <button class="btn small ${equipped ? 'ghost' : ''}" data-inv-eq-armor="${armorDef.id}">${equipped ? 'Ranger' : 'Équiper'}</button>
                    <div class="ii-qty">
                      <button class="qbtn" data-qty="${i}:-1">−</button>
                      <span class="qval">${it.qty ?? 1}</span>
                      <button class="qbtn" data-qty="${i}:1">+</button>
                    </div>
                    <button class="icon-btn ii-del" data-del-inv="${i}" title="Retirer">
                      <svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>
                    </button>
                  </div>
                </div>`;
              }
              if (weaponDef) {
                const owned = c.weapons.find(w => w.compendiumId === weaponDef.id);
                const equipped = owned && (owned.primary || owned.secondary);
                return `<div class="inv-item ${equipped ? 'equipped' : ''}">
                  <span class="ii-name">${esc(it.name)} <span class="tag" style="margin-left:4px">Arme</span></span>
                  ${it.desc ? `<span class="ii-desc">${esc(it.desc)}</span>` : ''}
                  <span class="ii-sub">${T.traits[weaponDef.trait] || ''} · ${esc(weaponDef.range)} · ${weaponDef.dice}${weaponDef.burden === 'twoHanded' ? ' · 2 mains' : ''}</span>
                  <div class="ii-actions">
                    ${owned
                      ? `<button class="btn small ghost" data-inv-eq-weapon="${weaponDef.id}" data-owned-uid="${owned.uid}">${equipped ? 'Ranger' : 'Équiper'}</button>`
                      : `<button class="btn small" data-inv-eq-weapon="${weaponDef.id}">Équiper</button>`}
                    <div class="ii-qty">
                      <button class="qbtn" data-qty="${i}:-1">−</button>
                      <span class="qval">${it.qty ?? 1}</span>
                      <button class="qbtn" data-qty="${i}:1">+</button>
                    </div>
                    <button class="icon-btn ii-del" data-del-inv="${i}" title="Retirer">
                      <svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>
                    </button>
                  </div>
                </div>`;
              }
              return `<div class="inv-item">
              <span class="ii-name">${esc(it.name)}</span>
              ${it.desc ? `<span class="ii-desc">${esc(it.desc)}</span>` : ''}
              <div class="ii-qty">
                <button class="qbtn" data-qty="${i}:-1">−</button>
                <span class="qval">${it.qty ?? 1}</span>
                <button class="qbtn" data-qty="${i}:1">+</button>
              </div>
              <button class="icon-btn ii-del" data-del-inv="${i}" title="Retirer">
                <svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>
              </button>
            </div>`;
            }).join('') || '<div class="dh-help">Inventaire vide — ajoutez des objets via la recherche.</div>'}
          </div>
          <div class="dh-invadd">
            <input type="text" id="inv-new" placeholder="Ajouter un objet perso…">
            <button class="btn small" id="inv-add">Ajouter</button>
          </div>
        </section>
      </div>
    </div>

    <!-- ===== PLUS : cartes · aptitudes · background · journal ===== -->
    <div class="dh-morewrap s-more">
      <div class="tabbar">
        ${MORE_TABS.map(t => `<button class="tb ${ui.more === t.id ? 'active' : ''}" data-stab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="stab-body"></div>
    </div>

    <!-- pied de licence DPCGL 2.0 (discret) -->
    <footer class="dpcgl-mini">
      <img src="public/assets/dpcgl-community-logo.png" alt="Daggerheart Compatible">
      <span>Daggerheart™ Compatible. Terms at Daggerheart.com</span>
    </footer>
  </div>`;

  const body = $('#stab-body', main);
  if (ui.more === 'cards') await tabCards(body, c, { cards, domains, main, params });
  else if (ui.more === 'features') tabFeatures(body, c, { cl, sub, main, params });
  else if (ui.more === 'background') tabBackground(body, c, { main });
  else if (ui.more === 'journal') tabJournal(body, c, { main });

  bindAll(main, c, { main, params, weapons, armors, generalItems });

  /* B15 : restitue le focus et le scroll après re-render */
  if (focusSel) {
    const target = main.querySelector(focusSel);
    if (target && document.activeElement !== target) {
      try { target.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }
  window.scrollTo({ top: scrollY });
}

/* ============ carte d'arme ============ */
function weaponCardHTML(w, i, c) {
  /* règles P/S : mutuellement exclusives sur une même arme ;
     si l'arme principale équipée est à 2 mains, aucune arme secondaire possible */
  const twoHandedPrimary = c.weapons.some((x, j) => j !== i && x.primary && x.hands === 'two' && x.state === 'active');
  const otherIsSecondary = c.weapons.some((x, j) => j !== i && x.secondary);
  return `
  <div class="dh-wcard ${w.state === 'inventory' ? 'inv' : ''}">
    <div class="dh-wtop">
      <span class="dh-wswitch">
        <button class="ws ${w.state === 'active' ? 'on' : ''}" data-wstate="${i}:active" title="Arme portée / en main">⚔ Portée</button>
        <button class="ws ${w.state === 'inventory' ? 'on' : ''}" data-wstate="${i}:inventory" title="Arme rangée dans le sac">🎒 Sac</button>
      </span>
      <span class="dh-whands" title="Nombre de mains">
        <button class="wh ${w.hands === 'one' ? 'on' : ''}" data-whands="${i}:one">1 main</button>
        <button class="wh ${w.hands === 'two' ? 'on' : ''}" data-whands="${i}:two">2 mains</button>
      </span>
      <span class="dh-wrole">
        <label title="Arme principale (exclusif avec S sur la même arme)"><input type="checkbox" data-wrole="${i}:primary" ${w.primary ? 'checked' : ''} ${w.secondary ? 'disabled' : ''}>P</label>
        <label title="${twoHandedPrimary || (w.primary && w.hands === 'two') ? 'Indisponible : arme principale à deux mains' : 'Arme secondaire (exclusif avec P sur la même arme)'}"><input type="checkbox" data-wrole="${i}:secondary" ${w.secondary ? 'checked' : ''} ${(w.primary || twoHandedPrimary) ? 'disabled' : ''}>S</label>
      </span>
      <button class="icon-btn dh-wdel" data-wdel="${i}" title="Retirer cette arme">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="dh-wgrid">
      <label class="dh-fl w2"><span>Nom</span><input data-wf="${i}:name" value="${esc(w.name)}" placeholder="Nom de l'arme"></label>
      <label class="dh-fl"><span>Trait</span>
        <select data-wf="${i}:trait">${TRAIT_KEYS.map(k => `<option value="${k}" ${w.trait === k ? 'selected' : ''}>${T.traits[k]}</option>`).join('')}</select></label>
      <label class="dh-fl"><span>Portée</span><input data-wf="${i}:range" value="${esc(w.range)}" placeholder="Mêlée · Distance…"></label>
      <label class="dh-fl"><span>Dé de dégâts</span>
        <select data-wf="${i}:dice">${DICE.map(d => `<option ${w.dice === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="dh-fl"><span>Type</span>
        <select data-wf="${i}:dmgType">
          <option value="phy" ${w.dmgType === 'phy' ? 'selected' : ''}>Physique</option>
          <option value="mag" ${w.dmgType === 'mag' ? 'selected' : ''}>Magique</option>
        </select></label>
      <button class="btn small dh-wdmg" data-wroll="${i}" title="Lancer les dégâts : ${c.proficiency} × ${w.dice}">🎲 ${c.proficiency}${w.dice}</button>
    </div>
    <label class="dh-fl"><span>Feature</span><input data-wf="${i}:feature" value="${esc(w.feature)}" placeholder="Feature d'arme…"></label>
  </div>`;
}

/* ============ interactions ============ */
function bindAll(root, c, ctx) {
  const { main, params } = ctx;
  const refresh = () => { saveChar(c); render(main, params); };

  /* --- niveau --- */
  $('[data-lvl="-1"]', root)?.addEventListener('click', () => {
    if (c.level <= 1) return;
    c.level = Math.max(1, c.level - 1);
    refresh();
    toast(`Niveau ${c.level} (ajustement manuel) — seuils recalculés.`);
  });
  $('#dh-levelup', root)?.addEventListener('click', async () => {
    if (c.level >= 10) { toast('Niveau maximum (10) atteint.'); return; }
    openLevelUp(c, { onDone: () => render(main, params) });
  });

  /* --- champs texte/nombre génériques --- */
  $$('[data-f]', root).forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.f;
    if (k === 'evasion') c.evasion = Math.max(0, Math.min(30, parseInt(inp.value, 10) || 0));
    else if (k === 'armorScore') c.armorCard.baseScore = Math.max(0, Math.min(12, parseInt(inp.value, 10) || 0));
    else c[k] = inp.value;
    saveChar(c);
  }));

  /* --- emplacements d'armure (12) --- */
  $$('[data-apip]', root).forEach(p => p.addEventListener('click', () => {
    const i = +p.dataset.apip;
    c.armorSlots.used = (i < c.armorSlots.used) ? i : i + 1;
    refresh();
  }));

  /* --- jets de trait (overlay) --- */
  $$('[data-troll]', root).forEach(t => t.addEventListener('click', (e) => {
    if (e.target.closest('input')) return;
    openRoller(c, { trait: t.dataset.troll }, ctx);
  }));

  /* --- PV / Stress : cases + déblocage --- */
  $$('[data-hpbox]', root).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.hpbox;
    if (i < c.hp.active + c.hp.unlocked) c.hp.current = (i < c.hp.current) ? i : i + 1;
    else { c.hp.unlocked = i - c.hp.active + 1; c.hp.current = i + 1; }
    syncMaxes(c); refresh();
  }));
  $$('[data-stbox]', root).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.stbox;
    if (i < c.stress.active + c.stress.unlocked) c.stress.current = (i < c.stress.current) ? i : i + 1;
    else { c.stress.unlocked = i - c.stress.active + 1; c.stress.current = i + 1; }
    syncMaxes(c); refresh();
  }));
  $('[data-hlock]', root)?.addEventListener('click', () => {
    c.hp.unlocked = Math.max(0, Math.min(c.hp.unlocked, c.hp.current - c.hp.active));
    syncMaxes(c); refresh();
  });
  $('[data-slock]', root)?.addEventListener('click', () => {
    c.stress.unlocked = Math.max(0, Math.min(c.stress.unlocked, c.stress.current - c.stress.active));
    syncMaxes(c); refresh();
  });

  /* --- Espoir : losanges --- */
  $$('[data-hoped]', root).forEach(d => d.addEventListener('click', () => {
    const i = +d.dataset.hoped;
    c.hope.current = (i < c.hope.current) ? i : i + 1;
    refresh();
  }));

  /* --- seuils : modal --- */
  $$('[data-thr]', root).forEach(b => b.addEventListener('click', () => editThresholds(c, () => render(main, params))));

  /* --- expériences --- */
  $$('[data-ef]', root).forEach(inp => inp.addEventListener('change', () => {
    const [i, k] = inp.dataset.ef.split(':');
    if (k === 'mod') c.experiences[+i].mod = Math.max(-9, Math.min(9, parseInt(inp.value, 10) || 0));
    else c.experiences[+i].name = inp.value;
    saveChar(c);
  }));
  $$('[data-eroll]', root).forEach(b => b.addEventListener('click', () => openRoller(c, { expIdx: +b.dataset.eroll })));

  /* --- or : clic pastille = remplir jusqu'à N ; re-clic dernière = vider ; à 10/10 → report auto --- */
  $$('[data-goldpip]', root).forEach(p => p.addEventListener('click', () => {
    const [g, idx] = p.dataset.goldpip.split(':');
    const i = +idx;
    const cur = c.goldTrack[g];
    c.goldTrack[g] = (i + 1 === cur) ? i : i + 1; // re-clic sur la dernière remplie la vide
    /* remplissage complet d'un palier → conversion immédiate vers le palier supérieur */
    if (g === 'handfuls' && c.goldTrack.handfuls >= 10) { c.goldTrack.handfuls -= 10; c.goldTrack.bags = Math.min(10, c.goldTrack.bags + 1); toast('10 poignées → 1 sac.'); }
    if (g === 'bags' && c.goldTrack.bags >= 10) { c.goldTrack.bags -= 10; c.goldTrack.chests = Math.min(1, c.goldTrack.chests + 1); toast('10 sacs → 1 coffre.'); }
    refresh();
  }));
  /* --- or : boutons ± (report auto dès 10 unités, emprunt au palier inférieur) --- */
  $$('[data-goldbtn]', root).forEach(b => b.addEventListener('click', () => {
    const [g, d] = b.dataset.goldbtn.split(':');
    const max = g === 'chests' ? 1 : 10;
    let v = c.goldTrack[g] + (+d);
    if (v > max) { // report automatique au palier supérieur
      if (g === 'handfuls' && c.goldTrack.bags < 10) { c.goldTrack.bags++; v = 1; toast('10 poignées → 1 sac.'); }
      else if (g === 'bags' && c.goldTrack.chests < 1) { c.goldTrack.chests++; v = 1; toast('10 sacs → 1 coffre.'); }
      else v = max;
    }
    if (v === max && max === 10 && g !== 'chests') { // pile 10 : conversion immédiate (10 poignées = 1 sac)
      if (g === 'handfuls' && c.goldTrack.bags < 10) { c.goldTrack.bags++; v = 0; toast('10 poignées → 1 sac.'); }
      else if (g === 'bags' && c.goldTrack.chests < 1) { c.goldTrack.chests++; v = 0; toast('10 sacs → 1 coffre.'); }
    }
    if (v < 0) { // emprunt au palier inférieur : casser 1 unité du palier supérieur
      if (g === 'handfuls' && c.goldTrack.bags >= 1) { c.goldTrack.bags--; v = 9; toast('1 sac brisé en 10 poignées.'); }
      else if (g === 'bags' && c.goldTrack.chests >= 1) { c.goldTrack.chests--; v = 9; toast('1 coffre brisé en 10 sacs.'); }
      else v = 0;
    }
    c.goldTrack[g] = Math.max(0, Math.min(max, v));
    refresh();
  }));
  $('[data-goldconv]', root)?.addEventListener('click', () => {
    const gt = c.goldTrack;
    let moved = false;
    while (gt.handfuls >= 10 && gt.bags < 10) { gt.handfuls -= 10; gt.bags++; moved = true; }
    while (gt.bags >= 10 && gt.chests < 1) { gt.bags -= 10; gt.chests++; moved = true; }
    refresh();
    toast(moved ? 'Or converti : 10 poignées → 1 sac, 10 sacs → 1 coffre.' : 'Rien à convertir.');
  });

  /* --- armes --- */
  $$('[data-wadd]', root).forEach(b => b.addEventListener('click', () => weaponPicker(c, ctx, () => render(main, params))));
  /* --- armure : sélecteur du compendium (comme les armes) --- */
  $$('[data-aadd]', root).forEach(b => b.addEventListener('click', () => armorPicker(c, ctx, () => render(main, params))));
  $$('[data-wstate]', root).forEach(b => b.addEventListener('click', () => {
    const [i, st] = b.dataset.wstate.split(':');
    c.weapons[+i].state = st; refresh();
  }));
  $$('[data-whands]', root).forEach(b => b.addEventListener('click', () => {
    const [i, h] = b.dataset.whands.split(':');
    c.weapons[+i].hands = h;
    /* une arme principale passée à 2 mains déséquipe toute arme secondaire */
    if (h === 'two' && c.weapons[+i].primary) {
      c.weapons.forEach((w, j) => { if (j !== +i) w.secondary = false; });
      toast('Arme à deux mains : l\'arme secondaire est rangée.');
    }
    refresh();
  }));
  $$('[data-wrole]', root).forEach(cb => cb.addEventListener('change', () => {
    const [i, role] = cb.dataset.wrole.split(':');
    const on = cb.checked;
    const w = c.weapons[+i];
    if (!w) return;
    if (on) {
      /* P et S sont mutuellement exclusifs sur une même arme */
      w[role === 'primary' ? 'secondary' : 'primary'] = false;
      /* une seule arme P (ou S) à la fois */
      c.weapons.forEach((x, j) => { if (j !== +i) x[role] = false; });
      /* arme principale à 2 mains : pas d'arme secondaire possible */
      if (role === 'primary' && w.hands === 'two') {
        c.weapons.forEach((x, j) => { if (j !== +i) x.secondary = false; });
        toast('Arme principale à deux mains : aucune arme secondaire équipée.');
      }
    }
    w[role] = on;
    refresh();
  }));
  $$('[data-wf]', root).forEach(inp => inp.addEventListener('change', () => {
    const [i, k] = inp.dataset.wf.split(':');
    c.weapons[+i][k] = inp.value;
    saveChar(c);
  }));
  $$('[data-wdel]', root).forEach(b => b.addEventListener('click', () => {
    c.weapons.splice(+b.dataset.wdel, 1);
    refresh();
  }));
  $$('[data-wroll]', root).forEach(b => b.addEventListener('click', () => {
    const w = c.weapons[+b.dataset.wroll];
    if (w) rollDamage(c.id, w.uid);
  }));

  /* --- maîtrise --- */
  $$('[data-prof]', root).forEach(p => p.addEventListener('click', () => {
    const i = +p.dataset.prof;
    c.proficiency = (i + 1 === c.proficiency) ? i : i + 1;
    c.proficiency = Math.max(1, Math.min(6, c.proficiency));
    refresh();
  }));

  /* --- armure active --- */
  $$('[data-af]', root).forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.af;
    if (k === 'name' || k === 'feature') c.armorCard[k] = inp.value;
    else c.armorCard[k] = Math.max(0, parseInt(inp.value, 10) || 0);
    saveChar(c);
    if (k === 'baseMajor' || k === 'baseSevere') render(main, params);
  }));

  /* --- inventaire --- */
  $$('[data-qty]', root).forEach(b => b.addEventListener('click', () => {
    const [i, d] = b.dataset.qty.split(':').map(Number);
    const it = c.inventory[i];
    if (it) { it.qty = Math.max(1, (it.qty ?? 1) + d); refresh(); }
  }));
  $$('[data-del-inv]', root).forEach(b => b.addEventListener('click', () => {
    c.inventory.splice(+b.dataset.delInv, 1); refresh();
  }));

  /* --- équipement depuis l'inventaire --- */
  /* équiper une armure : met à jour l'armure active, le score et les seuils */
  $$('[data-inv-eq-armor]', root).forEach(b => b.addEventListener('click', () => {
    const def = ctx.armors.find(a => a.id === b.dataset.invEqArmor);
    if (!def) return;
    if (c.armorCard?.compendiumId === def.id) {
      /* Ranger : revient à l'armure de base sans compendium */
      c.armorCard.compendiumId = null;
      toast('Armure rangée — valeurs manuelles conservées.');
    } else {
      c.armorCard = {
        compendiumId: def.id, name: def.fr,
        baseScore: def.armorScore, baseMajor: def.major, baseSevere: def.severe,
        feature: '',
      };
      toast(`« ${def.fr} » équipée — Score ${def.armorScore}, seuils ${def.major}/${def.severe}.`);
    }
    refresh();
  }));
  /* équiper une arme : Principale si libre, sinon Secondaire (limite 2 mains au total) */
  $$('[data-inv-eq-weapon]', root).forEach(b => b.addEventListener('click', () => {
    const def = ctx.weapons.find(w => w.id === b.dataset.invEqWeapon);
    if (!def) return;
    const owned = c.weapons.find(w => w.compendiumId === def.id);
    if (owned && (owned.primary || owned.secondary)) {
      owned.primary = false; owned.secondary = false; owned.state = 'inventory';
      toast(`« ${def.fr} » rangée.`);
      refresh(); return;
    }
    if (owned) {
      /* déjà possédée mais rangée : ré-équipe selon la place */
      equipWeaponInSlot(c, owned);
      refresh(); return;
    }
    const w = {
      uid: uid(), compendiumId: def.id, name: def.fr, trait: def.trait, range: def.range,
      dice: def.dice, dmgType: def.dmgType, feature: def.featureFr || '',
      hands: def.burden === 'twoHanded' ? 'two' : 'one',
      state: 'active', primary: false, secondary: false,
    };
    c.weapons.push(w);
    equipWeaponInSlot(c, w);
    toast(`« ${def.fr} » équipée.`);
    refresh();
  }));
  function equipWeaponInSlot(c, w) {
    const twoHandedEquipped = c.weapons.some(x => x !== w && x.primary && x.hands === 'two' && x.state === 'active');
    const primaryFree = !c.weapons.some(x => x.primary);
    if (w.hands === 'two') {
      /* 2 mains : occupe Principale et chasse toute Secondaire */
      c.weapons.forEach(x => { if (x !== w) { x.primary = false; x.secondary = false; } });
      w.primary = true; w.secondary = false; w.state = 'active';
    } else if (primaryFree && !twoHandedEquipped) {
      w.primary = true; w.state = 'active';
    } else if (!twoHandedEquipped && !c.weapons.some(x => x.secondary)) {
      w.secondary = true; w.state = 'active';
    } else {
      /* plus de place : arme portée mais non assignée */
      w.state = 'active';
      toast('Emplacements P/S occupés — arme portée, ajustez manuellement.');
    }
  }

  /* --- Actions & Attaques : boutons tactiles 3D --- */
  $$('[data-dha-atk]', root).forEach(b => b.addEventListener('click', () => {
    rollAttack(c.id, b.dataset.dhaAtk);
  }));
  $$('[data-dha-dmg]', root).forEach(b => b.addEventListener('click', () => {
    rollDamage(c.id, b.dataset.dhaDmg);
  }));

  $('#inv-add', root)?.addEventListener('click', () => {
    const inp = $('#inv-new', root);
    if (inp.value.trim()) { c.inventory.push({ name: inp.value.trim(), qty: 1 }); refresh(); }
  });
  $('#inv-new', root)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#inv-add', root).click(); });
  const q = $('#inv-q', root), sug = $('#inv-suggest', root);
  if (q) q.addEventListener('input', () => {
    const s = q.value.trim().toLowerCase();
    if (s.length < 2) { sug.innerHTML = ''; return; }
    /* recherche unifiée : objets généraux + armes + armures du compendium */
    const itemHits = ctx.generalItems.filter(g => (g.fr + ' ' + g.en).toLowerCase().includes(s)).slice(0, 5)
      .map(g => ({ kind: 'item', id: g.id, fr: g.fr, icon: g.type === 'consumable' ? '🧪' : '🎁', sub: `${g.type === 'consumable' ? 'Consommable' : 'Butin'}${g.rarity ? ' · ' + g.rarity : ''}`, desc: (g.descFr || g.descEn || '').slice(0, 140) }));
    const weaponHits = ctx.weapons.filter(w => (w.fr + ' ' + w.en).toLowerCase().includes(s)).slice(0, 4)
      .map(w => ({ kind: 'weapon', id: w.id, fr: w.fr, icon: '⚔', sub: `${T.traits[w.trait] || ''} · ${w.range} · ${w.dice}${w.burden === 'twoHanded' ? ' · 2 mains' : ''}`, desc: (w.desc || '').slice(0, 140) }));
    const armorHits = ctx.armors.filter(a => (a.fr + ' ' + a.en).toLowerCase().includes(s)).slice(0, 4)
      .map(a => ({ kind: 'armor', id: a.id, fr: a.fr, icon: '🛡', sub: `Armure · Score ${a.armorScore} · Seuils ${a.major}/${a.severe}${a.heavy ? ' · Lourd' : ''}`, desc: (a.desc || '').slice(0, 140) }));
    const hits = [...itemHits, ...weaponHits, ...armorHits].slice(0, 10);
    sug.innerHTML = hits.map(g => `
      <button class="inv-sug" data-add-id="${g.id}" data-add-kind="${g.kind}">
        <span class="is-type">${g.icon}</span>
        <span class="is-body"><span class="is-name">${esc(g.fr)}</span>
        <span class="is-sub">${esc(g.sub)}</span></span>
        <span class="is-add">＋</span>
      </button>`).join('');
    $$('[data-add-id]', sug).forEach(b => b.addEventListener('click', () => {
      const hit = hits.find(x => x.id === b.dataset.addId);
      if (!hit) return;
      const ex = c.inventory.find(x => x.itemId === hit.id);
      if (ex) ex.qty = (ex.qty ?? 1) + 1;
      else c.inventory.push({ name: hit.fr, qty: 1, desc: hit.desc, itemId: hit.id });
      q.value = ''; sug.innerHTML = '';
      refresh();
      toast(`« ${hit.fr} » ajouté à l'inventaire.`);
    }));
  });

  /* --- onglets mobiles & plus --- */
  $$('[data-mtab]', root).forEach(b => b.addEventListener('click', () => {
    ui.mtab = b.dataset.mtab;
    $$('.dh-mtabs .mt', root).forEach(x => x.classList.toggle('active', x.dataset.mtab === ui.mtab));
    const sheetEl = $('.dh-sheet', root);
    if (sheetEl) sheetEl.dataset.mtab = ui.mtab;
  }));
  $$('[data-stab]', root).forEach(b => b.addEventListener('click', () => {
    ui.more = b.dataset.stab;
    render(main, params);
  }));

  /* --- actions d'en-tête --- */
  $('#rest-short', root).addEventListener('click', () => {
    if (!confirm('Repos court — effacer tous les Stress ?')) return;
    c.stress.current = 0; refresh();
    toast('Repos court : Stress effacés.');
  });
  $('#rest-long', root).addEventListener('click', () => {
    if (!confirm('Repos long — restaurer PV, Stress et Espoir ?')) return;
    c.hp.current = c.hp.max; c.stress.current = 0; c.hope.current = Math.min(c.hope.max, 2);
    refresh();
    toast('Repos long : ressources restaurées.');
  });
  $('#btn-export', root).addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `daggerheart-${(c.name || 'perso').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#btn-import', root).addEventListener('click', () => $('#file-import', root).click());
  $('#file-import', root).addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj.name || !obj.traits) throw new Error('format');
        ensureCharacter(obj); /* complète les champs manquants (anciens exports) */
        setState(s => { obj.id = uid(); obj.updatedAt = Date.now(); s.characters.push(obj); });
        toast(`« ${obj.name} » importé.`);
        go('sheet', obj.id);
      } catch (err) { toast('Fichier invalide : export de personnage attendu.'); }
    };
    rd.readAsText(f);
  });
  $('#btn-delete', root).addEventListener('click', () => {
    if (!confirm(`Supprimer définitivement « ${c.name} » ?`)) return;
    setState(s => { s.characters = s.characters.filter(x => x.id !== c.id); });
    go('chars');
  });
}

/* ============ OVERLAY : Dés de Dualité (2d12) ============ */
function openRoller(c, preset = {}, ctx = null) {
  const back = el(`<div class="modal-back"></div>`);
  const box = el(`<div class="modal-sheet dh-roll"></div>`);
  back.appendChild(box);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const expList = c.experiences.map((e, i) => ({ i, e })).filter(x => x.e.name && x.e.name.trim());
  box.innerHTML = `
    <h3>Jet d'action — ${esc(c.name || 'Personnage')}</h3>
    <div class="ms-meta">Dés de Dualité : 1d12 Espoir + 1d12 Peur + modificateurs.</div>
    <div class="dhr-dice">
      <div class="dhr-die hope"><span class="l">Espoir d12</span><span class="v" id="dhr-h">—</span></div>
      <span class="dhr-vs">+</span>
      <div class="dhr-die fear"><span class="l">Peur d12</span><span class="v" id="dhr-f">—</span></div>
    </div>
    <div class="dhr-mods">
      <select id="dhr-trait">
        <option value="">— Trait —</option>
        ${TRAIT_KEYS.map(k => `<option value="${k}" ${preset.trait === k ? 'selected' : ''}>${T.traits[k]} ${signed(c.traits[k])}</option>`).join('')}
      </select>
      <select id="dhr-exp">
        <option value="">— Expérience —</option>
        ${expList.map(x => `<option value="${x.i}" ${preset.expIdx === x.i ? 'selected' : ''}>✦ ${esc(x.e.name)} (${signed(x.e.mod)})</option>`).join('')}
      </select>
    </div>
    <label class="dhr-hopespend"><input type="checkbox" id="dhr-spend" checked> Dépenser 1 Espoir pour l'Expérience</label>
    <div class="dhr-toggles">
      <button class="btn ghost small" id="dhr-adv">▲ Avantage (d6)</button>
      <button class="btn ghost small" id="dhr-dis">▼ Désavantage (d6)</button>
    </div>
    <div class="dhr-result" id="dhr-res"></div>
    <div class="dhr-btns">
      <button class="btn ghost" id="dhr-close">Fermer</button>
      <button class="btn" id="dhr-go">✦ Lancer les dés</button>
    </div>`;

  let adv = false, dis = false;
  $('#dhr-close', box).addEventListener('click', () => back.remove());
  $('#dhr-adv', box).addEventListener('click', () => { adv = !adv; if (adv) dis = false; $('#dhr-adv', box).classList.toggle('sel', adv); $('#dhr-dis', box).classList.remove('sel'); });
  $('#dhr-dis', box).addEventListener('click', () => { dis = !dis; if (dis) adv = false; $('#dhr-dis', box).classList.toggle('sel', dis); $('#dhr-adv', box).classList.remove('sel'); });

  $('#dhr-go', box).addEventListener('click', async function rollAction() {
    /* anti double-clic : verrou pendant l'animation 3D */
    if (this.dataset.rolling === '1') return;
    this.dataset.rolling = '1';
    this.disabled = true;
    const unlock = () => { this.dataset.rolling = ''; this.disabled = false; };

    const traitK = $('#dhr-trait', box).value || null;
    const expI = $('#dhr-exp', box).value === '' ? null : +$('#dhr-exp', box).value;
    const spend = $('#dhr-spend', box).checked && expI !== null;

    if (spend && c.hope.current < 1) { toast("Pas assez d'Espoir pour utiliser cette Expérience."); unlock(); return; }
    if (spend) { c.hope.current -= 1; saveChar(c); }

    let mod = 0; const parts = [];
    if (traitK) { mod += c.traits[traitK]; parts.push(T.traits[traitK]); }
    if (expI !== null) { mod += c.experiences[expI].mod; parts.push(`✦ ${c.experiences[expI].name}`); }
    let label = parts.length ? parts.join(' + ') : "Jet d'action";

    /* Avantage/Désavantage : dé d6 additionnel (jet rapide sans bannière propre) */
    if (adv || dis) {
      const v = rollD(6);
      if (adv) { mod += v; label += ` + Avantage d6 (${v})`; }
      else { mod -= v; label += ` − Désavantage d6 (${v})`; }
    }

    /* UNIFICATION : jet de Dualité 3D via rollService */
    const r = await rollDuality({ mod, label, charId: c.id });
    unlock();
    if (!r) return;
    back.remove(); /* l'overlay ferme, la bannière 3D prend le relais */
    if (ctx) render(ctx.main, ctx.params); /* re-render : Espoir/Stress/Peur à jour */
  });
}

/* ============ MODAL : seuils (bonus d'aptitudes) ============ */
function editThresholds(c, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  const t = thresholds(c);
  sheet.innerHTML = `
    <h3>Seuils de dégâts</h3>
    <div class="ms-meta">Règle (livre p. 98) — comparez les dégâts reçus à vos seuils :</div>
    <div class="ms-body">
      <p>
        <b style="color:#9fe0b0">Dégâts Mineurs</b> : &lt; seuil Majeur → <b>1 PV</b><br>
        <b style="color:#ff9d6f">Dégâts Majeurs</b> : ≥ seuil Majeur (et &lt; Grave) → <b>2 PV</b><br>
        <b style="color:#ff6b6b">Dégâts Graves</b> : ≥ seuil Grave → <b>3 PV</b>
      </p>
      <p class="dh-help">Seuils = base de votre armure (${c.armorCard.baseMajor}/${c.armorCard.baseSevere}, modifiable dans « Armure active ») + Niveau ${c.level} + bonus d'aptitudes.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin:.8rem 0">
        <div class="field" style="margin:0"><label>Seuil Majeur (calculé)</label>
          <div class="dh-thr-live" id="lv-major">${t.major}</div></div>
        <div class="field" style="margin:0"><label>Seuil Grave (calculé)</label>
          <div class="dh-thr-live" id="lv-severe">${t.severe}</div></div>
      </div>
      <div class="field" style="margin:0"><label>Bonus d'aptitudes (ex. Peau épaisse +2)</label>
        <input type="number" id="thr-bonus" min="-9" max="20" value="${c.thresholds.bonus || 0}"></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem">
        <button class="btn ghost" id="thr-cancel">Annuler</button>
        <button class="btn" id="thr-save">Enregistrer</button>
      </div>
    </div>`;

  $('#thr-bonus', sheet).addEventListener('input', () => {
    const b = parseInt($('#thr-bonus', sheet).value, 10) || 0;
    $('#lv-major', sheet).textContent = (c.armorCard.baseMajor || 0) + c.level + b;
    $('#lv-severe', sheet).textContent = (c.armorCard.baseSevere || 0) + c.level + b;
  });
  $('#thr-cancel', sheet).addEventListener('click', () => back.remove());
  $('#thr-save', sheet).addEventListener('click', () => {
    c.thresholds.bonus = Math.max(-9, Math.min(20, parseInt($('#thr-bonus', sheet).value, 10) || 0));
    saveChar(c);
    back.remove();
    toast(`Seuils : ${thresholds(c).major} / ${thresholds(c).severe}`);
    onDone();
  });
}

/* ============ MODAL : choisir une arme ============ */
function weaponPicker(c, ctx, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  sheet.innerHTML = `
    <h3>Ajouter une arme</h3>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="wp-q" placeholder="Rechercher une arme du compendium…" autocomplete="off">
    </div>
    <div id="wp-list" class="wp-list"></div>
    <div style="margin-top:.8rem;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="wp-cancel">Annuler</button>
      <button class="btn" id="wp-custom">✎ Arme personnalisée</button>
    </div>`;

  const draw = (s = '') => {
    const hits = ctx.weapons
      .filter(w => (w.fr + ' ' + w.en).toLowerCase().includes(s.toLowerCase()))
      .slice(0, 24);
    $('#wp-list', sheet).innerHTML = hits.map(w => `
      <button class="inv-sug" data-pickid="${w.id}">
        <span class="is-body"><span class="is-name">${esc(w.fr)}</span>
        <span class="is-sub">${T.traits[w.trait] || ''} · ${esc(w.range)} · ${w.dice} · ${w.burden === 'twoHanded' ? '2 mains' : '1 main'}</span></span>
        <span class="is-add">＋</span>
      </button>`).join('') || '<div class="dh-help">Aucune arme trouvée.</div>';
    $$('[data-pickid]', sheet).forEach(b => b.addEventListener('click', () => {
      const w = ctx.weapons.find(x => x.id === b.dataset.pickid);
      c.weapons.push({
        uid: uid(), compendiumId: w.id, name: w.fr, trait: w.trait, range: w.range,
        dice: w.dice, dmgType: w.dmgType, feature: '',
        hands: w.burden === 'twoHanded' ? 'two' : 'one',
        state: 'active', primary: !c.weapons.some(x => x.primary), secondary: false,
      });
      saveChar(c);
      back.remove();
      toast(`« ${w.fr} » ajoutée.`);
      onDone();
    }));
  };
  draw();
  $('#wp-q', sheet).addEventListener('input', (e) => draw(e.target.value.trim()));
  $('#wp-cancel', sheet).addEventListener('click', () => back.remove());
  $('#wp-custom', sheet).addEventListener('click', () => {
    c.weapons.push({
      uid: uid(), compendiumId: null, name: '', trait: 'strength', range: 'Mêlée',
      dice: 'd6', dmgType: 'phy', feature: '', hands: 'one',
      state: 'active', primary: !c.weapons.some(x => x.primary), secondary: false,
    });
    saveChar(c);
    back.remove();
    onDone();
  });
}

/* ================= SÉLECTEUR D'ARMURE (comme les armes) ================= */
function armorPicker(c, ctx, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

  sheet.innerHTML = `
    <h3>Ajouter une armure</h3>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="text" id="ap-q" placeholder="Rechercher une armure du compendium…" autocomplete="off">
    </div>
    <div id="ap-list" class="wp-list"></div>
    <div style="margin-top:.8rem;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="ap-cancel">Annuler</button>
      <button class="btn" id="ap-custom">✎ Armure personnalisée</button>
    </div>`;

  const draw = (s = '') => {
    const hits = ctx.armors
      .filter(a => (a.fr + ' ' + (a.en || '')).toLowerCase().includes(s.toLowerCase()))
      .slice(0, 24);
    $('#ap-list', sheet).innerHTML = hits.map(a => `
      <button class="inv-sug" data-apick="${a.id}">
        <span class="is-body"><span class="is-name">${esc(a.fr)}</span>
        <span class="is-sub">Score ${a.armorScore} · Seuils ${a.major}/${a.severe}${a.heavy ? ' · Lourd' : ''}</span></span>
        <span class="is-add">＋</span>
      </button>`).join('') || '<div class="dh-help">Aucune armure trouvée.</div>';
    $$('[data-apick]', sheet).forEach(b => b.addEventListener('click', () => {
      const a = ctx.armors.find(x => x.id === b.dataset.apick);
      if (!a) return;
      c.armorCard = {
        compendiumId: a.id, name: a.fr,
        baseScore: a.armorScore, baseMajor: a.major, baseSevere: a.severe,
        feature: '',
      };
      c.armorId = a.id; /* cohérence avec les anciens champs */
      saveChar(c);
      back.remove();
      toast(`« ${a.fr} » équipée — Score ${a.armorScore}, seuils ${a.major}/${a.severe}.`);
      onDone();
    }));
  };
  draw();
  $('#ap-q', sheet).addEventListener('input', (e) => draw(e.target.value.trim()));
  $('#ap-cancel', sheet).addEventListener('click', () => back.remove());
  $('#ap-custom', sheet).addEventListener('click', () => {
    /* armure vierge : l'utilisateur remplit les champs manuellement */
    c.armorCard = { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' };
    saveChar(c);
    back.remove();
    toast('Armure personnalisée — remplissez les champs.');
    onDone();
  });
}

/* ================= ONGLETS « PLUS » (contenus existants) ================= */
async function tabCards(body, c, ctx) {
  const { cards, domains, main, params } = ctx;
  const inHand = c.domainCards.filter(x => x.inHand);
  const inVault = c.domainCards.filter(x => !x.inHand);
  body.innerHTML = `
    <div class="panel">
      <div class="p-head"><span class="rb-lbl">Cartes de domaine</span>
        <span class="tag">${inHand.length}/5 en main · ${c.domainCards.length} au total</span></div>
      <div id="cards-list"></div>
    </div>
    <div class="panel" style="margin-top:.9rem">
      <div class="p-head"><span class="rb-lbl">🗄️ Caveau</span>
        <span class="tag">${inVault.length} rangée(s)</span></div>
      <div class="rl-sub" style="padding:.15rem 0 .4rem">Cartes hors de la main. Le rappel en main coûte son prix en Espoir (↻).</div>
      <div id="vault-list"></div>
    </div>`;
  const cardsList = $('#cards-list', body);
  const vaultList = $('#vault-list', body);

  const cardHTML = (card, dc, inVaultList) => {
    const dom = domains[card.domain];
    const cost = featParse(card.desc);
    const actions = [];
    if (inVaultList) {
      /* caveau : remise en main au prix de rappel (↻ X Espoirs) */
      actions.push(`<button class="btn ghost small" data-return-card="${dc.cardId}">↻ Remettre en main (${card.recall ? `${card.recall} Espoir${card.recall > 1 ? 's' : ''}` : 'Gratuit'})</button>`);
    } else {
      if (cost.hope) actions.push(`<button class="btn ghost small" data-fx-hope="${cost.hope}">Activer (${cost.hope === 1 ? '1 Espoir' : `${cost.hope} Espoirs`})</button>`);
      if (cost.stress) actions.push(`<button class="btn ghost small" data-fx-stress="${cost.stress}">Marquer 1 Stress</button>`);
      if (cost.dice) actions.push(`<button class="btn ghost small" data-fx-dice="${cost.dice}" data-fx-name="${esc(card.fr)}" title="Lancer ${cost.dice}">🎲 ${cost.dice}</button>`);
      actions.push(`<button class="btn ghost small" data-toggle-hand="${dc.cardId}">↧ Ranger au caveau</button>`);
    }
    actions.push(`<button class="btn ghost small" data-remove-card="${dc.cardId}">Retirer</button>`);
    return `<div class="dcard ${dc.inHand ? '' : 'inactive'}">
      <div class="dc-head">
        <span class="dc-lvl">${card.level}</span>
        <span class="dc-name">${esc(card.fr)}</span>
        <span class="dc-domain"><img src="assets/icons/domain-card/${card.domain}.png" alt="">${esc(dom.fr)}</span>
        <span class="dc-type">${T.cardType[card.type]}</span>
        <span class="dc-recall">⟲ ${card.recall}</span>
      </div>
      <div class="dc-desc">${esc(card.desc)}</div>
      <div class="dc-actions">${actions.join('')}</div>
    </div>`;
  };

  for (const dc of inHand) {
    const card = cards.find(x => x.id === dc.cardId);
    if (card) cardsList.appendChild(el(cardHTML(card, dc, false)));
  }
  if (!inHand.length) cardsList.innerHTML = '<div class="empty"><div class="e-title">Main vide</div><div class="e-sub">Ajoutez des cartes de domaine depuis le compendium.</div></div>';

  for (const dc of inVault) {
    const card = cards.find(x => x.id === dc.cardId);
    if (card) vaultList.appendChild(el(cardHTML(card, dc, true)));
  }
  if (!inVault.length) vaultList.innerHTML = '<div class="rl-sub" style="padding:.3rem 0">Aucune carte au caveau. Rangez une carte depuis la main ci-dessus.</div>';

  const update = () => { saveChar(c); render(main, params); };
  /* Fix 3 — prendre en main : si 5 cartes déjà en main, choisir laquelle ranger */
  const takeInHand = (dc) => {
    if (inHand.length >= 5) { chooseCardToVault(c, dc, cards, update); return; }
    dc.inHand = true; update();
  };
  $$('[data-toggle-hand]', body).forEach(b => b.addEventListener('click', () => {
    const dc = c.domainCards.find(x => x.cardId === b.dataset.toggleHand);
    if (dc.inHand) { dc.inHand = false; update(); }
    else takeInHand(dc);
  }));
  /* caveau → remettre en main : paie le prix de rappel en Espoir, limite 5 stricte */
  $$('[data-return-card]', body).forEach(b => b.addEventListener('click', () => {
    const card = cards.find(x => x.id === b.dataset.returnCard);
    const dc = c.domainCards.find(x => x.cardId === b.dataset.returnCard);
    const price = card.recall || 0;
    if (c.hope.current < price) {
      toast(price ? `Espoir insuffisant ! Rappel = ${price} Espoir${price > 1 ? 's' : ''} (${c.hope.current} disponible${c.hope.current > 1 ? 's' : ''})` : 'Espoir insuffisant !');
      return;
    }
    /* finalise le rappel : déduit le prix et fait revenir la carte en main */
    const completeRecall = () => {
      c.hope.current -= price;
      dc.inHand = true;
      if (price) toast(`↻ Rappel : ${price === 1 ? '1 Espoir dépensé' : `${price} Espoirs dépensés`} — « ${card.fr} » revient en main (${c.hope.current}/${c.hope.max} restants)`);
      else toast(`↻ « ${card.fr} » revient en main (gratuit)`);
      update();
    };
    /* main pleine : choisir d'abord laquelle ranger — le prix n'est déduit qu'une
       fois l'échange confirmé (annulation = aucun frais) */
    if (inHand.length >= 5) { chooseCardToVault(c, dc, cards, completeRecall); return; }
    completeRecall();
  }));
  $$('[data-remove-card]', body).forEach(b => b.addEventListener('click', () => {
    c.domainCards = c.domainCards.filter(x => x.cardId !== b.dataset.removeCard);
    update();
  }));
  /* ---- boutons d'activation rapide sur les cartes en main (v19) ---- */
  $$('[data-fx-hope]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxHope;
    if (c.hope.current < n) { toast(`Espoir insuffisant ! (${c.hope.current}/${n} requis)`); return; }
    c.hope.current -= n;
    toast(`✦ ${n === 1 ? '1 Espoir dépensé' : `${n} Espoirs dépensés`} — ${c.hope.current}/${c.hope.max} restants`);
    update();
  }));
  $$('[data-fx-stress]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxStress;
    if (c.stress.current + n > c.stress.max) { toast(`Stress insuffisant ! (${c.stress.current}/${c.stress.max})`); return; }
    c.stress.current += n;
    toast(`${n === 1 ? '1 Stress marqué' : `${n} Stress marqués`} — ${c.stress.current}/${c.stress.max}`);
    update();
  }));
  $$('[data-fx-dice]', body).forEach(b => b.addEventListener('click', () => {
    const name = b.dataset.fxName || 'Carte';
    rollDice(b.dataset.fxDice, { label: name });
  }));
}

/* ============ onglet APTITUDES (refonte v19 : cartes style CARTES) ============ */
/* Détecte les coûts et jets dans une description :
   - hope:  "Dépensez 1/2/3 Espoir(s)" → nombre
   - stress: "Marquez un Stress" → 1
   - perRest: "une fois par (long) repos" → true
   - dice: premier jet de dés explicite "d8+2", "d6", "2d6" → notation */
const FEAT_RE = {
  hope: /D[ée]pensez?\s+(?:(\d+)|un|une)\s*Espoirs?/i,
  stress: /[Mm]arquez\s+(?:(\d+)|un)\s+Stress/i,
  perRest: /une\s+fois\s+par\s+(?:long\s+)?repos/i,
  dice: /\b(?:(\d+)\s*)?d(4|6|8|10|12|20)\b\s*(?:\+\s*(\d+))?/,
};
function featParse(desc) {
  const d = String(desc || '');
  const out = {};
  const mH = d.match(FEAT_RE.hope);
  if (mH) out.hope = mH[1] ? +mH[1] : 1;
  const mS = d.match(FEAT_RE.stress);
  if (mS) out.stress = mS[1] ? +mS[1] : 1;
  if (FEAT_RE.perRest.test(d)) out.perRest = true;
  const mD = d.match(FEAT_RE.dice);
  if (mD) {
    const qty = mD[1] ? +mD[1] : 1;
    out.dice = `${qty}d${mD[2]}${mD[3] ? `+${mD[3]}` : ''}`;
  }
  return out;
}
/* badges de coût d'une aptitude (badge Espoir / Stress / usage) */
function featCostBadges(cost) {
  const b = [];
  if (cost.hope) b.push(`<span class="fbadge cost">${cost.hope === 1 ? '1 Espoir' : `${cost.hope} Espoirs`}</span>`);
  if (cost.stress) b.push(`<span class="fbadge cost">${cost.stress === 1 ? '1 Stress' : `${cost.stress} Stress`}</span>`);
  if (cost.perRest) b.push('<span class="fbadge use">1× / long repos</span>');
  return b.join('');
}
/* carte d'aptitude : mêmes fond/bordure/titre doré que les .dcard de l'onglet CARTES */
function featureCardHTML(f, source, rank) {
  const cost = featParse(f.desc);
  const actions = [];
  if (cost.hope) actions.push(`<button class="btn ghost small" data-fx-hope="${cost.hope}">Activer (${cost.hope === 1 ? '1 Espoir' : `${cost.hope} Espoirs`})</button>`);
  if (cost.stress) actions.push(`<button class="btn ghost small" data-fx-stress="${cost.stress}">Marquer ${cost.stress === 1 ? '1 Stress' : `${cost.stress} Stress`}</button>`);
  if (cost.dice) actions.push(`<button class="btn ghost small" data-fx-dice="${cost.dice}" title="Lancer ${cost.dice}">🎲 ${cost.dice}</button>`);
  return `<div class="dcard fcard">
    <div class="dc-head">
      <span class="dc-name">${esc(f.name)}${rank ? ` <span class="fbadge rank">${rank}</span>` : ''}</span>
      <span class="fbadge src">${esc(source)}</span>
      ${featCostBadges(cost)}
    </div>
    <div class="dc-desc">${esc(f.desc)}</div>
    ${actions.length ? `<div class="dc-actions">${actions.join('')}</div>` : ''}
  </div>`;
}
/* bloc de section : titre + compteur, même gabarit que « 5/5 en main · N au total » */
function featureSection(title, count, html) {
  return `<div class="panel">
    <div class="p-head"><span class="rb-lbl">${title}</span><span class="tag">${count}</span></div>
    ${html || '<div class="rl-sub" style="padding:.4rem 0">Aucune aptitude.</div>'}
  </div>`;
}

function tabFeatures(body, c, ctx) {
  const { cl, sub } = ctx;
  /* 1. Classe & Espoir : capacité d'Espoir (coût 3 Espoirs standard) + features de base */
  const hopeFeat = c.hopeAbility ? [{ name: `✦ ${c.hopeAbility.name}`, desc: c.hopeAbility.desc }] : [];
  const classFeats = cl?.features || [];
  const sec1 = [...hopeFeat, ...classFeats];
  /* 2. Sous-classe : rangs Fondation (1re carte) / Spécialisation (2e-3e) / Maîtrise (4e+) */
  const RANKS = ['Fondation', 'Spécialisation', 'Spécialisation', 'Maîtrise', 'Maîtrise', 'Maîtrise'];
  const subFeats = (sub?.features || []).map((f, i) => ({ ...f, __rank: RANKS[i] || 'Maîtrise' }));
  /* 3. Ascendance · 4. Communauté */
  const ancFeats = c.ancestry?.abilities || [];
  const comFeat = c.community?.ability ? [c.community.ability] : [];

  body.innerHTML =
    featureSection(`Classe & Espoir${cl ? ` — ${esc(cl.fr)}` : ''}`, sec1.length,
      sec1.map(f => featureCardHTML(f, f.name.startsWith('✦') ? 'Classe' : 'Classe')).join('')) +
    featureSection(`Sous-classe${sub ? ` — ${esc(sub.fr)}` : ''}`, subFeats.length,
      subFeats.map(f => featureCardHTML(f, 'Fondation', f.__rank)).join('')) +
    featureSection(`Ascendance${c.ancestry?.fr ? ` — ${esc(c.ancestry.fr)}` : ''}`, ancFeats.length,
      ancFeats.map(f => featureCardHTML(f, 'Ascendance')).join('')) +
    featureSection(`Communauté${c.community?.fr ? ` — ${esc(c.community.fr)}` : ''}`, comFeat.length,
      comFeat.map(f => featureCardHTML(f, 'Communauté')).join(''));

  /* ---- boutons d'activation rapide : dépense Espoir ---- */
  $$('[data-fx-hope]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxHope;
    if (c.hope.current < n) { toast(`Espoir insuffisant ! (${c.hope.current}/${n} requis)`); return; }
    c.hope.current -= n;
    saveChar(c);
    toast(`✦ ${n === 1 ? '1 Espoir dépensé' : `${n} Espoirs dépensés`} — ${c.hope.current}/${c.hope.max} restants`);
    render(ctx.main, ctx.params);
  }));
  /* ---- dépense Stress ---- */
  $$('[data-fx-stress]', body).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.fxStress;
    if (c.stress.current + n > c.stress.max) { toast(`Stress insuffisant ! (${c.stress.current}/${c.stress.max})`); return; }
    c.stress.current += n;
    saveChar(c);
    toast(`${n === 1 ? '1 Stress marqué' : `${n} Stress marqués`} — ${c.stress.current}/${c.stress.max}`);
    render(ctx.main, ctx.params);
  }));
  /* ---- jet de dés rapide ---- */
  $$('[data-fx-dice]', body).forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.fcard');
    const name = card?.querySelector('.dc-name')?.textContent?.trim() || 'Aptitude';
    rollDice(b.dataset.fxDice, { label: name });
  }));
}

function tabBackground(body, c, ctx) {
  const { main } = ctx;
  body.innerHTML = `
    <div class="panel">
      <div class="p-head"><span class="rb-lbl">Réponses de background</span></div>
      ${Object.values(c.backgroundAnswers || {}).filter(v => v && v.trim()).map(a => `<p style="font-size:.86rem;color:var(--text-dim);line-height:1.6;margin-bottom:.6rem">— ${esc(a)}</p>`).join('') || '<div class="li-sub">Aucune réponse de background enregistrée.</div>'}
    </div>
    <div class="panel" style="margin-top:.9rem">
      <div class="field" style="margin:0"><label>Notes de jeu</label>
        <textarea id="notes" rows="4" placeholder="Alliés, quêtes, secrets…">${esc(c.notes || '')}</textarea></div>
    </div>`;
  $('#notes', body).addEventListener('change', (e) => { c.notes = e.target.value; saveChar(c); });
}

function tabJournal(body, c, ctx) {
  const { main } = ctx;
  c.journal = c.journal || [];
  body.innerHTML = `
    <div class="panel">
      <div class="p-head">
        <span class="rb-lbl">Journal de bord</span>
        <span class="tag">${c.journal.length} entrée(s)</span>
      </div>
      ${c.journal.map((j, i) => `
      <div class="jrn-entry">
        <div class="jrn-head">
          <span class="jrn-date">${esc(j.date)}</span>
          <button class="icon-btn" style="width:26px;height:26px" data-del-jrn="${i}">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="jrn-text">${esc(j.text)}</div>
      </div>`).join('') || '<div class="li-sub" style="padding:.3rem 0">Le journal est vide. Consignez vos aventures au fil des sessions !</div>'}
      <div class="field" style="margin-top:.7rem">
        <textarea id="jrn-new" rows="3" placeholder="Nouvelle entrée de journal… (date auto)"></textarea>
        <button class="btn small" id="jrn-add" style="margin-top:.5rem">＋ Ajouter l'entrée</button>
      </div>
    </div>`;
  const update = () => { saveChar(c); tabJournal(body, c, ctx); };
  $('#jrn-add', body).addEventListener('click', () => {
    const t = $('#jrn-new', body);
    if (!t.value.trim()) return;
    const d = new Date();
    c.journal.unshift({ date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), text: t.value.trim() });
    saveChar(c); update();
  });
  $$('[data-del-jrn]', body).forEach(b => b.addEventListener('click', () => {
    c.journal.splice(+b.dataset.delJrn, 1);
    saveChar(c); update();
  }));
}

/* Fix 3 — invite : quelle carte ranger au caveau pour libérer une place en main ? */
function chooseCardToVault(c, wanted, cards, onDone) {
  const back = el(`<div class="modal-back"></div>`);
  const sheet = el(`<div class="modal-sheet dh-picker"></div>`);
  back.appendChild(sheet);
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  const inHand = c.domainCards.filter(x => x.inHand);
  sheet.innerHTML = `
    <h3>Main complète — 5 cartes en main</h3>
    <div class="ms-meta">Pour prendre « ${esc(wanted ? (cards.find(x => x.id === wanted.cardId)?.fr || 'cette carte') : 'cette carte')} », choisissez une carte à ranger au caveau :</div>
    <div class="wp-list">
      ${inHand.map(dc => {
        const cd = cards.find(x => x.id === dc.cardId);
        if (!cd) return '';
        return `<button class="inv-sug" data-vault="${dc.cardId}">
          <span class="is-body"><span class="is-name">${esc(cd.fr)}</span>
          <span class="is-sub">Niv. ${cd.level} · ranger au caveau</span></span>
          <span class="is-add">↧</span>
        </button>`;
      }).join('')}
    </div>
    <div style="margin-top:.8rem;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn ghost" id="cv-cancel">Annuler</button>
    </div>`;
  $('#cv-cancel', sheet).addEventListener('click', () => back.remove());
  $$('[data-vault]', sheet).forEach(b => b.addEventListener('click', () => {
    const dc = c.domainCards.find(x => x.cardId === b.dataset.vault);
    if (dc) dc.inHand = false;
    if (wanted) wanted.inHand = true;
    back.remove();
    onDone();
  }));
}
