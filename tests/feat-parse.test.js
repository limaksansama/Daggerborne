import test from 'node:test';
import assert from 'node:assert/strict';
import { featParse } from '../js/feat-parse.js';

test('featParse détecte les coûts en français', () => {
  assert.deepEqual(featParse('Dépensez un Espoir pour relancer le dé.').hope, 1);
  assert.deepEqual(featParse('Dépensez 2 Espoirs pour agir.').hope, 2);
  assert.deepEqual(featParse('Cochez un Stress pour activer.').stress, 1);
  assert.deepEqual(featParse('Marquez 3 Stress pour résister.').stress, 3);
  assert.equal(featParse('Une fois par repos, lancez un d6.').perRest, true);
  assert.equal(featParse('Une fois par long repos, lancez un D6.').perLong, true);
  assert.equal(featParse('Lancez un D6 et un d10.').dice, '1d6 + 1d10');
});

test('featParse détecte les coûts en anglais', () => {
  assert.deepEqual(featParse('Spend a Hope to reroll.').hope, 1);
  assert.deepEqual(featParse('Spend 3 Hope to act.').hope, 3);
  assert.deepEqual(featParse('Mark a Stress to activate.').stress, 1);
  assert.deepEqual(featParse('Mark 2 Stress to resist.').stress, 2);
  assert.equal(featParse('Once per rest, roll a d6.').perRest, true);
  assert.equal(featParse('Once per long rest, roll a D6.').perLong, true);
  assert.equal(featParse('Roll 2d6+3, then 1d8.').dice, '2d6+3 + 1d8');
});

test('featParse ne confond pas les nombres avec un coût absent', () => {
  assert.deepEqual(featParse('Vous pouvez courir trois fois par session.'), {});
  assert.deepEqual(featParse(''), {});
});
