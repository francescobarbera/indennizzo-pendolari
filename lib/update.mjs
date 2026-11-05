import { parseIndennizzo } from './parse.mjs';

export const SOURCE_PAGE = 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/';

export function extractPdfLinks(html, base = SOURCE_PAGE) {
  const links = new Set();
  for (const [, href] of html.matchAll(/href="([^"]*\/INDENNIZZI\/[^"]*\.pdf)"/gi)) {
    links.add(new URL(href, base).href);
  }
  return [...links].sort();
}

export async function collectMonths({ fetchText, pdfToText }) {
  const html = await fetchText(SOURCE_PAGE);
  const links = extractPdfLinks(html);
  if (links.length === 0) throw new Error('Nessun PDF di indennizzo trovato nella pagina');
  const months = [];
  for (const url of links) {
    months.push(parseIndennizzo(await pdfToText(url), url));
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
  fresh.forEach((m) => byMonth.set(m.month, m));
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
