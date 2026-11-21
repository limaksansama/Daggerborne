import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  tierOf,
  formatSigned,
  formatBonus,
  formatAtkBonus,
  nextDieStep,
  multiclassDomainCap,
  calcThresholds,
  classifyDamage,
  computeDamageApplication,
  parseDiceNotation,
  calcDamageSpec,
  calcEncounterBudget,
  calcEncounterSpent,
  sanitizeCharacter,
} from '../js/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

test('tierOf maps levels 1..10 to SRD 2.0 tiers 1..4', () => {
  assert.equal(tierOf(1), 1);
  assert.equal(tierOf(2), 2);
  assert.equal(tierOf(4), 2);
  assert.equal(tierOf(5), 3);
  assert.equal(tierOf(7), 3);
  assert.equal(tierOf(8), 4);
  assert.equal(tierOf(10), 4);
});

test('formatSigned, formatBonus, formatAtkBonus and nextDieStep behave consistently', () => {
  assert.equal(formatSigned(2), '+2');
  assert.equal(formatSigned(0), '+0');
  assert.equal(formatSigned(-1), '-1');
  assert.equal(formatBonus(3), '+3');
  assert.equal(formatBonus(0), '');
  assert.equal(formatBonus(-2), '-2');
  assert.equal(formatAtkBonus('+3'), '+3');
  assert.equal(formatAtkBonus('-1'), '-1');
  assert.equal(formatAtkBonus(0), '+0');
  assert.equal(formatAtkBonus(4), '+4');
  assert.equal(formatAtkBonus(null), '');
  assert.equal(formatAtkBonus(''), '');
  assert.equal(nextDieStep('d4'), 'd6');
  assert.equal(nextDieStep('d6'), 'd8');
  assert.equal(nextDieStep('d8'), 'd10');
  assert.equal(nextDieStep('d10'), 'd12');
  assert.equal(nextDieStep('d12'), 'd12');
  assert.equal(nextDieStep('unknown'), 'd8');
});

test('multiclassDomainCap equals ceil(level / 2)', () => {
  assert.equal(multiclassDomainCap(1), 1);
  assert.equal(multiclassDomainCap(5), 3);
  assert.equal(multiclassDomainCap(6), 3);
  assert.equal(multiclassDomainCap(7), 4);
  assert.equal(multiclassDomainCap(10), 5);
});

test('calcThresholds sums base armor thresholds, level, and aptitude bonus', () => {
  const c = {
    level: 3,
    armorCard: { baseMajor: 7, baseSevere: 15 },
    thresholds: { bonus: 2 },
  };
  assert.deepEqual(calcThresholds(c), { major: 12, severe: 20 });
});

test('classifyDamage handles zero, minor, major, severe, and massive damage rule', () => {
  assert.deepEqual(classifyDamage(0, 8, 16), { level: 0, label: 'Aucun', hp: 0 });
  assert.deepEqual(classifyDamage(-3, 8, 16), { level: 0, label: 'Aucun', hp: 0 });
  assert.deepEqual(classifyDamage(7, 8, 16), { level: 1, label: 'Mineurs', hp: 1 });
  assert.deepEqual(classifyDamage(8, 8, 16), { level: 2, label: 'Majeurs', hp: 2 });
  assert.deepEqual(classifyDamage(15, 8, 16), { level: 2, label: 'Majeurs', hp: 2 });
  assert.deepEqual(classifyDamage(16, 8, 16), { level: 3, label: 'Graves', hp: 3 });
  assert.deepEqual(classifyDamage(32, 8, 16, { massiveRule: false }), { level: 3, label: 'Graves', hp: 3 });
  assert.deepEqual(classifyDamage(32, 8, 16, { massiveRule: true }), { level: 4, label: 'Massifs', hp: 4 });
});

test('computeDamageApplication applies armor slot reduction unless direct or unavailable', () => {
  const absorbMinor = computeDamageApplication({ dmg: 5, major: 8, severe: 16, useArmor: true, armorAvailable: 2 });
  assert.equal(absorbMinor.hpMarked, 0);
  assert.equal(absorbMinor.armorSpent, 1);

  const reduceMajor = computeDamageApplication({ dmg: 12, major: 8, severe: 16, useArmor: true, armorAvailable: 1 });
  assert.equal(reduceMajor.hpMarked, 1);
  assert.equal(reduceMajor.finalLabel, 'Mineurs');
  assert.equal(reduceMajor.armorSpent, 1);

  const noArmor = computeDamageApplication({ dmg: 12, major: 8, severe: 16, useArmor: true, armorAvailable: 0 });
  assert.equal(noArmor.hpMarked, 2);
  assert.equal(noArmor.armorSpent, 0);

  const direct = computeDamageApplication({ dmg: 18, major: 8, severe: 16, useArmor: true, armorAvailable: 3, direct: true });
  assert.equal(direct.hpMarked, 3);
  assert.equal(direct.armorSpent, 0);

  const massiveReduced = computeDamageApplication({ dmg: 40, major: 8, severe: 16, useArmor: true, armorAvailable: 1, massiveRule: true });
  assert.equal(massiveReduced.hpMarked, 3);
  assert.equal(massiveReduced.finalLabel, 'Graves');
  assert.equal(massiveReduced.armorSpent, 1);
});

test('parseDiceNotation parses standard and modified notations', () => {
  assert.deepEqual(parseDiceNotation('2d6 + 3'), {
    clean: '2d6+3',
    dicePart: '2d6',
    qty: 2,
    sides: 6,
    mod: 3,
  });
  assert.deepEqual(parseDiceNotation('d10-1'), {
    clean: 'd10-1',
    dicePart: 'd10',
    qty: 1,
    sides: 10,
    mod: -1,
  });
});

test('calcDamageSpec implements SRD 2.0 normal and critical damage formulas without doubling flat bonuses', () => {
  const norm = calcDamageSpec(2, 'd8', 1);
  assert.deepEqual(norm, {
    qty: 2,
    sides: 8,
    flatBonus: 1,
    crit: false,
    critMax: 0,
    diceOnlyNotation: '2d8',
    normalNotation: '2d8+1',
    fullNotation: '2d8+1',
  });

  const crit = calcDamageSpec(2, 'd8', 1, { crit: true });
  assert.deepEqual(crit, {
    qty: 2,
    sides: 8,
    flatBonus: 1,
    crit: true,
    critMax: 16,
    diceOnlyNotation: '2d8',
    normalNotation: '2d8+1',
    fullNotation: '2d8+16+1',
  });

  const negCrit = calcDamageSpec(3, 'd6', -1, { crit: true });
  assert.equal(negCrit.critMax, 18);
  assert.equal(negCrit.fullNotation, '3d6+18-1');

  assert.equal(calcDamageSpec(0, 'd10', 0, { crit: true }).qty, 1);
  assert.equal(calcDamageSpec(9, 'd10', 0, { crit: true }).critMax, 60);
});

test('calcEncounterBudget and calcEncounterSpent match SRD 2.0 combat points', () => {
  assert.equal(calcEncounterBudget(4), 14);
  assert.equal(calcEncounterBudget(5, { harder: true }), 19);
  assert.equal(calcEncounterBudget(3, { easier: true, twoSolos: true }), 8);
  assert.equal(
    calcEncounterSpent([
      { type: 'solo', qty: 1 },
      { type: 'minion', qty: 2 },
      { type: 'standard', qty: 2 },
    ]),
    5 + 2 + 4
  );
});

test('sanitizeCharacter deeply fills nested SRD fields without overwriting existing ones', () => {
  const template = {
    name: '',
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    hp: { max: 6, current: 6, active: 6, unlocked: 0 },
    stress: { max: 6, current: 0, active: 6, unlocked: 0 },
    hope: { max: 6, current: 2 },
    goldTrack: { handfuls: 0, bags: 0, chests: 0 },
    thresholds: { bonus: 0 },
    armorSlots: { max: 12, used: 0 },
    armorCard: { compendiumId: null, name: '', baseScore: 0, baseMajor: 0, baseSevere: 0, feature: '' },
    experiences: [{ name: '', mod: 2 }],
    scars: 0,
    conditions: [],
    cardUses: {},
    cardTokens: {},
    shortRestsSinceLong: 0,
  };
  const legacy = {
    name: 'Kairos',
    hp: { current: 4 },
    traits: { agility: 2 },
    goldTrack: { handfuls: 5 },
  };
  const result = sanitizeCharacter(legacy, template);
  assert.equal(result.name, 'Kairos');
  assert.equal(result.hp.current, 4);
  assert.equal(result.hp.max, 6);
  assert.equal(result.hp.active, 6);
  assert.equal(result.traits.agility, 2);
  assert.equal(result.traits.knowledge, 0);
  assert.equal(result.goldTrack.handfuls, 5);
  assert.equal(result.goldTrack.bags, 0);
  assert.equal(result.armorCard.baseScore, 0);
  assert.equal(result.scars, 0);
  assert.deepEqual(result.conditions, []);
  assert.deepEqual(result.cardUses, {});
  assert.deepEqual(result.cardTokens, {});
  assert.deepEqual(result.extraDomains, []);
  assert.deepEqual(result.traitMarks, []);
  assert.deepEqual(result.backgroundAnswers, {});
  assert.equal(result.shortRestsSinceLong, 0);
});

test('All data/*.json datasets are valid and cross-references resolve', () => {
  const classes = readJson('data/classes.json');
  const subclasses = readJson('data/subclasses.json');
  const domains = readJson('data/domains.json');
  const domainCards = readJson('data/domainCards.json');
  const ancestries = readJson('data/ancestries.json');
  const communities = readJson('data/communities.json');
  const weapons = readJson('data/weapons.json');
  const armors = readJson('data/armors.json');
  const generalItems = readJson('data/generalItems.json');
  const adversaries = readJson('data/adversaries.json');
  const environments = readJson('data/environments.json');
  const beastforms = readJson('data/beastforms.json');
  const transformations = readJson('data/transformations.json');

  assert.equal(classes.length, 13);
  assert.equal(subclasses.length, 26);
  assert.equal(ancestries.length, 24);
  assert.equal(communities.length, 15);
  assert.equal(domainCards.length, 210);
  assert.equal(weapons.length, 400);
  assert.equal(armors.length, 85);
  assert.equal(generalItems.length, 246);
  assert.equal(adversaries.length, 264);
  assert.equal(environments.length, 47);
  assert.equal(beastforms.length, 24);
  assert.equal(transformations.length, 6);

  const classIds = new Set(classes.map(c => c.id));
  const domainKeys = new Set(Object.keys(domains));

  for (const cl of classes) {
    assert.ok(cl.id && cl.fr, `Invalid class: ${cl?.id}`);
    for (const d of cl.domains) {
      assert.ok(domainKeys.has(d), `Unknown domain ${d} in class ${cl.fr}`);
    }
  }
  for (const s of subclasses) {
    assert.ok(s.id && s.fr, `Invalid subclass: ${s?.id}`);
    assert.ok(classIds.has(s.classId), `Orphaned subclass ${s.fr} (${s.classId})`);
  }
  for (const card of domainCards) {
    assert.ok(card.id && card.fr, `Invalid card: ${card?.id}`);
    assert.ok(domainKeys.has(card.domain), `Unknown domain ${card.domain} in card ${card.fr}`);
  }
  for (const list of [ancestries, communities, weapons, armors, generalItems, adversaries, environments, beastforms, transformations]) {
    const ids = new Set();
    for (const item of list) {
      assert.ok(item.id && (item.fr || item.en), `Missing id/name in ${JSON.stringify(item).slice(0, 60)}`);
      assert.ok(!ids.has(item.id), `Duplicate id: ${item.id}`);
      ids.add(item.id);
    }
  }
});

test('Every local asset listed in sw.js exists on disk', () => {
  const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const matches = [...swText.matchAll(/'(\.\/[^']+)'/g)].map(m => m[1]);
  assert.ok(matches.length > 50, 'Expected precached asset list in sw.js');
  for (const rel of matches) {
    const clean = rel.replace(/^\.\//, '');
    assert.ok(fs.existsSync(path.join(ROOT, clean)), `Missing sw.js precache file: ${clean}`);
  }
});
