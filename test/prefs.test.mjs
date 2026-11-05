import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFS_KEY, MAIN_PASSES, OTHER_PASSES, passChoice, passFromChoice, sanitizePrefs, loadPrefs, savePrefs, browserStorage,
} from '../site/js/prefs.mjs';
import { PASS_TYPES } from '../site/js/refund.mjs';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

const throwing = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
};

test('prefs round-trip through storage', () => {
  const s = fakeStorage();
  const prefs = { station: 'Morbegno', line: '07', pass: 'annuale', price: '585' };
  assert.equal(savePrefs(s, prefs), true);
  assert.ok(s.map.has(PREFS_KEY));
  assert.deepEqual(loadPrefs(s), prefs);
});

test('nothing saved yet gives null', () => {
  assert.equal(loadPrefs(fakeStorage()), null);
  assert.equal(loadPrefs(null), null);
});

test('storage errors and corrupt data never throw', () => {
  assert.equal(loadPrefs(throwing), null);
  assert.equal(savePrefs(throwing, { line: '07' }), false);
  assert.equal(savePrefs(null, { line: '07' }), false);
  assert.equal(loadPrefs(fakeStorage({ [PREFS_KEY]: '{not json' })), null);
  assert.equal(typeof browserStorage, 'function');
});

test('restored values are sanitised', () => {
  const s = fakeStorage({ [PREFS_KEY]: JSON.stringify({ station: `  ${'x'.repeat(200)}`, line: '99', pass: 'constructor', price: '61,5' }) });
  const p = loadPrefs(s);
  assert.equal(p.station.length, 80);
  assert.equal(p.line, '');
  assert.equal(p.pass, 'mensile');
  assert.equal(p.price, '61.5');
  assert.equal(sanitizePrefs({ price: '-3' }).price, '');
  assert.equal(sanitizePrefs({ price: 'abc' }).price, '');
  assert.equal(sanitizePrefs({ price: 61 }).price, '61');
  assert.deepEqual(sanitizePrefs(null), { station: '', line: '', pass: 'mensile', price: '' });
});

test('pass picker: Mensile and Annuale are the main buttons, the rest is under "altro"', () => {
  assert.deepEqual(MAIN_PASSES, ['mensile', 'annuale']);
  assert.deepEqual(OTHER_PASSES, ['trenocitta', 'ivol', 'settimanale', 'stibm', 'ivop', 'gratuito']);
  assert.deepEqual([...MAIN_PASSES, ...OTHER_PASSES].sort(), Object.keys(PASS_TYPES).sort());
  assert.equal(passChoice('mensile'), 'mensile');
  assert.equal(passChoice('annuale'), 'annuale');
  for (const k of OTHER_PASSES) assert.equal(passChoice(k), 'altro', k);
  assert.equal(passChoice('nope'), 'mensile');
  assert.equal(passFromChoice('mensile', 'ivol'), 'mensile');
  assert.equal(passFromChoice('annuale', 'mensile'), 'annuale');
  assert.equal(passFromChoice('altro', 'ivol'), 'ivol');
  assert.equal(passFromChoice('altro', 'mensile'), 'trenocitta');
  assert.equal(passFromChoice('bogus', 'ivol'), 'mensile');
});
