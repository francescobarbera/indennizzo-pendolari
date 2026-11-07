import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport, claimDetails, monthLabel } from '../site/js/report.mjs';

const data = JSON.parse(readFileSync(new URL('./fixtures/indennizzi-2026-11.json', import.meta.url), 'utf8'));
const today = new Date('2026-11-05T10:00:00Z');

test('Morbegno monthly pass: last 12 months, 8 qualifying, 6 still claimable at 18,30 € each', () => {
  const r = buildReport({ data, lineCode: '07', passType: 'mensile', price: 61, today });
  assert.equal(r.rows.length, 12);
  assert.equal(r.rows[0].month, '2026-08');
  assert.equal(r.rows.filter((x) => x.qualifies).length, 8);
  assert.equal(r.claimable, 6);
  assert.deepEqual(r.rows.filter((x) => x.expired && x.qualifies).map((x) => x.month), ['2025-10', '2025-09']);
  assert.equal(r.total, 109.8);
  assert.equal(r.rows[0].index, 12.61);
});

test('IVOL uses the whole-network outcome', () => {
  const r = buildReport({ data, lineCode: '', passType: 'ivol', price: 0, today });
  assert.equal(r.rows.find((x) => x.month === '2026-01').qualifies, true);
  assert.equal(r.rows.find((x) => x.month === '2026-03').index, 5.13);
  assert.equal(r.total, null);
});

test('excluded passes have nothing claimable', () => {
  const r = buildReport({ data, lineCode: '07', passType: 'settimanale', price: 20, today });
  assert.equal(r.claimable, 0);
});

test('month labels are Italian', () => {
  assert.equal(monthLabel('2026-08'), 'agosto 2026');
});

test('claim details list pass, line and the claimable months oldest first, ready to copy', () => {
  const line = { code: '07', name: 'Lecco–Sondrio–Tirano' };
  const r = buildReport({ data, lineCode: '07', passType: 'mensile', price: 61, today });
  const d = claimDetails(r, { line, passType: 'mensile', price: 61 });
  assert.deepEqual(d.items.map(([k]) => k), ['Abbonamento', 'Direttrice', 'Mesi indennizzabili']);
  assert.match(d.items[0][1], /^Abbonamento mensile Trenord, 61,00\s€$/);
  assert.equal(d.items[1][1], 'Dir. 07 – Lecco–Sondrio–Tirano');
  const months = d.items[2][1].split(', ');
  assert.equal(months.length, r.claimable);
  assert.deepEqual(d.months, months);
  assert.deepEqual(d.months, months);
  assert.match(months[0], /^novembre 2025 \(entro il /);
  assert.match(months.at(-1), /^agosto 2026 \(entro il 31 agosto 2027\)$/);
  assert.equal(d.text.split('\n').length, 3);
});

test('claim details for IVOL name the whole network and no price', () => {
  const r = buildReport({ data, lineCode: '', passType: 'ivol', price: 0, today });
  const d = claimDetails(r, { line: null, passType: 'ivol', price: 0 });
  assert.equal(d.items[0][1], 'Abbonamento IVOL (Io Viaggio Ovunque in Lombardia)');
  assert.equal(d.items[1][1], 'Intera rete (IVOL)');
});
