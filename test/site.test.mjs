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

test('the home page collects no email address', () => {
  assert.doesNotMatch(read('index.html'), /type="email"/);
});

test('the home page is a 3-step guided check with big back/next buttons and help always at hand', () => {
  const html = read('index.html');
  assert.match(html, /Passo 1 di 3/);
  for (const step of ['1', '1b', '2', '3']) assert.match(html, new RegExp(`class="wstep" data-step="${step}"`), step);
  assert.match(html, /Da quale stazione parti\?/);
  assert.match(html, /Quale linea usi\?/);
  assert.match(html, /Che abbonamento hai\?/);
  assert.match(html, /Quanto lo paghi\?/);
  assert.match(html, /id="back" class="btn btn-back"/);
  assert.match(html, /id="next" class="btn btn-next"/);
  assert.match(html, /Hai bisogno di aiuto\? Scrivici a <a href="mailto:info@iltrenotideve.eu">/);
  const css = read('style.css');
  assert.match(css, /\.wiz \.btn[^{]*\{[^}]*min-height:56px/);
  assert.match(css, /\.wiz\{[^}]*font-size:1\.125rem/);
  const js = read('js/app.mjs');
  assert.match(js, /Vedi il risultato →/);
  assert.match(js, /'Hai bisogno di aiuto\? Scrivici'/);
  assert.match(js, /'Altri dettagli'/);
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
    // rel="canonical" names the page's own address; it loads nothing.
    for (const link of html.match(/<link[^>]*>/g)) {
      if (!/rel="canonical"/.test(link)) assert.doesNotMatch(link, /href="(https?:)?\/\//, page);
    }
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
  assert.match(html, /<details class="more"[^>]*>\s*<summary>Altro tipo/);
  assert.match(html, /<label for="pass">/);
  for (const id of ['station', 'line', 'pass', 'price']) assert.match(html, new RegExp(`<label for="${id}"[ >]`), id);
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
  assert.match(read('js/app.mjs'), /Accedi all’Area Personale Trenord/);
});

test('the login button is never called a form ("modulo")', () => {
  const app = read('js/app.mjs');
  const label = app.match(/el\('a', '([^']*)', 'cta'\)/);
  assert.ok(label, 'CTA label found in app.mjs');
  assert.equal(label[1].trim(), 'Accedi all’Area Personale Trenord');
  const page = read('come-richiedere/index.html');
  const ctas = [...page.matchAll(/<a class="cta"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
  assert.deepEqual(ctas, ['Accedi all’Area Personale Trenord']);
  for (const text of [label[1], ...ctas]) assert.doesNotMatch(text, /modulo/i);
});

test('the result explains how to claim, with official times, alternatives and source', () => {
  const app = read('js/app.mjs');
  for (const needle of ['Cosa fare adesso', 'Ti serve: il numero della tua tessera Trenord', 'compilare il form online dedicato, selezionando la tessera e l’abbonamento',
    'entro 30 giorni', 'trenord.it e malpensaexpress.it entro 12 mesi', 'convertirlo in denaro', '02-72494949', 'MyLink Point',
    'rimborsi@pec.trenord.it', 'entro il giorno 5', 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/']) {
    assert.ok(app.includes(needle), needle);
  }
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

test('no page links the private repo or claims "no cookies" while choices sit in localStorage', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.doesNotMatch(html, /github\.com\/francescobarbera|Codice sorgente/i, page);
    assert.doesNotMatch(html, /Niente cookie|non usa cookie/i, page);
    assert.match(html, /Nessun tracciamento · niente analytics/, page);
  }
  assert.match(read('privacy/index.html'), /localStorage/);
});

test('the site is called "Il treno ti deve" and the old name never shows', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<title>[^<]*Il treno ti deve[^<]*<\/title>/, page);
    assert.match(html, /<a class="brand"[^>]*>(<svg[\s\S]*?<\/svg>)?Il treno ti deve<\/a>/, page);
    assert.doesNotMatch(html, /indennizzo pendolari/i, page);
  }
  assert.doesNotMatch(read('js/app.mjs'), /indennizzo pendolari/i);
  assert.doesNotMatch(read('style.css'), /indennizzo pendolari/i);
});

test('sources: ART 106/2018 on the ART site, DGR XII/2116 for the 30%, Regione versus Trenord annual deadline', () => {
  const html = read('regole/index.html');
  assert.doesNotMatch(html, /trenitalia\.com/);
  assert.match(html, /href="https:\/\/www\.autorita-trasporti\.it\/delibere\/delibera-n-106-2018\/"/);
  assert.match(html, /DGR XII\/2116 del 25\/03\/2024/);
  assert.match(html, /Regione Lombardia indica 12 mesi dalla fine di validità anche per l’annuale\. Qui seguiamo la regola di Trenord perché è più restrittiva\./);
});

test('the total is an upper bound conditional on a pass in each month, and the refund is a voucher', () => {
  const js = read('js/app.mjs');
  assert.doesNotMatch(js, /Ti spettano circa/);
  assert.match(js, /'Fino a circa'/);
  assert.match(js, /Ti spetta se avevi un abbonamento valido per questa linea in ciascuno di questi mesi/);
  assert.match(js, /Arriva come voucher Trenord \(un buono\), non in denaro/);
});

test('below 4 € the verdict is never yes', () => {
  const js = read('js/app.mjs');
  assert.match(js, /Sotto i 4 €: niente indennizzo/);
  assert.match(js, /const yes = report\.claimable > 0/);
});

const PAGE_URLS = { 'index.html': '', 'come-richiedere/index.html': 'come-richiedere/', 'regole/index.html': 'regole/', 'privacy/index.html': 'privacy/' };

test('every page has its canonical URL on iltrenotideve.eu, Open Graph and Twitter card', () => {
  for (const [page, path] of Object.entries(PAGE_URLS)) {
    const html = read(page);
    const url = `https://iltrenotideve.eu/${path}`;
    const one = (re) => assert.equal((html.match(new RegExp(re, 'g')) ?? []).length, 1, `${page}: ${re}`);
    one(`<link rel="canonical" href="${url}">`);
    one(`<meta property="og:url" content="${url}">`);
    one('<meta property="og:site_name" content="Il treno ti deve">');
    one('<meta property="og:locale" content="it_IT">');
    one('<meta property="og:title" content="[^"]+">');
    one('<meta property="og:description" content="[^"]+">');
    one('<meta property="og:image" content="https://iltrenotideve.eu/og.png">');
    one('<meta name="twitter:card" content="summary_large_image">');
    one('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
    one('<link rel="icon" href="/favicon.ico"');
  }
});

test('preview image is 1200×630, icons, robots.txt and sitemap.xml exist', () => {
  const png = readFileSync(new URL('../site/og.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const touch = readFileSync(new URL('../site/apple-touch-icon.png', import.meta.url));
  assert.equal(touch.readUInt32BE(16), 180);
  const ico = readFileSync(new URL('../site/favicon.ico', import.meta.url));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.match(read('robots.txt'), /^Sitemap: https:\/\/iltrenotideve\.eu\/sitemap\.xml$/m);
  const sitemap = read('sitemap.xml');
  for (const path of Object.values(PAGE_URLS)) assert.match(sitemap, new RegExp(`<loc>https://iltrenotideve\\.eu/${path}</loc>`));
});

test('the home page says the refund is a voucher', () => {
  assert.match(read('index.html'), /voucher/);
});


test('every page links the contact address and says it is not a Trenord channel', () => {
  for (const page of ['index.html', 'come-richiedere/index.html', 'regole/index.html', 'privacy/index.html']) {
    const html = read(page);
    assert.match(html, /<footer[\s\S]*<a href="mailto:info@iltrenotideve\.eu">info@iltrenotideve\.eu<\/a>[\s\S]*<\/footer>/, page);
    assert.match(html, /<footer[\s\S]*Non è un canale Trenord[\s\S]*<\/footer>/, page);
  }
  const main = read('privacy/index.html').split('<footer')[0];
  assert.match(main, /<h2>Contatti<\/h2>/);
  assert.match(main, /mailto:info@iltrenotideve\.eu/);
  assert.match(main, /Non è un canale Trenord: per le richieste di indennizzo/);
});

test('PEC and post need the Trenord form and an ID copy, with the postal address', () => {
  const form = 'M_1006-_rev.4_Modulo_Reclami_e_Rimborsi.pdf';
  for (const text of [read('js/app.mjs'), read('come-richiedere/index.html')]) {
    assert.ok(text.includes(form));
    assert.ok(text.includes('allegando copia del documento d’identità'));
    assert.ok(text.includes('Piazzale Cadorna 14 – 20121 Milano'));
  }
});

test('claim copy never states mechanics Trenord does not describe', () => {
  for (const text of [read('js/app.mjs'), read('js/report.mjs'), read('come-richiedere/index.html')]) {
    assert.doesNotMatch(text, /Ripeti|per ogni mese|Mesi da indicare|mesi da indicare/);
  }
  assert.match(read('come-richiedere/index.html'), /Per l’annuale Trenord suggerisce di chiedere mese per mese/);
});

test('static deadline copy gives annual IVOL and TrenoCittà the publication rule', () => {
  for (const page of ['regole/index.html', 'come-richiedere/index.html']) {
    const html = read(page);
    assert.doesNotMatch(html, /Mensile, IVOL e TrenoCittà|per il mensile, IVOL e TrenoCittà/, page);
    assert.match(html, /mensili \(anche IVOL e TrenoCittà\)/, page);
    assert.match(html, /annuali \(anche IVOL e TrenoCittà\)/i, page);
  }
});

test('IVOL yes is conditioned on the day-5 declaration and links the official form', () => {
  const app = read('js/app.mjs');
  assert.match(app, /Sì, se l’IVOL è di Trenord o hai dichiarato la direttrice/);
  assert.ok(app.includes('https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/dichiarazione-utilizzo-abbonamento-integrato/'));
  assert.ok(read('come-richiedere/index.html').includes('dichiarazione-utilizzo-abbonamento-integrato/'));
});
