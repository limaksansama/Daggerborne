import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map([['daggerborne-lang', 'en']]);
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
};

const { trUi } = await import('../js/i18n-dom.js');
const { t, setLang } = await import('../js/i18n.js');

test('trUi ne corrompt plus les noms anglais contenant des fragments français', () => {
  setLang('en');
  for (const name of [
    'Book of Korvax',
    'Sacred Resonance',
    'Guahalan Sacrifice',
    'Spiritual Sacrifice',
    'Sacrifice Self',
    'Companion Case',
    "Gravewarden's Bell",
    'Modifier',
  ]) {
    assert.equal(trUi(name), name);
  }
  /* Les mots réellement isolés restent traduits. */
  assert.equal(trUi('Case'), 'Box');
  assert.equal(trUi('Sac'), 'Bag');
  assert.equal(trUi('Ko'), 'KB');
});

test('trUi traduit les portées, les dés et les seuils', () => {
  setLang('en');
  assert.equal(trUi('Très proche'), 'Very Close');
  assert.equal(trUi('Proche'), 'Close');
  assert.equal(trUi('Éloignée'), 'Far');
  assert.equal(trUi('Très éloignée'), 'Very Far');
  assert.equal(trUi('LANCER 1 dé !'), 'ROLL 1 die !');
  assert.equal(trUi('LANCER 3 dés !'), 'ROLL 3 dice !');
  assert.equal(
    trUi('Mineurs < seuil Majeur · Majeurs ≥ seuil Majeur · Graves ≥ seuil Grave'),
    'Minor < Major threshold · Major ≥ Major threshold · Severe ≥ Severe threshold',
  );
});

test('trUi redevient inactif en français', () => {
  setLang('fr');
  assert.equal(trUi('Book of Korvax'), 'Book of Korvax');
  assert.equal(trUi('Très proche'), 'Très proche');
  setLang('en');
});

test('les libellés FR des aptitudes ne fuient pas en anglais', () => {
  setLang('fr');
  assert.equal(t('sheetFeature'), 'Aptitude');
  assert.equal(t('sheetFeatures'), 'Aptitudes');
  assert.equal(t('sheetHopeFeature'), "Aptitude d'Espoir");
  assert.equal(t('sheetFeatureHope'), "Aptitude d'Espoir de votre classe…");
  assert.equal(t('sheetFeatureWeapon'), "Aptitude d'arme…");
  assert.equal(t('sheetFeatureArmor'), "Aptitude d'armure…");
  assert.ok(!/features?/i.test(t('sheetClassFeatures')));
  setLang('en');
});
