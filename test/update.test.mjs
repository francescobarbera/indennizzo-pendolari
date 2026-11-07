import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectMonths, extractPdfLinks, mergeData, publishedDate, SOURCE_PAGE } from '../lib/update.mjs';

const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const PAGE = `<a href="/fileadmin/x/INDENNIZZI/2026/TABELLA_B_MARZO_26.pdf">m</a>
<a href="/fileadmin/x/INDENNIZZI/2025/251218_IndennizzoOttobre.pdf">o</a>
<a href="/fileadmin/x/Reclami/Modulo.pdf">form</a>
<a href="https://evil.example/INDENNIZZI/x.pdf">evil</a>
<a href="http://www.trenord.it/INDENNIZZI/plain.pdf">plain</a>
<a href="data:application/pdf,/INDENNIZZI/x.pdf">data</a>`;
const TEXTS = { 'TABELLA_B_MARZO_26.pdf': 'TABELLA_B_MARZO_26.txt', '251218_IndennizzoOttobre.pdf': '251218_IndennizzoOttobre.txt' };
const deps = (texts = TEXTS) => ({
  fetchText: async (url) => { assert.equal(url, SOURCE_PAGE); return PAGE; },
  pdfToText: async (url) => fixture(texts[url.split('/').pop()]),
});

test('extracts only https www.trenord.it indennizzo PDFs with irregular names as absolute URLs', () => {
  assert.deepEqual(extractPdfLinks(PAGE), [
    'https://www.trenord.it/fileadmin/x/INDENNIZZI/2025/251218_IndennizzoOttobre.pdf',
    'https://www.trenord.it/fileadmin/x/INDENNIZZI/2026/TABELLA_B_MARZO_26.pdf',
  ]);
});

test('collects every linked month with its source URL', async () => {
  const months = await collectMonths(deps());
  assert.deepEqual(months.map((m) => m.month), ['2025-10', '2026-03']);
  assert.match(months[1].source, /TABELLA_B_MARZO_26\.pdf$/);
});

test('one unparseable PDF fails the whole run', async () => {
  const d = deps();
  d.pdfToText = async (url) => (url.includes('MARZO') ? '<html>503</html>' : fixture(TEXTS[url.split('/').pop()]));
  await assert.rejects(collectMonths(d), /Mese di riferimento/);
});

test('a page with no PDFs or two PDFs for one month fails', async () => {
  await assert.rejects(collectMonths({ fetchText: async () => '<p>vuoto</p>', pdfToText: async () => '' }), /Nessun PDF/);
  const d = deps();
  d.pdfToText = async () => fixture('TABELLA_B_MARZO_26.txt');
  await assert.rejects(collectMonths(d), /presente in due PDF/);
});

test('merge keeps old months, replaces republished ones and only bumps the date on change', () => {
  const old = { updatedAt: '2026-01-01T00:00:00.000Z', months: [{ month: '2024-01', x: 1 }, { month: '2024-02', x: 1 }] };
  const now = new Date('2026-11-05T06:00:00Z');
  const { changed, data } = mergeData(old, [{ month: '2024-02', x: 2 }], now);
  assert.equal(changed, true);
  assert.deepEqual(data.months, [{ month: '2024-01', x: 1 }, { month: '2024-02', x: 2 }]);
  assert.equal(data.updatedAt, now.toISOString());
  const same = mergeData(data, [{ month: '2024-02', x: 2 }], new Date());
  assert.equal(same.changed, false);
  assert.equal(same.data.updatedAt, now.toISOString());
});

test('publication date: earliest of Last-Modified and PDF CreationDate, in Italian time', () => {
  assert.equal(publishedDate('2025-10', ['Fri, 19 Dec 2025 09:00:00 GMT', '2025-12-18T23:30:00+01:00']), '2025-12-18');
  assert.equal(publishedDate('2025-10', ['Thu, 18 Dec 2025 23:30:00 GMT']), '2025-12-19');
  assert.equal(publishedDate('2025-10', []), null);
  assert.equal(publishedDate('2025-10', ['not a date']), null);
});

test('publication date: a date inside the month is ignored, a re-upload months later gives no date', () => {
  assert.equal(publishedDate('2025-10', ['2025-10-20T10:00:00Z', '2025-12-19T10:00:00Z']), '2025-12-19');
  assert.equal(publishedDate('2025-10', ['2026-02-01T10:00:00Z']), null);
  assert.equal(publishedDate('2025-10', ['2026-01-31T10:00:00Z']), '2026-01-31');
});

test('collect stores the publication date when pdfToText returns dates', async () => {
  const d = deps();
  d.pdfToText = async (url) => ({ text: fixture(TEXTS[url.split('/').pop()]), dates: url.includes('Ottobre') ? ['Fri, 19 Dec 2025 09:00:00 GMT'] : [] });
  const months = await collectMonths(d);
  assert.equal(months[0].published, '2025-12-19');
  assert.equal('published' in months[1], false);
});

test('merge keeps the earliest known publication date so a re-upload never moves a deadline later', () => {
  const old = { updatedAt: 'x', months: [{ month: '2025-10', x: 1, published: '2025-12-19' }] };
  const later = mergeData(old, [{ month: '2025-10', x: 1, published: '2026-01-10' }], new Date());
  assert.equal(later.data.months[0].published, '2025-12-19');
  assert.equal(later.changed, false);
  const none = mergeData(old, [{ month: '2025-10', x: 1 }], new Date());
  assert.equal(none.data.months[0].published, '2025-12-19');
});
