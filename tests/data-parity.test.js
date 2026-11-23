import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { featParse } from '../js/feat-parse.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

test('les sous-classes FR et EN ont la même structure et le même nombre de features', () => {
  const fr = readJson('data/subclasses.json');
  const en = readJson('data/en/subclasses.json');
  assert.equal(en.length, fr.length);
  for (const sub of fr) {
    const other = en.find((s) => s.id === sub.id);
    assert.ok(other, `Sous-classe EN manquante : ${sub.fr}`);
    assert.equal(other.features.length, sub.features.length, `Nombre de features différent pour ${sub.fr}`);
    assert.ok(other.features.every((f) => f.name && f.desc), `Feature EN incomplète pour ${sub.fr}`);
  }
  assert.deepEqual(
    en.find((s) => s.id === 'XTSODVM8st75Os8M').features.map((f) => f.name),
    ['Heart of a Poet', 'Rousing Speech', 'Eloquent', 'Epic Poetry'],
  );
});

test('les macros Foundry brutes ont été retirées des données utilisateur', () => {
  for (const rel of ['data/generalItems.json', 'data/en/generalItems.json', 'data/subclasses.json', 'data/en/subclasses.json']) {
    assert.ok(!/\[\[\//.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')), `Macro Foundry restante dans ${rel}`);
  }
});

test('les balises Foundry ont été retirées du bestiaire et des environnements FR', () => {
  for (const rel of ['data/adversaries.json', 'data/environments.json']) {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!/@UUID\[|@Lookup\[|\[\[\/r|\[\[\/fr/.test(raw), `Balise Foundry restante dans ${rel}`);
  }
});

test('les objets de départ existent dans les données FR et EN', () => {
  const ids = ['z3qzQoThgcZafEZr', 'ocBTBdfvjTqIehtf', 'jga6tUNjZjTpK6td', 'b6vGSPFWOlzZZDLO', 'tPfKtKRRjv8qdSqy'];
  for (const rel of ['data/generalItems.json', 'data/en/generalItems.json']) {
    const items = readJson(rel);
    for (const id of ids) assert.ok(items.some((x) => x.id === id), `${id} manquant dans ${rel}`);
  }
});

test('les exemples de formes bestiales EN sont traduits et les portées FR normalisées', () => {
  const beastforms = readJson('data/en/beastforms.json');
  assert.equal(beastforms.find((b) => b.id === 'agile-scout').examples, 'Fox, Mouse, Weasel, etc.');
  assert.equal(beastforms.find((b) => b.id === 'aquatic-scout').examples, 'Eel, Fish, Octopus, etc.');
  const adversaries = readJson('data/adversaries.json');
  const ranges = new Set(adversaries.map((a) => a.atkRange).filter(Boolean));
  assert.deepEqual([...ranges].sort(), ['Mêlée', 'Proche', 'Très proche', 'Très éloignée', 'Éloignée'].sort());
});

test('les capacités FR du bestiaire et des environnements sont traduites', () => {
  const frAdv = readJson('data/adversaries.json');
  const enAdv = readJson('data/en/adversaries.json');
  const frEnv = readJson('data/environments.json');
  const enEnv = readJson('data/en/environments.json');
  const remaining = [];

  for (const a of frAdv) {
    const en = enAdv.find((x) => x.id === a.id);
    assert.ok(en, `Adversaire EN manquant : ${a.en}`);
    assert.ok(a.fr, `Nom français manquant : ${a.en}`);
    const byEn = new Map(en.features.map((f) => [f.nameEn, f]));
    for (const f of a.features) {
      assert.ok(f.name && f.desc, `Capacité FR incomplète : ${a.en} / ${f.nameEn}`);
      const ef = byEn.get(f.nameEn);
      if (ef && f.desc === ef.desc) remaining.push(`${a.en} / ${f.nameEn}`);
    }
  }

  for (const e of frEnv) {
    const en = enEnv.find((x) => x.id === e.id);
    assert.ok(en, `Environnement EN manquant : ${e.en}`);
    assert.ok(e.fr, `Nom français manquant : ${e.en}`);
    const byEn = new Map(en.features.map((f) => [f.nameEn, f]));
    for (const f of e.features) {
      assert.ok(f.name && f.desc, `Capacité FR incomplète : ${e.en} / ${f.nameEn}`);
      const ef = byEn.get(f.nameEn);
      if (ef && f.desc === ef.desc) remaining.push(`${e.en} / ${f.nameEn}`);
    }
  }

  assert.deepEqual(remaining, []);
});

test('les données FR utilisent le vocabulaire de l’application et les cartes sont alignées', () => {
  const files = [
    'data/adversaries.json', 'data/ancestries.json', 'data/armors.json', 'data/beastforms.json',
    'data/classes.json', 'data/communities.json', 'data/domainCards.json', 'data/domains.json',
    'data/environments.json', 'data/generalItems.json', 'data/subclasses.json',
    'data/transformations.json', 'data/weapons.json',
  ];
  const forbidden = [
    [/\bcochez?\b/i, 'cochez'], [/\bcocher\b/i, 'cocher'], [/\bCoche\b/, 'Coche'],
    [/\bcoche\b/, 'coche'], [/\bCochent\b/i, 'Cochent'], [/\bcochant\b/i, 'cochant'],
    [/coché/i, 'coché'], [/Très courte/i, 'Très courte'], [/Courte portée/i, 'Courte portée'],
    [/Longue portée/i, 'Longue portée'], [/auc1/i, 'auc1'], [/\balliez\b/i, 'alliez'],
    [/\bfeatures?\b/i, 'features'], [/\blong repos\b/i, 'long repos'], [/\bPB\b/, 'PB'],
    [/(?:à|de) (?:Longue|Courte)\b/, 'portée Longue/Courte'],
  ];
  const bad = [];
  for (const rel of files) {
    const isEnv = rel === 'data/environments.json';
    const walk = (value, path = '') => {
      if (typeof value === 'string') {
        if (/(^|\.)(en|nameEn|classEn|descEn|img|id)$/.test(path)) return;
        if (isEnv && /^\[\d+\]\.(desc|impulses)$/.test(path)) return;
        for (const [re, label] of forbidden) if (re.test(value)) bad.push(`${rel} ${path} (${label})`);
      } else if (Array.isArray(value)) {
        value.forEach((x, i) => walk(x, `${path}[${i}]`));
      } else if (value && typeof value === 'object') {
        for (const [k, x] of Object.entries(value)) walk(x, path ? `${path}.${k}` : k);
      }
    };
    walk(readJson(rel));
  }
  assert.deepEqual(bad, []);

  const cards = readJson('data/domainCards.json');
  const enCards = readJson('data/en/domainCards.json');
  assert.equal(cards.length, enCards.length);
  for (const card of cards) {
    const other = enCards.find((c) => c.id === card.id);
    assert.ok(other, `Carte EN manquante : ${card.en}`);
    assert.ok(card.fr && card.desc, `Carte FR incomplète : ${card.en}`);
    assert.notEqual(card.desc, other.desc, `Description FR encore en anglais : ${card.en}`);
  }
  const names = Object.fromEntries(cards.map((c) => [c.en, c.fr]));
  assert.equal(names['Healing Hands'], 'Mains guérisseuses');
  assert.equal(names['Final Words'], 'Dernières paroles');
  assert.equal(names.Reckless, 'Téméraire');
  assert.equal(names['Dark Whispers'], 'Sombres murmures');
  assert.equal(names['Mass Disguise'], 'Déguisement de masse');
  assert.equal(names.Scramble, 'Retrait rapide');
  assert.equal(names['Versatile Fighter'], 'Combattant polyvalent');
  assert.equal(names['Natural Familiar'], 'Familier naturel');

  const environments = readJson('data/environments.json');
  const english = /\b(Any|Undead|Skeletons?|Zombies?|Guards?|Constructs?|Guardians?|Wraiths?|Raiders?|Commoner|Travelers?|Residents?|Executioners?|Elemental|Reawakened|Volcanic)\b/;
  const badEnv = environments
    .filter((e) => !e.adversaries || !e.adversaries.trim() || english.test(e.adversaries))
    .map((e) => `${e.id}: ${e.adversaries}`);
  assert.deepEqual(badEnv, []);
});

test('les coûts Espoir/Stress des cartes sont détectés en FR et EN', () => {
  const frCards = readJson('data/domainCards.json');
  const enCards = readJson('data/en/domainCards.json');
  assert.ok(frCards.filter((c) => featParse(c.desc).stress).length >= 15);
  assert.ok(frCards.filter((c) => featParse(c.desc).hope).length >= 35);
  assert.ok(enCards.filter((c) => featParse(c.desc).stress).length >= 60);
  assert.ok(enCards.filter((c) => featParse(c.desc).hope).length >= 60);
});
