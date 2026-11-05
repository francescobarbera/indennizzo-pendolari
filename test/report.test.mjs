import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport, monthLabel } from '../site/js/report.mjs';

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
