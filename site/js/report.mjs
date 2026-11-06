import { PASS_TYPES, claimDeadline, estimateRefund, isExpired } from './refund.mjs';

export function buildReport({ data, lineCode, passType, price, today }) {
  const pass = PASS_TYPES[passType];
  const refund = estimateRefund(passType, price);
  const rows = data.months.slice(-12).reverse().map((m) => {
    const outcome = pass.scope === 'network' ? m.ivol : m.lines[lineCode];
    const deadline = claimDeadline(m.month, passType, outcome.deadline, m.published ?? null);
    return {
      month: m.month,
      source: m.source,
      qualifies: outcome.qualifies,
      index: outcome.index,
      deadline,
      expired: isExpired(deadline, today),
    };
  });
  // Under 4 € nothing is paid, so no month is claimable.
  const payable = !pass.excluded && refund.status !== 'below-min';
  rows.forEach((r) => { r.claimable = payable && r.qualifies && !r.expired; });
  const claimable = rows.filter((r) => r.claimable).length;
  const open = rows.filter((r) => r.qualifies && !r.expired && !pass.excluded).length;
  // Upper bound: assumes a valid pass in every one of these months at the price typed today.
  const total = refund.status === 'amount' ? Math.round(refund.amount * 100 * claimable) / 100 : null;
  return { pass, refund, rows, claimable, open, payable, total };
}

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function euro(amount) {
  return amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

// What to have ready when claiming: taken from the result so the user can copy it.
export function claimDetails(report, { line, passType, price }) {
  const pass = PASS_TYPES[passType];
  const priced = price > 0 && !pass.integrated && !pass.excluded;
  const months = report.rows.filter((r) => r.claimable)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => `${monthLabel(r.month)} (entro il ${dateLabel(r.deadline)})`);
  const items = [
    ['Abbonamento', priced ? `${pass.label}, ${euro(price)}` : pass.label],
    ['Direttrice', line ? `Dir. ${line.code} – ${line.name}` : 'Intera rete (IVOL)'],
    ['Mesi da indicare', months.join(', ')],
  ];
  return { items, months, text: items.map(([k, v]) => `${k}: ${v}`).join('\n') };
}
