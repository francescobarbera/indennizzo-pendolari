import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const PAGES = ['index.html', 'come-richiedere/index.html', 'regole/index.html', 'privacy/index.html'];
const read = (p) => readFileSync(new URL(`../site/${p}`, import.meta.url), 'utf8');

test('every page is Italian, mobile-ready and carries the disclaimer and official link', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<html lang="it">/, page);
    assert.match(html, /name="viewport"/, page);
    assert.match(html, /non affiliato a Trenord/, page);
    assert.match(html, /trenord\.it\/assistenza\/servizi\/rimborsi-e-indennizzi\/indennizzo-per-ritardi\//, page);
  }
});

test('the FAQ explains threshold versus refund', () => {
  assert.match(read('regole/index.html'), /La soglia è il 10%.*Il 30% è il rimborso/s);
});

test('email alerts are only a disabled placeholder', () => {
  const html = read('index.html');
  assert.match(html, /<button type="button" disabled>Presto disponibile<\/button>/);
  assert.doesNotMatch(html, /type="email"/);
});

test('the check page stays light: no third-party scripts and small assets', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  const files = ['index.html', 'style.css', 'js/app.mjs', 'js/lines.mjs', 'js/refund.mjs', 'js/stations.mjs', 'js/report.mjs'];
  const bytes = files.reduce((n, f) => n + statSync(new URL(`../site/${f}`, import.meta.url)).size, 0)
    + statSync(new URL('../data/indennizzi.json', import.meta.url)).size;
  assert.ok(bytes < 300_000, `${bytes} bytes`);
});
