import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { byClass, byId, byTag, findAll, parseHtml, squash } from './dom.mjs';

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

test('the home page is a 3-step guided check with big back/next buttons', () => {
  const html = read('index.html');
  assert.match(html, /Passo 1 di 3/);
  for (const step of ['1', '1b', '2', '3']) assert.match(html, new RegExp(`class="wstep" data-step="${step}"`), step);
  assert.match(html, /Da quale stazione parti\?/);
  assert.match(html, /Quale linea usi\?/);
  assert.match(html, /Che abbonamento hai\?/);
  assert.match(html, /Quanto lo paghi\?/);
  assert.match(html, /id="back" class="btn btn-back"/);
  assert.match(html, /id="next" class="btn btn-next"/);
  const css = read('style.css');
  assert.match(css, /\.wiz \.btn[^{]*\{[^}]*min-height:56px/);
  assert.match(css, /\.wiz\{[^}]*font-size:1\.125rem/);
  assert.match(read('js/app.mjs'), /Vedi il risultato →/);
});

const home = () => parseHtml(read('index.html'));
const stepText = (doc, id) => squash(byId(doc, 'check').children.find((s) => s.getAttribute('data-step') === id).textContent);

test('home: short lede, data pill placeholder, each step is just its question and its controls', () => {
  const doc = home();
  const hero = byClass(doc, 'hero-wiz')[0];
  assert.equal(squash(byClass(hero, 'lede')[0].textContent), 'Scopri se Trenord ti deve un indennizzo.');
  assert.ok(byId(doc, 'updated').attributes.has('hidden'), 'filled by JS with «Dati di [mese]»');
  const all = squash(doc.textContent);
  for (const gone of ['Scrivi il nome della stazione', 'Lo trovi sul biglietto', 'Guarda le città agli estremi', 'passano più linee',
    'Scegli il tipo che usi di solito', 'Scrivi il prezzo del tuo abbonamento', 'Lo trovi sulla ricevuta', '585', 'Morbegno–Sondrio',
    'Per un annuale, indica', 'Hai bisogno di aiuto']) {
    assert.ok(!all.includes(gone), gone);
  }
  assert.equal(stepText(doc, '1b'), 'Quale linea usi?');
  assert.equal(stepText(doc, '3'), 'Quanto lo paghi? € al mese');
  // Help stays in the footer only.
  const form = byId(doc, 'check');
  assert.equal(byTag(form, 'a').filter((a) => a.getAttribute('href')?.startsWith('mailto:')).length, 0);
  const footer = byTag(doc, 'footer')[0];
  assert.match(squash(footer.textContent), /info@iltrenotideve\.eu/);
  assert.match(squash(footer.textContent), /Sito indipendente · non affiliato a Trenord/);
  assert.ok(byTag(footer, 'a').some((a) => a.getAttribute('href') === 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/'));
});

test('home: no visible duplicate labels; every control is named by its step question or a hidden label', () => {
  const doc = home();
  const form = byId(doc, 'check');
  for (const label of byTag(form, 'label').filter((l) => l.getAttribute('for'))) {
    assert.ok(label.classes.includes('visually-hidden'), `label for ${label.getAttribute('for')} is visible`);
  }
  assert.equal(byTag(form, 'legend').length, 0);
  const named = (node) => {
    const ids = node.getAttribute('aria-labelledby')?.split(' ') ?? [];
    if (ids.length) return ids.map((id) => squash(byId(doc, id)?.textContent ?? '')).join(' ');
    const label = findAll(form, (l) => l.tagName === 'LABEL' && l.getAttribute('for') === node.getAttribute('id'))[0];
    if (label) return squash(label.textContent);
    return node.parentNode?.tagName === 'LABEL' ? squash(node.parentNode.textContent) : '';
  };
  assert.equal(named(byId(doc, 'station')), 'Da quale stazione parti?');
  assert.equal(named(byId(doc, 'line-cards')), 'Quale linea usi?');
  assert.equal(named(byId(doc, 'pass-kind')), 'Che abbonamento hai?');
  assert.equal(named(byId(doc, 'price')), 'Quanto lo paghi? € al mese');
  for (const control of findAll(form, (n) => ['INPUT', 'SELECT'].includes(n.tagName))) {
    assert.ok(named(control), `${control.getAttribute('id') ?? control.getAttribute('value')} has no accessible name`);
  }
});

test('home: the line list is a hidden fallback that stays a real, labelled control', () => {
  const doc = home();
  const more = byId(doc, 'line-more');
  assert.equal(more.tagName, 'DETAILS');
  assert.ok(more.attributes.has('hidden'));
  assert.equal(squash(byTag(more, 'summary')[0].textContent), 'Non trovi la stazione? Scegli la linea dall’elenco');
  assert.equal(byTag(more, 'select')[0].getAttribute('id'), 'line');
  const live = byId(doc, 'station-count');
  assert.equal(live.getAttribute('aria-live'), 'polite');
});

test('designer v2 review: hero stacks on desktop, months stay bulleted, back hides on step 1', () => {
  const css = read('style.css');
  const js = read('js/app.mjs');
  // 1: guided hero is block (not the v1 2-col stamp grid); lede ~60ch
  assert.match(css, /\.hero-wiz\{[^}]*display:block/);
  assert.match(css, /\.hero-wiz \.lede\{[^}]*max-width:60ch/);
  assert.match(css, /\.hero-wiz\{display:block;grid-template-columns:none\}/);
  // 2: months under «Cosa fare adesso» are a ul with discs, not a nested ol
  assert.match(read('js/ticket.mjs'), /el\('ul', undefined, 'claim-months'\)/);
  assert.match(css, /\.claim-months\{[^}]*list-style:disc/);
  assert.match(css, /\.now-steps>li::before/);
  // 3: hero only on step 1
  assert.match(js, /classList\.toggle\('in-flow', step !== '1'\)/);
  assert.match(css, /\.wiz-main\.in-flow \.hero-wiz\{display:none\}/);
  // 4: sticky header clearance
  assert.match(css, /html\{[^}]*scroll-padding-top:8rem/);
  assert.match(css, /#result\{scroll-margin-top:8rem\}/);
  // 5: Indietro never wraps
  assert.match(css, /\.wiz \.btn[^{]*\{[^}]*white-space:nowrap/);
  // 6: Indietro hidden (not only disabled) on step 1; nav collapses to one column
  assert.match(js, /\$\('back'\)\.hidden = step === '1'/);
  assert.match(css, /#back\[hidden\],\.btn\[hidden\]\{display:none\}/);
  assert.match(css, /\.nav-row:has\(#back\[hidden\]\)\{grid-template-columns:1fr\}/);
});

test('the check page stays light: no third-party scripts and small assets', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  const files = ['index.html', 'style.css', 'js/app.mjs', 'js/lines.mjs', 'js/refund.mjs', 'js/stations.mjs', 'js/report.mjs',
    'js/prefs.mjs', 'js/view.mjs', 'js/ticket.mjs', 'js/wizard.mjs'];
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
});

test('the current page is marked in the navigation', () => {
  const current = { 'index.html': '"">Verifica', 'come-richiedere/index.html': 'come-richiedere/" aria-current', 'regole/index.html': 'regole/" aria-current', 'privacy/index.html': 'privacy/" aria-current' };
  for (const [page, needle] of Object.entries(current)) {
    const html = read(page);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, page);
    if (page !== 'index.html') assert.ok(html.includes(needle), page);
  }
  assert.match(read('index.html'), /<a href="" aria-current="page"[^>]*>Verifica<\/a>/);
});

test('the login button on Come richiedere is never called a form ("modulo")', () => {
  const page = read('come-richiedere/index.html');
  const ctas = [...page.matchAll(/<a class="cta"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
  assert.deepEqual(ctas, ['Accedi all’Area Personale Trenord']);
});

test('the full official how-to, times and alternatives stay on Come richiedere', () => {
  const page = read('come-richiedere/index.html');
  for (const needle of ['compilare il form online dedicato, selezionando la tessera e l’abbonamento', 'entro 30 giorni', 'malpensaexpress',
    'convertir', '02-72494949', 'MyLink Point', 'rimborsi@pec.trenord.it', 'entro il giorno 5',
    'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/']) {
    assert.ok(page.includes(needle), needle);
  }
});

test('result rendering writes text, never HTML', () => {
  for (const f of ['js/app.mjs', 'js/ticket.mjs', 'js/prefs.mjs', 'js/view.mjs']) assert.doesNotMatch(read(f), /innerHTML|outerHTML|insertAdjacentHTML/, f);
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
  const js = read('js/ticket.mjs');
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
  const text = read('come-richiedere/index.html');
  assert.ok(text.includes(form));
  assert.ok(text.includes('allegando copia del documento d’identità'));
  assert.ok(text.includes('Piazzale Cadorna 14 – 20121 Milano'));
});

test('claim copy never states mechanics Trenord does not describe', () => {
  for (const text of [read('js/app.mjs'), read('js/ticket.mjs'), read('js/report.mjs'), read('come-richiedere/index.html')]) {
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

test('Come richiedere links the IVOL day-5 declaration form (the result is covered in ticket.test.mjs)', () => {
  assert.ok(read('come-richiedere/index.html').includes('dichiarazione-utilizzo-abbonamento-integrato/'));
});

test('the first step stays hidden until saved answers have been restored, with a usable fallback', () => {
  const html = read('index.html');
  assert.match(read('style.css'), /\.wiz-main:not\(\.ready\) #check\{visibility:hidden\}/);
  assert.match(read('js/app.mjs'), /classList.add\('ready'\)/);
  assert.match(html, /id="wizard-loading" role="status"/);
  assert.match(html, /<noscript>.*JavaScript.*<\/noscript>/);
  const loading = html.split('id="wizard-loading"')[1].split('</p>')[0];
  assert.match(loading, /href="regole\/"/);
  assert.match(loading, /href="come-richiedere\/"/);
  const start = read('js/app.mjs').split('function start()')[1];
  assert.ok(start.indexOf('restore();') < start.lastIndexOf('showStep();'));
  assert.ok(start.indexOf('isComplete(state())') < start.lastIndexOf('showStep();'));
  assert.ok(start.lastIndexOf('showStep();') < start.indexOf("$('wizard-loading').hidden = true"));
});

test('a valid line immediately clears the station error on every selection path', () => {
  const js = read('js/app.mjs');
  const showLine = js.split('function showLine()')[1].split('\n}')[0];
  assert.match(showLine, /if \(plain\) \$\('step-error'\)\.textContent = ''/);
  const pickStation = js.split('function pickStation(')[1].split('\n}')[0];
  assert.match(pickStation, /showLine\(\)/);
  const lineCards = js.split('function lineCards(')[1].split('\n}')[0];
  assert.match(lineCards, /addEventListener\('change'.*showLine\(\)/);
  assert.match(js, /\$\('line'\)\.addEventListener\('input'.*showLine\(\)/);
});
