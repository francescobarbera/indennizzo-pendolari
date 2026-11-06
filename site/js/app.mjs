import { LINES } from './lines.mjs';
import { PASS_TYPES } from './refund.mjs';
import { normalize, searchStations } from './stations.mjs';
import { buildReport, euro, monthLabel } from './report.mjs';
import { MAIN_PASSES, OTHER_PASSES, browserStorage, loadPrefs, passChoice, passFromChoice, savePrefs } from './prefs.mjs';
import { PASS_SHORT, barWidth, deadlineInfo, monthParts, percent, tileState, worstMonth } from './view.mjs';

const CLAIM_URL = 'https://www.trenord.it/store/#/it/auth/login';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const add = (parent, ...children) => { parent.append(...children); return parent; };
const bold = (text) => el('b', text);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const storage = browserStorage();

let data = null;
let lastKey = '';
let scrollAfterRender = false;

function fillSelects() {
  LINES.forEach((l) => $('line').append(new Option(`Dir. ${l.code} – ${l.name}`, l.code)));
  const groups = [['Più comuni', MAIN_PASSES], ['Altri abbonamenti', OTHER_PASSES]];
  for (const [label, keys] of groups) {
    const group = document.createElement('optgroup');
    group.label = label;
    keys.forEach((key) => group.append(new Option(PASS_TYPES[key].label, key)));
    $('pass').append(group);
  }
}

function save() {
  savePrefs(storage, { station: $('station').value, line: $('line').value, pass: $('pass').value, price: $('price').value });
}

function syncPassKind() {
  const choice = passChoice($('pass').value);
  document.querySelectorAll('input[name="pass-kind"]').forEach((r) => { r.checked = r.value === choice; });
  if (choice === 'altro') $('pass-more').open = true;
}

function restore() {
  const prefs = loadPrefs(storage);
  if (!prefs) return;
  $('station').value = prefs.station;
  $('line').value = prefs.line;
  $('pass').value = prefs.pass;
  $('price').value = prefs.price;
}

function focusLine(event) {
  event?.preventDefault();
  $('line').focus();
}

function nameWithMatch(name, query) {
  const span = el('span');
  const q = normalize(query);
  const plain = normalize(name);
  const at = plain.indexOf(q);
  // Highlight only when normalising kept the name aligned character by character.
  if (q && at >= 0 && plain.length === name.length) {
    span.append(name.slice(0, at), el('mark', name.slice(at, at + q.length)), name.slice(at + q.length));
  } else {
    span.append(name);
  }
  return span;
}

function closeSuggestions() {
  $('station-results').hidden = true;
}

function pickStation(name, code) {
  $('line').value = code;
  $('station').value = name;
  closeSuggestions();
  $('station-count').textContent = '';
  scrollAfterRender = true;
  save();
  render();
}

function showSuggestions() {
  const list = $('station-results');
  const query = $('station').value;
  list.replaceChildren();
  const found = searchStations(query);
  let count = 0;
  for (const s of found) {
    for (const code of s.lines) {
      const line = LINES.find((l) => l.code === code);
      const button = el('button');
      button.type = 'button';
      const name = nameWithMatch(s.name, query);
      name.append(el('small', `Dir. ${code} · ${line.name}`));
      button.append(el('span', code, 'code'), name);
      button.addEventListener('click', () => pickStation(s.name, code));
      list.append(add(el('li'), button));
      count += 1;
    }
  }
  const typed = query.trim();
  if (!count && normalize(typed).length >= 2) {
    const p = el('p', `Nessuna stazione per “${typed}”. Controlla l’ortografia o `, 'empty');
    const link = el('button', 'scegli la linea dall’elenco', 'linkish');
    link.type = 'button';
    link.addEventListener('click', () => { closeSuggestions(); focusLine(); });
    p.append(link, '.');
    list.append(add(el('li'), p));
  }
  list.hidden = list.children.length === 0;
  $('station-count').textContent = typed
    ? (count ? `${count} ${count === 1 ? 'risultato' : 'risultati'}` : 'Nessuna stazione trovata')
    : '';
}

function suggestionKeys(event) {
  const buttons = [...$('station-results').querySelectorAll('button')];
  if (event.key === 'Escape') {
    if (!$('station-results').hidden) {
      event.preventDefault();
      closeSuggestions();
      $('station').focus();
    }
    return;
  }
  if (!buttons.length || $('station-results').hidden) return;
  const i = buttons.indexOf(document.activeElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    buttons[Math.min(i + 1, buttons.length - 1)].focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (i <= 0) $('station').focus();
    else buttons[i - 1].focus();
  }
}

function icon(paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of paths) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', ...attrs })
      .forEach(([k, v]) => node.setAttribute(k, v));
    svg.append(node);
  }
  return svg;
}

const clock = () => icon([['circle', { cx: '12', cy: '13', r: '8' }], ['path', { d: 'M12 9v4l2.5 2M9 2h6' }]]);
const mesi = (n) => `${n} ${n === 1 ? 'mese' : 'mesi'}`;
const plainEuro = (n) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;

function ticketHead(report, ctx, yes) {
  const head = el('div', undefined, 'ticket-head');
  const meta = el('div', undefined, 'ticket-meta');
  meta.append(el('span', ctx.line ? `Dir. ${ctx.line.code} · ${ctx.line.name}` : 'Intera rete', 'chip'));
  meta.append(el('span', `${PASS_SHORT[ctx.passType]}${ctx.price > 0 && !report.pass.integrated && !report.pass.excluded ? ` · ${plainEuro(ctx.price)}` : ''}`, 'chip'));
  const stamp = el('div', yes ? 'SÌ' : 'NO', 'stamp');
  stamp.setAttribute('aria-hidden', 'true');
  const words = el('div');
  let title = yes ? 'Sì, ti spetta l’indennizzo' : 'Per ora no';
  let sub;
  if (report.pass.excluded) {
    title = 'Questo abbonamento è escluso';
    sub = 'Non dà diritto all’indennizzo per ritardi';
  } else if (yes) {
    sub = `${mesi(report.claimable)} ancora da richiedere negli ultimi 12`;
  } else if (report.rows.some((r) => r.qualifies)) {
    sub = 'Nessun mese ancora richiedibile negli ultimi 12';
  } else {
    sub = 'Nessun mese sopra la soglia negli ultimi 12';
  }
  words.append(el('h2', title), el('p', sub));
  head.append(meta, add(el('div', undefined, 'verdict'), stamp, words));
  return head;
}

function amountBlock(report, ctx, body) {
  const { refund, pass } = report;
  if (refund.status === 'amount') {
    body.append(el('p', 'Ti spettano circa', 'amount-label'));
    const amount = el('p', report.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'amount');
    amount.append(el('small', ' €'));
    body.append(amount);
    const base = pass.monthsCovered === 12 ? `30% di 1/12 di ${plainEuro(ctx.price)}` : `30% di ${plainEuro(ctx.price)}`;
    body.append(add(el('p', undefined, 'calc'), bold(mesi(report.claimable)), ' × ', bold(euro(refund.amount)), ` (${base})`));
  } else if (refund.status === 'below-min') {
    body.append(add(el('div', undefined, 'note-box'), el('p', `L’importo (${euro(refund.amount)}) è sotto i 4 €: non viene erogato.`)));
  } else if (refund.status === 'integrated') {
    body.append(add(el('div', undefined, 'note-box'), el('p', 'Il 10% della quota dell’operatore: non possiamo stimarlo, perché non è indicata sul titolo.')));
  } else if (refund.status === 'need-price') {
    const prompt = el('button', 'Inserisci il prezzo per vedere l’importo', 'linkish');
    prompt.type = 'button';
    prompt.addEventListener('click', () => $('price').focus());
    body.append(add(el('div', undefined, 'note-box'), add(el('p'), prompt)));
  }
  if (pass.scope === 'network') body.append(el('p', 'Gli IVOL sono valutati sull’intera rete, non sulla singola direttrice.', 'hint'));
}

function deadlineBlock(report) {
  const info = deadlineInfo(report, new Date());
  if (!info) return null;
  const box = el('div', undefined, info.urgent ? 'deadline' : 'deadline calm');
  box.setAttribute('role', 'note');
  const p = el('p');
  const when = monthLabel(info.row.deadline);
  if (info.urgent) {
    const left = info.days === 0 ? 'Scade oggi' : info.days === 1 ? 'Manca 1 giorno' : `Mancano ${info.days} giorni`;
    p.append(bold(left), el('br'), `Il mese di ${monthLabel(info.row.month)} scade a fine ${when}.`);
  } else {
    p.append(bold(`Hai tempo fino a fine ${when}`), el('br'), `per il mese di ${monthLabel(info.row.month)}.`);
  }
  if (info.others === 1) p.append(` L’altro mese scade a fine ${monthLabel(info.otherFrom)}.`);
  else if (info.others > 1 && info.otherFrom === info.otherTo) p.append(` Gli altri ${info.others} mesi scadono a fine ${monthLabel(info.otherFrom)}.`);
  else if (info.others > 1) p.append(` Gli altri ${info.others} mesi scadono tra ${monthLabel(info.otherFrom)} e ${monthLabel(info.otherTo)}.`);
  box.append(clock(), p);
  return box;
}

function newTab(a) {
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function claimBlock(body) {
  const cta = el('a', 'Vai al modulo ufficiale Trenord ', 'cta');
  cta.href = CLAIM_URL;
  newTab(cta);
  const arrow = el('span', '→', 'arrow');
  arrow.setAttribute('aria-hidden', 'true');
  cta.append(arrow);
  body.append(add(el('p'), cta));
  body.append(el('p', 'Si apre l’Area Personale sul sito ufficiale di Trenord. Ripeti la richiesta per ogni mese.', 'cta-note'));
}

function noBlock(report, body) {
  const worst = worstMonth(report.rows);
  if (worst) {
    body.append(add(el('p', undefined, 'near'), bold(`Il mese peggiore: ${monthLabel(worst.month)}, ${percent(worst.index)}.`),
      ' Per l’indennizzo serve almeno il 10% di treni soppressi o in ritardo oltre 15 minuti.'));
    const gauge = el('div', undefined, 'gauge');
    gauge.setAttribute('role', 'img');
    gauge.setAttribute('aria-label', `${percent(worst.index)} su una soglia del 10%`);
    const fill = el('i');
    fill.style.width = `${barWidth(worst.index)}%`;
    gauge.append(fill, el('span', undefined, 'th'));
    body.append(gauge);
    const legend = add(el('div', undefined, 'gauge-l'), el('span', '0%'), el('span', 'soglia 10%'), el('span', '20%'));
    legend.setAttribute('aria-hidden', 'true');
    body.append(legend);
  } else {
    body.append(el('p', 'Per l’indennizzo serve almeno il 10% di treni soppressi o in ritardo oltre 15 minuti.', 'near'));
  }
  const change = el('button', 'Cambia linea', 'linkish');
  change.type = 'button';
  change.addEventListener('click', () => focusLine());
  body.append(add(el('ul', undefined, 'tips'),
    el('li', 'Il prossimo elenco esce entro fine mese: ricontrolla qui.'),
    add(el('li', 'Viaggi anche su un’altra linea? '), change)));
}

function excludedBlock(body) {
  const link = el('a', 'Vedi quali abbonamenti sono esclusi');
  link.href = 'regole/';
  newTab(link);
  body.append(el('p', 'Questo abbonamento è escluso dall’indennizzo.', 'near'), add(el('p'), link));
}

function monthsGrid(report) {
  const wrap = el('div');
  const legend = el('div', undefined, 'legend');
  legend.setAttribute('aria-hidden', 'true');
  [['l-yes', 'Sì'], ['l-no', 'No'], ['l-exp', 'Scaduto'], ['l-th', 'soglia 10%']].forEach(([cls, text]) => {
    legend.append(add(el('span'), el('i', undefined, cls), text));
  });
  wrap.append(add(el('div', undefined, 'months-h'), el('h3', 'I tuoi ultimi 12 mesi'), legend));
  const list = el('ol', undefined, 'months');
  report.rows.forEach((r, i) => {
    const state = tileState(r);
    const tile = el('li', undefined, state === 'no' ? 'm' : `m ${state}`);
    tile.style.setProperty('--i', i);
    const { abbr, year } = monthParts(r.month);
    const shown = state === 'expired' ? 'Scaduto' : r.index === null ? (r.qualifies ? 'Sì' : 'No') : percent(r.index, 1);
    const said = `${monthLabel(r.month)}: ${r.qualifies ? 'sì' : 'no'}${state === 'expired' ? ', scaduto' : ''}${r.index === null ? '' : `, indice ${percent(r.index)}`}`;
    const visible = [el('span', abbr, 'mo'), el('span', year, 'yr'), el('span', shown, 'v')];
    if (r.index !== null) {
      const bar = el('span', undefined, 'bar');
      const fill = el('i');
      fill.style.width = `${barWidth(r.index)}%`;
      visible.push(add(bar, fill));
    }
    visible.forEach((v) => v.setAttribute('aria-hidden', 'true'));
    tile.append(el('span', said, 'visually-hidden'), ...visible);
    list.append(tile);
  });
  wrap.append(list);
  wrap.append(el('p', 'Indice: quota di treni soppressi o con oltre 15 minuti di ritardo. n.d.: prima di marzo 2026 l’elenco ufficiale indicava solo sì/no, senza percentuale. Date indicative: fa fede il PDF.', 'nd'));
  return wrap;
}

function table(report) {
  const t = el('table');
  const head = el('tr');
  ['Mese', 'Esito', 'Indice', 'Chiedi entro', 'Fonte'].forEach((h) => head.append(el('th', h)));
  t.append(el('thead'), el('tbody'));
  t.tHead.append(head);
  for (const r of report.rows) {
    const tr = el('tr', undefined, [r.qualifies ? 'yes' : 'no', r.qualifies && r.expired ? 'expired' : ''].join(' ').trim());
    tr.append(el('td', monthLabel(r.month)));
    tr.append(el('td', r.qualifies ? 'Sì' : 'No'));
    tr.append(el('td', r.index === null ? 'n.d.' : percent(r.index)));
    tr.append(el('td', r.qualifies ? `${monthLabel(r.deadline)}${r.expired ? ' (scaduto)' : ''}` : '–'));
    const src = el('td');
    const a = el('a', 'PDF');
    a.href = r.source;
    newTab(a);
    a.setAttribute('aria-label', `PDF ufficiale di ${monthLabel(r.month)}`);
    src.append(a);
    tr.append(src);
    t.tBodies[0].append(tr);
  }
  const details = el('details', undefined, 'detail');
  details.append(el('summary', 'Dettaglio mese per mese e PDF ufficiali'), add(el('div', undefined, 'table-wrap'), t));
  return details;
}

function ticket(report, ctx) {
  const yes = report.claimable > 0 && !report.pass.excluded;
  const card = el('article', undefined, `ticket ${yes ? 'is-yes' : 'is-no'}`);
  const perf = el('div', undefined, 'perf');
  perf.setAttribute('aria-hidden', 'true');
  const body = el('div', undefined, 'ticket-body');
  if (report.pass.excluded) {
    excludedBlock(body);
  } else if (yes) {
    amountBlock(report, ctx, body);
    const deadline = deadlineBlock(report);
    if (deadline) body.append(deadline);
    claimBlock(body);
  } else {
    noBlock(report, body);
  }
  if (!report.pass.excluded) body.append(monthsGrid(report), table(report));
  card.append(ticketHead(report, ctx, yes), perf, body);
  return card;
}

function placeholder() {
  const box = el('div', undefined, 'state');
  box.append(el('h2', 'Il tuo risultato apparirà qui'), el('p', 'Scegli stazione o linea per vedere il risultato.'));
  return box;
}

function skeleton() {
  const box = el('div', undefined, 'state');
  box.append(el('span', 'Caricamento degli elenchi…', 'visually-hidden'));
  ['sk big', 'sk', 'sk short'].forEach((cls) => {
    const bar = el('div', undefined, cls);
    bar.setAttribute('aria-hidden', 'true');
    box.append(bar);
  });
  return box;
}

function failure() {
  const box = el('div', undefined, 'state err');
  box.setAttribute('role', 'alert');
  const retry = el('button', 'Riprova', 'btn');
  retry.type = 'button';
  retry.addEventListener('click', load);
  box.append(el('h2', 'Dati non disponibili'), el('p', 'Non riusciamo a caricare gli elenchi. Riprova tra poco.'), retry);
  return box;
}

function render() {
  const out = $('result');
  const lineCode = $('line').value;
  const passType = $('pass').value;
  if (!data) return;
  if (!lineCode && PASS_TYPES[passType].scope !== 'network') {
    lastKey = '';
    return out.replaceChildren(placeholder());
  }
  const price = Number($('price').value);
  const report = buildReport({ data, lineCode, passType, price, today: new Date() });
  const line = PASS_TYPES[passType].scope === 'network' ? null : LINES.find((l) => l.code === lineCode);
  const card = ticket(report, { line, passType, price });
  const key = `${lineCode}|${passType}`;
  if (key !== lastKey) card.classList.add('is-new');
  lastKey = key;
  out.replaceChildren(card);
  if (scrollAfterRender && window.matchMedia('(max-width: 1024px)').matches) {
    out.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  scrollAfterRender = false;
}

function fillUpdated() {
  const node = $('updated');
  const last = data.months.at(-1)?.month;
  const when = new Date(data.updatedAt);
  if (!last || Number.isNaN(when.getTime())) return;
  const date = when.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  node.textContent = `Dati aggiornati al ${date} · ultimo elenco: ${monthLabel(last)}`;
  node.hidden = false;
}

async function load() {
  const out = $('result');
  out.setAttribute('aria-busy', 'true');
  out.replaceChildren(skeleton());
  try {
    const res = await fetch('data/indennizzi.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    out.removeAttribute('aria-busy');
    fillUpdated();
    render();
  } catch {
    out.removeAttribute('aria-busy');
    out.replaceChildren(failure());
  }
}

function start() {
  fillSelects();
  restore();
  syncPassKind();
  $('station').addEventListener('input', () => { showSuggestions(); save(); });
  $('station').addEventListener('keydown', suggestionKeys);
  $('station-results').addEventListener('keydown', suggestionKeys);
  document.querySelector('[data-focus="line"]').addEventListener('click', focusLine);
  $('line').addEventListener('input', () => { save(); render(); });
  $('pass').addEventListener('input', () => { syncPassKind(); save(); render(); });
  $('price').addEventListener('input', () => { save(); render(); });
  document.querySelectorAll('input[name="pass-kind"]').forEach((radio) => radio.addEventListener('change', () => {
    if (!radio.checked) return;
    $('pass').value = passFromChoice(radio.value, $('pass').value);
    save();
    render();
  }));
  $('check').addEventListener('submit', (e) => e.preventDefault());
  load();
}

start();
