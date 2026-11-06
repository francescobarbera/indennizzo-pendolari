import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateRefund, claimDeadline, addMonths, isExpired, PASS_TYPES, endOfMonth, addYear } from '../site/js/refund.mjs';

test('monthly pass refund is 30% of the price', () => {
  assert.deepEqual(estimateRefund('mensile', 61), { status: 'amount', amount: 18.3 });
});

test('annual pass refund is 30% of one twelfth', () => {
  assert.deepEqual(estimateRefund('annuale', 585), { status: 'amount', amount: 14.63 });
});

test('amounts under 4 euro are not paid', () => {
  assert.deepEqual(estimateRefund('mensile', 13), { status: 'below-min', amount: 3.9 });
  assert.equal(estimateRefund('mensile', 13.34).status, 'amount');
});

test('excluded and integrated passes are flagged, missing price asks for it', () => {
  for (const t of ['settimanale', 'stibm', 'ivop', 'gratuito']) assert.equal(estimateRefund(t, 50).status, 'excluded');
  assert.equal(estimateRefund('trenocitta', 50).status, 'integrated');
  assert.equal(estimateRefund('ivol', 50).status, 'integrated');
  assert.equal(PASS_TYPES.ivol.scope, 'network');
  assert.equal(estimateRefund('mensile', 0).status, 'need-price');
  assert.throws(() => estimateRefund('boh', 1));
});

test('deadlines: monthly 12 months after the end of the month, annual 12 months from publication, stated wins', () => {
  assert.equal(addMonths('2025-11', 2), '2026-01');
  assert.equal(claimDeadline('2026-03', 'mensile', null), '2027-03-31');
  assert.equal(claimDeadline('2024-07', 'mensile', '2026-10'), '2026-10-31');
  assert.equal(claimDeadline('2025-10', 'annuale', '2026-10', '2025-12-19'), '2026-10-31');
  assert.equal(isExpired('2026-11-04', new Date(2026, 10, 5)), true);
  assert.equal(isExpired('2026-11-05', new Date(2026, 10, 5)), false);
});

test('IVOL and TrenoCittà follow the monthly rule: January 2026 IVOL expires at the end of January 2027', () => {
  assert.equal(claimDeadline('2026-01', 'ivol', null), '2027-01-31');
  assert.equal(claimDeadline('2026-01', 'trenocitta', null), '2027-01-31');
  assert.equal(claimDeadline('2026-02', 'ivol', null), '2027-02-28');
});

test('annual: 12 months from the PDF publication date (October 2025 published 19/12/2025 expires 19/12/2026)', () => {
  assert.equal(claimDeadline('2025-10', 'annuale', null, '2025-12-19'), '2026-12-19');
  assert.equal(claimDeadline('2023-12', 'annuale', null, '2024-02-29'), '2025-02-28');
});

test('annual without a publication date uses the earlier end of M+12, never a later date', () => {
  assert.equal(claimDeadline('2025-10', 'annuale', null), '2026-10-31');
  assert.ok(claimDeadline('2025-10', 'annuale', null) < claimDeadline('2025-10', 'annuale', null, '2025-11-01'));
});

test('date helpers', () => {
  assert.equal(endOfMonth('2028-02'), '2028-02-29');
  assert.equal(addYear('2025-12-19'), '2026-12-19');
});
