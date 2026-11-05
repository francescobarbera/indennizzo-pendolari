// Pure helpers for the result ticket (no DOM), testable in node.
export const PASS_SHORT = {
  mensile: 'Mensile', annuale: 'Annuale', trenocitta: 'TrenoCittà', ivol: 'IVOL',
  settimanale: 'Settimanale', stibm: 'STIBM', ivop: 'IVOP', gratuito: 'Gratuito',
};

const MONTH_ABBR = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const DAY = 86_400_000;

export function monthParts(month) {
  const [y, m] = month.split('-').map(Number);
  return { abbr: MONTH_ABBR[m - 1], year: String(y) };
}

export function percent(index, digits = 2) {
  return `${index.toLocaleString('it-IT', { maximumFractionDigits: digits })}%`;
}

// Bars run from 0 to 20%, so the 10% threshold sits in the middle.
export function barWidth(index) {
  return Math.max(0, Math.min(index, 20)) / 20 * 100;
}

export function tileState(row) {
  if (!row.qualifies) return 'no';
  return row.expired ? 'expired' : 'yes';
}

export function worstMonth(rows) {
  return rows.filter((r) => r.index !== null && !r.qualifies)
    .reduce((best, r) => (!best || r.index > best.index ? r : best), null);
}

// Earliest still-claimable deadline (end of that month) and the days left from today.
export function deadlineInfo(report, today) {
  if (report.pass.excluded) return null;
  const open = report.rows.filter((r) => r.qualifies && !r.expired)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  if (!open.length) return null;
  const [first, ...others] = open;
  const [y, m] = first.deadline.split('-').map(Number);
  const end = Date.UTC(y, m, 0);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.max(0, Math.round((end - start) / DAY));
  return {
    row: first,
    days,
    urgent: days <= 60,
    others: others.length,
    otherFrom: others[0]?.deadline ?? null,
    otherTo: others.at(-1)?.deadline ?? null,
  };
}
