import { LINE_CODES as CODES } from '../site/js/lines.mjs';

const LINE_CODES = [...CODES];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function checkOutcome(o, where, problems) {
  if (!o || typeof o.qualifies !== 'boolean') problems.push(`${where}: esito mancante`);
  else if (!(o.index === null || Number.isFinite(o.index))) problems.push(`${where}: indice non valido`);
  else if (!(o.deadline === null || MONTH.test(o.deadline))) problems.push(`${where}: scadenza non valida`);
}

export function validateData(data) {
  const problems = [];
  if (!data || !Array.isArray(data.months) || data.months.length === 0) return ['nessun mese nei dati'];
  let previous = '';
  for (const m of data.months) {
    if (!MONTH.test(m.month)) { problems.push(`mese non valido: ${m.month}`); continue; }
    if (m.month <= previous) problems.push(`mesi non ordinati o duplicati: ${m.month}`);
    previous = m.month;
    let url;
    try { url = new URL(m.source); } catch { url = null; }
    if (!url || url.protocol !== 'https:' || url.hostname !== 'www.trenord.it') problems.push(`${m.month}: fonte non Trenord`);
    for (const code of LINE_CODES) checkOutcome(m.lines?.[code], `${m.month} Dir. ${code}`, problems);
    const extra = Object.keys(m.lines ?? {}).filter((c) => !LINE_CODES.includes(c));
    if (extra.length) problems.push(`${m.month}: direttrici sconosciute ${extra.join(', ')}`);
    checkOutcome(m.ivol, `${m.month} IVOL`, problems);
  }
  return problems;
}

export function assertValidData(data) {
  const problems = validateData(data);
  if (problems.length) throw new Error(`Dati non validi: ${problems.slice(0, 5).join('; ')}`);
}
