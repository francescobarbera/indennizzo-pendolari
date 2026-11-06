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
  const files = ['index.html', 'style.css', 'js/app.mjs', 'js/lines.mjs', 'js/refund.mjs', 'js/stations.mjs', 'js/report.mjs',
    'js/prefs.mjs', 'js/view.mjs'];
  const bytes = files.reduce((n, f) => n + statSync(new URL(`../site/${f}`, import.meta.url)).size, 0);
  assert.ok(bytes < 100_000, `${bytes} bytes`);
});

test('station suggestions are plain buttons with a live result count', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /role="listbox"/);
  assert.match(html, /id="station-count"[^>]*aria-live="polite"/);
  assert.doesNotMatch(read('js/app.mjs'), /role', 'option'/);
});

test('the display font is self-hosted and small', () => {
  const font = new URL('../site/fonts/bricolage-latin.woff2', import.meta.url);
  const size = statSync(font).size;
  assert.ok(size > 0 && size < 40_000, `${size} bytes`);
  assert.equal(readFileSync(font).subarray(0, 4).toString('latin1'), 'wOF2');
  const css = read('style.css');
  assert.match(css, /@font-face\s*\{[^}]*url\(fonts\/bricolage-latin\.woff2\)[^}]*font-display:\s*swap/);
});

test('no page or stylesheet loads fonts, styles or scripts from another origin', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.doesNotMatch(html, /<script[^>]+src="(https?:)?\/\//, page);
    assert.doesNotMatch(html, /<link[^>]+href="(https?:)?\/\//, page);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/, page);
    assert.doesNotMatch(html, /<style/, page);
  }
  const css = read('style.css');
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /url\(\s*["']?(https?:)?\/\//);
});

test('every animation is switched off for reduced motion', () => {
  const css = read('style.css');
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none\s*!important;\s*transition:\s*none\s*!important/);
  const outside = css.replace(/@media \(prefers-reduced-motion:\s*no-preference\)\{(?:[^{}]*\{[^}]*\})*\s*\}/, '');
  assert.doesNotMatch(outside.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, ''), /[{;]\s*animation:\s*(?!none)/);
});

test('privacy page explains that choices stay in localStorage on the device', () => {
  const html = read('privacy/index.html');
  assert.match(html, /localStorage/);
  assert.match(html, /mai inviate/);
  assert.match(html, /cancellando i dati del sito/);
});

test('pass picker: Mensile and Annuale buttons, the rest under "altro"', () => {
  const html = read('index.html');
  assert.match(html, /<input type="radio" name="pass-kind" value="mensile" checked>/);
  assert.match(html, /<input type="radio" name="pass-kind" value="annuale">/);
  assert.match(html, /<details class="more"[^>]*>\s*<summary>[^<]*altro/);
  assert.match(html, /<label for="pass">/);
  for (const id of ['station', 'line', 'pass', 'price']) assert.match(html, new RegExp(`<label for="${id}">`), id);
});

test('the current page is marked in the navigation and the CTA keeps the official form URL', () => {
  const current = { 'index.html': '"">Verifica', 'come-richiedere/index.html': 'come-richiedere/" aria-current', 'regole/index.html': 'regole/" aria-current', 'privacy/index.html': 'privacy/" aria-current' };
  for (const [page, needle] of Object.entries(current)) {
    const html = read(page);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, page);
    if (page !== 'index.html') assert.ok(html.includes(needle), page);
  }
  assert.match(read('index.html'), /<a href="" aria-current="page"[^>]*>Verifica<\/a>/);
  assert.match(read('js/app.mjs'), /https:\/\/www\.trenord\.it\/store\/#\/it\/auth\/login/);
  assert.match(read('js/app.mjs'), /modulo ufficiale Trenord/);
});

test('result rendering writes text, never HTML', () => {
  for (const f of ['js/app.mjs', 'js/prefs.mjs', 'js/view.mjs']) assert.doesNotMatch(read(f), /innerHTML|outerHTML|insertAdjacentHTML/, f);
});

const NEW_TAB = /target="_blank"/;
const SAFE_REL = /rel="noopener noreferrer"/;

const EXTERNAL = /href="https?:\/\//;

test('external links open in a new tab with noopener noreferrer, internal links stay in the same tab', () => {
  for (const page of PAGES) {
    const links = read(page).match(/<a\s[^>]*href="[^"]*"[^>]*>/g) ?? [];
    assert.ok(links.some((tag) => EXTERNAL.test(tag)), page);
    assert.ok(links.some((tag) => !EXTERNAL.test(tag)), page);
    for (const tag of links) {
      if (EXTERNAL.test(tag)) {
        assert.match(tag, NEW_TAB, `${page}: ${tag}`);
        assert.match(tag, SAFE_REL, `${page}: ${tag}`);
      } else {
        assert.doesNotMatch(tag, /target=/, `${page}: ${tag}`);
      }
    }
  }
});

test('links built in JS: external ones go through newTab, internal ones do not', () => {
  const js = read('js/app.mjs');
  const helper = js.match(/function newTab\(a\) \{[^}]*\}/)?.[0] ?? '';
  assert.match(helper, /a\.target = '_blank'/);
  assert.match(helper, /a\.rel = 'noopener noreferrer'/);
  const hrefs = [...js.matchAll(/(\w+)\.href = ([^;]+);/g)].map((m) => ({ name: m[1], value: m[2] }));
  assert.ok(hrefs.length >= 3);
  for (const { name, value } of hrefs) {
    const internal = /^'[^h#][^']*'$/.test(value);
    if (internal) assert.doesNotMatch(js, new RegExp(`newTab\\(${name}\\);`), name);
    else assert.match(js, new RegExp(`newTab\\(${name}\\);`), name);
  }
  assert.equal(js.match(/\.target = /g)?.length, 1, 'target is set only inside newTab');
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML/);
});

test('selects drop the native look so they are as tall as the Mensile/Annuale buttons', () => {
  const css = read('style.css');
  const minHeight = (rule) => css.match(new RegExp(`${rule}\\{[^}]*min-height:(\\d+px)`))?.[1];
  assert.equal(minHeight('input,select'), minHeight('\\.seg label'));
  const select = css.match(/(^|\n)select\{[^}]*\}/)?.[0] ?? '';
  assert.match(select, /-webkit-appearance:none/);
  assert.match(select, /appearance:none/);
  assert.match(select, /background-image:url\("data:image\/svg\+xml/);
  assert.match(select, /background-position:right var\(--s-4\) center/);
});
