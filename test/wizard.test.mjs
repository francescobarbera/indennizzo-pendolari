import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isComplete, lastStep, lineChoice, linePlain, linesForStation, needsPrice, offerLineList, parsePrice, pricePlaceholder, priceUnit, stepError } from '../site/js/wizard.mjs';

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

test('the line list is offered only when the station search finds nothing', () => {
  assert.equal(offerLineList({ station: '' }), false);
  assert.equal(offerLineList({ station: 'Mo' }), false, 'suggestions to pick from');
  assert.equal(offerLineList({ station: 'Morbeg' }), false, 'partial name with matches');
  assert.equal(offerLineList({ station: 'Morbegno', line: '07' }), false);
  assert.equal(offerLineList({ station: 'Atlantide' }), true);
  assert.equal(offerLineList({ station: 'x' }), false, 'one letter is not a search yet');
  // Going on with an empty or one-letter box is a search with no results.
  assert.equal(offerLineList({ station: '', submitted: true }), true);
  assert.equal(offerLineList({ station: 'x', submitted: true }), true);
  assert.equal(offerLineList({ station: 'Morbeg', submitted: true }), false);
  // A line already picked from the list keeps the list visible so it can be changed.
  assert.equal(offerLineList({ station: '', line: '07' }), true);
  assert.equal(offerLineList({ station: 'Lecco', line: linesForStation('Lecco')[0] }), false);
});

test('the price box says which period the amount is for', () => {
  assert.equal(priceUnit('mensile'), '€ al mese');
  assert.equal(priceUnit('annuale'), '€ all’anno');
});

test('the price example follows the pass type', () => {
  assert.equal(pricePlaceholder('mensile'), 'Es. 61');
  assert.equal(pricePlaceholder('annuale'), 'Es. 585');
  // Integrated/excluded passes still skip the price step.
  for (const t of ['mensile', 'annuale']) assert.equal(needsPrice(t), true);
});
