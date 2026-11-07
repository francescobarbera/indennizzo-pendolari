import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LINES } from '../site/js/lines.mjs';
import { buildReport } from '../site/js/report.mjs';
import { ticket } from '../site/js/ticket.mjs';
import { byClass, byTag, findAll, installDocument, squash, visibleText } from './dom.mjs';

installDocument();

const data = JSON.parse(readFileSync(new URL('./fixtures/indennizzi-2026-11.json', import.meta.url), 'utf8'));
const today = new Date('2026-11-05T10:00:00Z');
const CLAIM_URL = 'https://www.trenord.it/store/#/it/auth/login';
const DECLARE_URL = 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/dichiarazione-utilizzo-abbonamento-integrato/';

function render({ lineCode = '07', passType = 'mensile', price = 61, input = data, copy = async () => {}, goTo = () => {} } = {}) {
  const report = buildReport({ data: input, lineCode, passType, price, today });
  const line = passType === 'ivol' ? null : LINES.find((l) => l.code === lineCode);
  const card = ticket(report, { line, passType, price }, { today, goTo, copy });
  return { report, card, text: squash(visibleText(card)) };
}

const count = (text, needle) => text.split(needle).length - 1;
const steps = (card) => byClass(card, 'now-steps')[0]?.children ?? [];

// Twelve months on one line, all with an index, so nothing is missing from the official lists.
function indexedData(index = 6.5) {
  const months = data.months.slice(-12).map((m) => ({ ...m, lines: { 11: { qualifies: false, index, deadline: null } } }));
  return { ...data, months };
}

test('YES: amount "fino a circa", the condition, the voucher once, no extra boxes', () => {
  const { card, text } = render();
  assert.match(text, /Sì, ti spetta l’indennizzo/);
  assert.match(text, /Fino a circa/);
  assert.match(text, /Ti spetta se avevi un abbonamento valido per questa linea in ciascuno di questi mesi, a questo prezzo\./);
  assert.equal(count(text, 'Arriva come voucher Trenord, convertibile in denaro entro 12 mesi.'), 1);
  assert.equal(count(text, 'convertibile in denaro'), 1);
  for (const gone of ['ancora da richiedere negli ultimi 12', 'Altri dettagli', 'Fonte', 'Hai bisogno di aiuto', 'Non siamo Trenord',
    'info@iltrenotideve.eu', 'malpensaexpress', 'I tuoi ultimi 12 mesi']) {
    assert.ok(!text.includes(gone), gone);
  }
  const ctas = byClass(card, 'cta');
  assert.equal(ctas.length, 1, 'only one CTA');
  assert.ok(byClass(card, 'now-steps')[0].childNodes[0] && byClass(byClass(card, 'now-steps')[0], 'cta').length === 1, 'CTA lives inside «Cosa fare adesso»');
  assert.equal(byTag(card, 'details').length, 0, 'no "Altri dettagli"');
});

test('YES: the deadline box says only how many days are left and what to ask by when', () => {
  const { card } = render();
  const [box] = byClass(card, 'deadline');
  assert.equal(squash(visibleText(box)), 'Mancano 25 giorni Novembre 2025 va chiesto entro il 30 novembre 2026.');
  assert.equal(box.getAttribute('role'), 'note');
});

test('YES: «Cosa fare adesso» has the login link in step 1, months with deadlines and copy in step 2, the voucher in step 3', async () => {
  const copied = [];
  const { card } = render({ copy: async (t) => { copied.push(t); } });
  const [one, two, three] = steps(card);
  assert.equal(steps(card).length, 3);

  const [login] = byTag(one, 'a');
  assert.equal(login.href, CLAIM_URL);
  assert.equal(login.target, '_blank');
  assert.equal(login.rel, 'noopener noreferrer');
  assert.equal(squash(login.textContent), 'Accedi all’Area Personale Trenord →');
  // Primary full-width button, inside step 1, under the sentence; the arrow is decorative.
  assert.ok(login.className.split(' ').includes('cta') && login.className.split(' ').includes('cta-block'));
  assert.equal(squash(visibleText(login)), 'Accedi all’Area Personale Trenord');
  assert.equal(squash(visibleText(one)), 'Ti servono email e password Trenord. Accedi all’Area Personale Trenord');
  assert.equal(byTag(card, 'a').filter((a) => a.href === CLAIM_URL).length, 1);

  assert.ok(squash(visibleText(two)).startsWith('Compila il form online con il numero della tessera e questi mesi:'));
  const months = byTag(byClass(two, 'claim-months')[0], 'li').map((li) => li.textContent);
  assert.equal(months.length, 6);
  assert.equal(months[0], 'novembre 2025 (entro il 30 novembre 2026)');
  months.forEach((m) => assert.match(m, /\(entro il \d+ \w+ \d{4}\)$/));
  const [copy] = byClass(two, 'copy');
  await copy.click();
  assert.match(copied[0], /Mesi indennizzabili: novembre 2025 \(entro il 30 novembre 2026\)/);
  assert.equal(copy.textContent, 'Copiati');

  assert.equal(squash(visibleText(three)), 'Ricevi il voucher entro 30 giorni.');
});

test('YES without a clipboard: no copy control', () => {
  const { card } = render({ copy: null });
  assert.equal(byClass(card, 'copy').length, 0);
});

test('YES annual: monthly 30% of 1/12, publication-based deadline and Trenord’s month-by-month advice', () => {
  const { card, text } = render({ passType: 'annuale', price: 585 });
  assert.match(text, /30% di 1\/12 di 585 €/);
  assert.match(text, /Per l’annuale Trenord suggerisce di chiedere mese per mese\./);
  assert.match(squash(visibleText(byClass(card, 'deadline')[0])), /^(Mancano \d+ giorni|Manca 1 giorno|Scade oggi) \w+ \d{4} va chiesto entro il .+\.$/);
});

test('YES IVOL: conditional verdict, day-5 declaration link, whole-network condition and voucher', () => {
  const { card, text } = render({ passType: 'ivol', price: 0 });
  assert.match(text, /Sì, se l’IVOL è di Trenord o hai dichiarato la direttrice/);
  assert.match(text, /IVOL di altri operatori: serve la dichiarazione della direttrice entro il 5 del mese/);
  const declare = byTag(card, 'a').find((a) => a.href === DECLARE_URL);
  assert.ok(declare, 'declaration link');
  assert.equal(declare.target, '_blank');
  assert.match(text, /Ti spetta se avevi un abbonamento valido in ciascuno di questi mesi\./);
  assert.match(text, /Arriva come voucher Trenord, convertibile in denaro entro 12 mesi\./);
  assert.match(text, /Gli IVOL sono valutati sull’intera rete/);
  assert.match(text, /non possiamo stimarlo/);
});

test('NO: worst month against the 10% threshold with a bar, recheck at month end, redo the steps', async () => {
  const went = [];
  const { card, text } = render({ lineCode: '11', input: indexedData(), goTo: (s) => went.push(s) });
  assert.match(text, /Per ora no/);
  assert.match(text, /Il mese peggiore: \w+ \d{4}, 6,5%\. Per l’indennizzo serve almeno il 10%/);
  const [gauge] = byClass(card, 'gauge');
  assert.equal(gauge.getAttribute('role'), 'img');
  assert.equal(gauge.getAttribute('aria-label'), '6,5% su una soglia del 10%');
  const [recheck, redo] = steps(card);
  assert.equal(squash(visibleText(recheck)), 'Ricontrolla a fine mese, quando esce il nuovo elenco.');
  assert.equal(squash(visibleText(redo)), 'Rifai i 3 passi');
  await byTag(redo, 'button')[0].click();
  assert.deepEqual(went, ['1']);
  for (const gone of ['Nessun mese', 'Per ora non c’è niente da chiedere', 'Di solito esce', 'Usi un’altra linea', 'Altri dettagli', 'Fonte']) {
    assert.ok(!text.includes(gone), gone);
  }
});

test('NO with months missing an index: says no month passed in the whole year', () => {
  const { text } = render({ lineCode: '11' });
  assert.match(text, /Per ora no Nessun mese sopra la soglia negli ultimi 12/);
});

test('NO because the qualifying months have expired: says so, never "sì"', () => {
  const { card, text } = render({ lineCode: '06' });
  assert.ok(card.classes.includes('is-no'));
  assert.match(text, /Per ora no Nessun mese ancora richiedibile negli ultimi 12/);
  assert.ok(!text.includes('Fino a circa'));
});

test('below 4 €: never yes, explains the minimum, offers to redo but not to wait for a new list', () => {
  const { card, text } = render({ price: 10 });
  assert.ok(card.classes.includes('is-no'));
  assert.match(text, /Sotto i 4 €: niente indennizzo/);
  assert.match(text, /La linea ha superato la soglia in \d+ mesi, ma l’importo è sotto il minimo/);
  assert.match(text, /è sotto i 4 €: non viene erogato\./);
  assert.ok(!text.includes('Ricontrolla'));
  assert.ok(!text.includes('voucher'));
  assert.equal(squash(visibleText(steps(card).at(-1))), 'Rifai i 3 passi');
});

test('excluded pass: said once, with the link to the rules', () => {
  const { card, text } = render({ passType: 'settimanale', price: 20 });
  assert.equal(count(text, 'escluso'), 1);
  assert.match(text, /Non dà diritto all’indennizzo per ritardi/);
  const [rules] = byTag(card, 'a');
  assert.equal(rules.href, 'regole/');
  assert.equal(rules.target, undefined);
  assert.equal(byClass(card, 'deadline').length, 0);
});

test('rendered links: external ones open in a new tab safely, internal ones stay', () => {
  for (const opts of [{}, { passType: 'ivol', price: 0 }, { passType: 'settimanale' }]) {
    for (const a of byTag(render(opts).card, 'a')) {
      if (/^https?:/.test(a.href)) assert.deepEqual([a.target, a.rel], ['_blank', 'noopener noreferrer'], a.href);
      else assert.equal(a.target, undefined, a.href);
    }
  }
});

test('the stamp is decorative; the verdict is a heading', () => {
  const { card } = render();
  const [stamp] = byClass(card, 'stamp');
  assert.equal(stamp.getAttribute('aria-hidden'), 'true');
  assert.equal(findAll(card, (n) => n.tagName === 'H2').length, 1);
});
