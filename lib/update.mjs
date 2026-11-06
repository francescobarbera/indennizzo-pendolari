import { parseIndennizzo } from './parse.mjs';

export const SOURCE_PAGE = 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/';

export function extractPdfLinks(html, base = SOURCE_PAGE) {
  const links = new Set();
  for (const [, href] of html.matchAll(/href="([^"]*\/INDENNIZZI\/[^"]*\.pdf)"/gi)) {
    const url = new URL(href, base);
    if (url.protocol === 'https:' && url.hostname === 'www.trenord.it') links.add(url.href);
  }
  return [...links].sort();
}

// Calendar date in Italy (YYYY-MM-DD) of an HTTP or PDF timestamp.
export function romeDate(value) {
  const t = new Date(value);
  if (!value || Number.isNaN(t.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
}

// Publication date of a month's PDF: the earliest of its timestamps (HTTP Last-Modified, PDF CreationDate).
// A date inside the month itself is impossible and is ignored. A date more than three months
// after the month suggests a later re-upload, which would push the annual deadline too far:
// then we return null and the site falls back to the earlier deadline.
export function publishedDate(month, values) {
  const [y, m] = month.split('-').map(Number);
  const after = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const latest = new Date(Date.UTC(y, m + 3, 0)).toISOString().slice(0, 10);
  const dates = values.map(romeDate).filter((d) => d && d >= after).sort();
  return dates[0] && dates[0] <= latest ? dates[0] : null;
}

export async function collectMonths({ fetchText, pdfToText }) {
  const html = await fetchText(SOURCE_PAGE);
  const links = extractPdfLinks(html);
  if (links.length === 0) throw new Error('Nessun PDF di indennizzo trovato nella pagina');
  const months = [];
  for (const url of links) {
    const out = await pdfToText(url);
    const { text, dates = [] } = typeof out === 'string' ? { text: out } : out;
    const month = parseIndennizzo(text, url);
    const published = publishedDate(month.month, dates);
    months.push(published ? { ...month, published } : month);
  }
  const seen = new Map();
  for (const m of months) {
    if (seen.has(m.month)) throw new Error(`Mese ${m.month} presente in due PDF: ${seen.get(m.month)} e ${m.source}`);
    seen.set(m.month, m.source);
  }
  return months;
}

export function mergeData(previous, fresh, now) {
  const byMonth = new Map((previous?.months ?? []).map((m) => [m.month, m]));
  fresh.forEach((m) => {
    // Keep the earliest known publication date: a re-upload must never move a deadline later.
    const known = [byMonth.get(m.month)?.published, m.published].filter(Boolean).sort()[0];
    byMonth.set(m.month, known ? { ...m, published: known } : m);
  });
  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const changed = JSON.stringify(months) !== JSON.stringify(previous?.months ?? []);
  return {
    changed,
    data: {
      sourcePage: SOURCE_PAGE,
      updatedAt: changed ? now.toISOString() : previous.updatedAt,
      months,
    },
  };
}
