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

export function claimDeadline(month, passType, statedDeadline) {
  if (statedDeadline) return statedDeadline;
  return addMonths(month, passType === 'mensile' || passType === 'trenocitta' ? 12 : 14);
}

export function isExpired(deadline, today) {
  return deadline < today.toISOString().slice(0, 7);
}
