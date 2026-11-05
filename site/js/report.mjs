import { PASS_TYPES, claimDeadline, estimateRefund, isExpired } from './refund.mjs';

export function buildReport({ data, lineCode, passType, price, today }) {
  const pass = PASS_TYPES[passType];
  const refund = estimateRefund(passType, price);
  const rows = data.months.slice(-12).reverse().map((m) => {
    const outcome = pass.scope === 'network' ? m.ivol : m.lines[lineCode];
    const deadline = claimDeadline(m.month, passType, outcome.deadline);
    return {
      month: m.month,
      source: m.source,
      qualifies: outcome.qualifies,
      index: outcome.index,
      deadline,
      expired: isExpired(deadline, today),
    };
  });
  const claimable = rows.filter((r) => r.qualifies && !r.expired && !pass.excluded);
  const total = refund.status === 'amount' ? Math.round(refund.amount * 100 * claimable.length) / 100 : null;
  return { pass, refund, rows, claimable: claimable.length, total };
}

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function euro(amount) {
  return amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
