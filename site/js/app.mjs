import { LINES } from './lines.mjs';
import { PASS_TYPES } from './refund.mjs';
import { searchStations } from './stations.mjs';
import { buildReport, euro, monthLabel } from './report.mjs';

const CLAIM_URL = 'https://www.trenord.it/store/#/it/auth/login';
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};

let data = null;

function fillSelects() {
  LINES.forEach((l) => $('line').append(new Option(`Dir. ${l.code} – ${l.name}`, l.code)));
  Object.entries(PASS_TYPES).forEach(([key, p]) => $('pass').append(new Option(p.label, key)));
}

function showSuggestions() {
  const list = $('station-results');
  list.replaceChildren();
  const found = searchStations($('station').value);
  list.hidden = found.length === 0;
  for (const s of found) {
    for (const code of s.lines) {
      const line = LINES.find((l) => l.code === code);
      const item = el('li');
      const button = el('button', `${s.name} → Dir. ${code} ${line.name}`);
      button.type = 'button';
      button.addEventListener('click', () => {
        $('line').value = code;
        $('station').value = s.name;
        list.hidden = true;
        render();
      });
      item.append(button);
      list.append(item);
    }
  }
  const count = list.children.length;
  $('station-count').textContent = $('station').value.trim()
    ? (count ? `${count} ${count === 1 ? 'risultato' : 'risultati'}` : 'Nessuna stazione trovata')
    : '';
}

function summary(report) {
  const box = el('div', undefined, 'summary');
  const { pass, refund } = report;
  if (pass.excluded) {
    box.append(el('p', `${pass.label}: escluso dall’indennizzo.`, 'warn'));
    return box;
  }
  box.append(el('p', `Mesi ancora richiedibili negli ultimi 12 pubblicati: ${report.claimable}.`));
  if (refund.status === 'amount') box.append(el('p', `Stima: ${euro(refund.amount)} al mese, ${euro(report.total)} in totale.`, 'big'));
  if (refund.status === 'below-min') box.append(el('p', `L’importo (${euro(refund.amount)}) è sotto i 4 €: non viene erogato.`, 'warn'));
  if (refund.status === 'need-price') box.append(el('p', 'Inserisci il prezzo dell’abbonamento per stimare l’importo.'));
  if (refund.status === 'integrated') box.append(el('p', 'Abbonamento integrato: l’indennizzo è il 10% della quota Trenord, che non possiamo stimare.'));
  if (pass.scope === 'network') box.append(el('p', 'Gli IVOL sono valutati sull’intera rete, non sulla singola direttrice.'));
  if (report.claimable > 0) {
    const cta = el('a', 'Richiedi sull’Area Personale Trenord', 'cta');
    cta.href = CLAIM_URL;
    cta.rel = 'noopener';
    box.append(cta);
  }
  return box;
}

function table(report) {
  const t = el('table');
  const head = el('tr');
  ['Mese', 'Esito', 'Indice', 'Chiedi entro', 'Fonte'].forEach((h) => head.append(el('th', h)));
  t.append(el('thead'), el('tbody'));
  t.tHead.append(head);
  for (const r of report.rows) {
    const tr = el('tr', undefined, r.qualifies ? 'yes' : 'no');
    tr.append(el('td', monthLabel(r.month)));
    tr.append(el('td', r.qualifies ? '✅ Sì' : '❌ No'));
    tr.append(el('td', r.index === null ? 'n.d.' : `${r.index.toLocaleString('it-IT')}%`));
    tr.append(el('td', r.qualifies ? `${monthLabel(r.deadline)}${r.expired ? ' (scaduto)' : ''}` : '–'));
    const src = el('td');
    const a = el('a', 'PDF');
    a.href = r.source;
    a.rel = 'noopener';
    src.append(a);
    tr.append(src);
    t.tBodies[0].append(tr);
  }
  return t;
}

function render() {
  const out = $('result');
  const lineCode = $('line').value;
  const passType = $('pass').value;
  if (!data || (!lineCode && PASS_TYPES[passType].scope !== 'network')) return out.replaceChildren();
  const report = buildReport({ data, lineCode, passType, price: Number($('price').value), today: new Date() });
  const card = el('div', undefined, 'card');
  card.append(summary(report), table(report));
  card.append(el('p', 'Indice: quota di treni soppressi o con oltre 15 minuti di ritardo (n.d. prima di marzo 2026, quando Trenord pubblicava solo l’elenco). Date indicative: fa fede il PDF.', 'hint'));
  out.replaceChildren(card);
}

async function start() {
  fillSelects();
  $('station').addEventListener('input', showSuggestions);
  ['line', 'pass', 'price'].forEach((id) => $(id).addEventListener('input', render));
  $('check').addEventListener('submit', (e) => e.preventDefault());
  try {
    const res = await fetch('data/indennizzi.json');
    data = await res.json();
    render();
  } catch {
    $('result').replaceChildren(el('p', 'Non riesco a caricare i dati. Riprova tra poco.', 'warn'));
  }
}

start();
