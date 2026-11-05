import { LINE_CODES } from '../site/js/lines.mjs';

const MONTHS = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO',
  'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
const MONTH_RE = new RegExp(`\\b(${MONTHS.join('|')})\\s+(20\\d{2})\\b`, 'i');
const DEADLINE_RE = new RegExp(`entro\\s+(${MONTHS.join('|')})\\s+(20\\d{2})`, 'i');

export class ParseError extends Error {}

function ym(monthName, year) {
  const m = MONTHS.indexOf(monthName.toUpperCase()) + 1;
  return `${year}-${String(m).padStart(2, '0')}`;
}

function parseMonth(text) {
  const header = text.split('\n').slice(0, 15).join('\n');
  const found = header.match(MONTH_RE);
  if (!found) throw new ParseError('Mese di riferimento non trovato');
  return ym(found[1], found[2]);
}

function emptyLines() {
  return Object.fromEntries([...LINE_CODES].map((c) => [c, { qualifies: false, index: null, deadline: null }]));
}

function bulletItems(text) {
  const items = [];
  let open = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('•')) {
      items.push(line.replace(/^•\s*/, ''));
      open = true;
    } else if (open && /^(\d{4}\b|[a-z])/.test(line)) {
      items[items.length - 1] += ` ${line}`;
    } else {
      open = false;
    }
  }
  return items;
}

function deadlineOf(item) {
  const d = item.match(DEADLINE_RE);
  return d ? ym(d[1], d[2]) : null;
}

function parseList(text) {
  const lines = emptyLines();
  const ivol = { qualifies: false, index: null, deadline: null };
  const items = bulletItems(text);
  if (items.length === 0) throw new ParseError('Elenco direttrici vuoto o non riconosciuto');
  for (const item of items) {
    const dir = item.match(/^Dir\.\s*(\d{1,2})\b/);
    if (dir) {
      const code = dir[1].padStart(2, '0');
      if (!LINE_CODES.has(code)) throw new ParseError(`Direttrice sconosciuta: ${code}`);
      lines[code] = { qualifies: true, index: null, deadline: deadlineOf(item) };
    } else if (/^IVOL\b/.test(item)) {
      Object.assign(ivol, { qualifies: true, deadline: deadlineOf(item) });
    } else if (!/^IVOP\b/.test(item)) {
      throw new ParseError(`Voce non riconosciuta: ${item.slice(0, 60)}`);
    }
  }
  return { format: 'elenco', lines, ivol };
}

function toIndex(value) {
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n)) throw new ParseError(`Indice non numerico: ${value}`);
  return n;
}

function checkConsistent(label, index, qualifies) {
  if ((qualifies && index < 10) || (!qualifies && index > 10)) {
    throw new ParseError(`Indice ${index} incoerente con esito per ${label}`);
  }
}

function parseTable(text) {
  const lines = {};
  let ivol = null;
  const row = /^\s*(\d{2})\s{2,}.*?\s(\d{1,3},\d{2})\s+(SI|NO)\s*$/i;
  const tot = /^\s*Tot\s.*?\s(\d{1,3},\d{2})\s+(SI|NO)\s*$/i;
  for (const raw of text.split('\n')) {
    const r = raw.match(row);
    if (r) {
      if (!LINE_CODES.has(r[1])) throw new ParseError(`Direttrice sconosciuta: ${r[1]}`);
      const index = toIndex(r[2]);
      const qualifies = r[3].toUpperCase() === 'SI';
      checkConsistent(r[1], index, qualifies);
      lines[r[1]] = { qualifies, index, deadline: null };
      continue;
    }
    const t = raw.match(tot);
    if (t) {
      const index = toIndex(t[1]);
      const qualifies = t[2].toUpperCase() === 'SI';
      checkConsistent('IVOL', index, qualifies);
      ivol = { qualifies, index, deadline: null };
    }
  }
  const missing = [...LINE_CODES].filter((c) => !lines[c]);
  if (missing.length) throw new ParseError(`Tabella incompleta, mancano: ${missing.join(', ')}`);
  if (!ivol) throw new ParseError('Riga totale rete (IVOL) mancante');
  return { format: 'tabella', lines, ivol };
}

export function parseIndennizzo(text, source) {
  if (!text || !text.trim()) throw new ParseError('Testo PDF vuoto');
  const month = parseMonth(text);
  const body = /Indice\s+Indennizzo/i.test(text) ? parseTable(text) : parseList(text);
  return { month, source, ...body };
}
