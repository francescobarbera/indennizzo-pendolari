import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateRefund, claimDeadline, addMonths, isExpired, PASS_TYPES } from '../site/js/refund.mjs';

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

test('deadlines: monthly 12 months after the month, annual conservative from publication, stated wins', () => {
  assert.equal(addMonths('2025-11', 2), '2026-01');
  assert.equal(claimDeadline('2026-03', 'mensile', null), '2027-03');
  assert.equal(claimDeadline('2026-03', 'annuale', null), '2027-04');
  assert.equal(claimDeadline('2024-07', 'mensile', '2026-10'), '2026-10');
  assert.equal(isExpired('2026-10', new Date('2026-11-05')), true);
  assert.equal(isExpired('2026-11', new Date('2026-11-05')), false);
});
