import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isComplete, lastStep, lineChoice, linePlain, linesForStation, needsPrice, parsePrice, stepError } from '../site/js/wizard.mjs';

test('a station on one line picks it automatically', () => {
  assert.deepEqual(linesForStation('Morbegno'), ['07']);
  assert.deepEqual(lineChoice(linesForStation('morbegno')), { auto: '07' });
});

test('a station on several lines asks which one', () => {
  const codes = linesForStation('Lecco');
  assert.ok(codes.length > 1);
  assert.deepEqual(lineChoice(codes), { choose: codes });
});

test('an unknown station lets the user pick the line from the list', () => {
  assert.deepEqual(linesForStation('Atlantide'), []);
  assert.deepEqual(lineChoice([]), { none: true });
});

test('lines are named in plain words', () => {
  assert.deepEqual(linePlain('07'), { full: 'Tirano – Sondrio – Lecco – Milano', ends: 'Tirano – Milano', via: 'via Sondrio e Lecco' });
  assert.equal(linePlain('09').via, '');
  assert.equal(linePlain('99'), null);
});

test('only monthly and annual Trenord passes ask for the price', () => {
  assert.equal(needsPrice('mensile'), true);
  assert.equal(needsPrice('annuale'), true);
  for (const p of ['ivol', 'trenocitta', 'settimanale', 'stibm', 'ivop', 'gratuito']) {
    assert.equal(needsPrice(p), false, p);
    assert.equal(lastStep(p), 2, p);
  }
  assert.equal(lastStep('mensile'), 3);
});

test('steps block until the answer is usable', () => {
  assert.match(stepError(1, { line: '', passType: 'mensile', price: '' }), /stazione o la linea/);
  assert.equal(stepError(1, { line: '07', passType: 'mensile', price: '' }), null);
  assert.match(stepError(3, { line: '07', passType: 'mensile', price: '' }), /prezzo/);
  assert.match(stepError(3, { line: '07', passType: 'mensile', price: '0' }), /prezzo/);
  assert.equal(stepError(3, { line: '07', passType: 'mensile', price: '61,5' }), null);
  assert.equal(stepError(3, { line: '07', passType: 'ivol', price: '' }), null);
  assert.equal(parsePrice('61,50'), 61.5);
  assert.ok(Number.isNaN(parsePrice('abc')));
});

test('saved answers show the result straight away only when complete', () => {
  assert.equal(isComplete({ line: '07', passType: 'mensile', price: '61' }), true);
  assert.equal(isComplete({ line: '07', passType: 'mensile', price: '' }), false);
  assert.equal(isComplete({ line: '', passType: 'ivol', price: '' }), true);
});
