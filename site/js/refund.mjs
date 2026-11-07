export const MIN_PAYOUT = 4;

export const PASS_TYPES = {
  mensile: { label: 'Abbonamento mensile Trenord', scope: 'line', monthsCovered: 1 },
  annuale: { label: 'Abbonamento annuale Trenord', scope: 'line', monthsCovered: 12 },
  trenocitta: { label: 'Abbonamento integrato TrenoCittà', scope: 'line', integrated: true },
  ivol: { label: 'Abbonamento IVOL (Io Viaggio Ovunque in Lombardia)', scope: 'network', integrated: true },
  settimanale: { label: 'Abbonamento settimanale', excluded: true },
  stibm: { label: 'Abbonamento integrato STIBM (area Milano)', excluded: true },
  ivop: { label: 'Abbonamento IVOP (Io Viaggio Ovunque in Provincia)', excluded: true },
  gratuito: { label: 'Abbonamento gratuito o agevolazione a costo zero', excluded: true },
};

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function estimateRefund(passType, price) {
  const pass = PASS_TYPES[passType];
  if (!pass) throw new Error(`Tipo di abbonamento sconosciuto: ${passType}`);
  if (pass.excluded) return { status: 'excluded' };
  if (pass.integrated) return { status: 'integrated' };
  if (!(price > 0)) return { status: 'need-price' };
  const amount = Math.round((Math.round(price * 100) * 30) / (100 * pass.monthsCovered)) / 100;
  return { status: amount < MIN_PAYOUT ? 'below-min' : 'amount', amount };
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Last day of a YYYY-MM month, as YYYY-MM-DD.
export function endOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

// Same day one year later; 29 February becomes 28 February.
export function addYear(date) {
  const [, y, m, d] = date.match(DATE).map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// Last day to ask, YYYY-MM-DD, inclusive.
// - A deadline stated in the PDF (a month) wins: the end of that month.
// - Annual Trenord pass: 12 months from the publication of the month's list.
//   Without a publication date we use the end of M+12, which is never later:
//   the list is always published after the month ends.
// - Monthly passes, TrenoCittà and IVOL: 12 months from the end of validity, so the end of M+12.
//   TrenoCittà and IVOL can be monthly or annual; M+12 is the earlier of the two rules.
export function claimDeadline(month, passType, statedDeadline, published = null) {
  if (statedDeadline) return endOfMonth(statedDeadline);
  const monthly = endOfMonth(addMonths(month, 12));
  return passType === 'annuale' && published ? addYear(published) : monthly;
}

// Today's date in the visitor's local time, YYYY-MM-DD.
export function localDate(today) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function isExpired(deadline, today) {
  return deadline < localDate(today);
}
