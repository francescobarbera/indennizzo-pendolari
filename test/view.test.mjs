import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport } from '../site/js/report.mjs';
import { PASS_TYPES } from '../site/js/refund.mjs';
import { PASS_SHORT, barWidth, deadlineInfo, monthParts, percent, tileState, worstMonth } from '../site/js/view.mjs';

const data = JSON.parse(readFileSync(new URL('./fixtures/indennizzi-2026-11.json', import.meta.url), 'utf8'));
const today = new Date('2026-11-05T10:00:00Z');

test('deadline countdown uses the earliest claimable month, end of month', () => {
  const r = buildReport({ data, lineCode: '07', passType: 'mensile', price: 61, today });
  const d = deadlineInfo(r, today);
  assert.equal(d.row.month, '2025-11');
  assert.equal(d.row.deadline, '2026-11');
  assert.equal(d.days, 25);
  assert.equal(d.urgent, true);
  assert.equal(d.others, 5);
  assert.equal(d.otherFrom, '2026-12');
  assert.equal(d.otherTo, '2027-08');
});

test('no countdown for excluded passes or lines with nothing claimable', () => {
  assert.equal(deadlineInfo(buildReport({ data, lineCode: '07', passType: 'settimanale', price: 20, today }), today), null);
  const none = { pass: PASS_TYPES.mensile, rows: [{ qualifies: true, expired: true, deadline: '2025-01' }] };
  assert.equal(deadlineInfo(none, today), null);
});

test('month tiles: states, bars and labels', () => {
  assert.equal(tileState({ qualifies: true, expired: false }), 'yes');
  assert.equal(tileState({ qualifies: true, expired: true }), 'expired');
  assert.equal(tileState({ qualifies: false, expired: true }), 'no');
  assert.equal(barWidth(10), 50);
  assert.equal(barWidth(35), 100);
  assert.equal(barWidth(-1), 0);
  assert.deepEqual(monthParts('2026-08'), { abbr: 'ago', year: '2026' });
  assert.equal(percent(12.61), '12,61%');
  assert.equal(worstMonth([{ index: 7.5, qualifies: false }, { index: 12, qualifies: true }, { index: null, qualifies: false }]).index, 7.5);
  assert.equal(worstMonth([{ index: null, qualifies: false }]), null);
  assert.deepEqual(Object.keys(PASS_SHORT).sort(), Object.keys(PASS_TYPES).sort());
});
