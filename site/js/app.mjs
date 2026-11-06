import { LINES } from './lines.mjs';
import { PASS_TYPES } from './refund.mjs';
import { normalize, searchStations } from './stations.mjs';
import { buildReport, claimDetails, dateLabel, euro, monthLabel } from './report.mjs';
import { MAIN_PASSES, OTHER_PASSES, browserStorage, loadPrefs, passChoice, passFromChoice, savePrefs } from './prefs.mjs';
import { PASS_SHORT, barWidth, deadlineInfo, monthParts, percent, tileState, worstMonth } from './view.mjs';
import { STEPS, isComplete, lastStep, lineChoice, linePlain, linesForStation, parsePrice, stepError } from './wizard.mjs';

const CLAIM_URL = 'https://www.trenord.it/store/#/it/auth/login';
const FORM_URL = 'https://www.trenord.it/fileadmin/contenuti/TRENORD/4-Info_e_assistenza/Informazioni_utili/Reclami/M_1006-_rev.4_Modulo_Reclami_e_Rimborsi.pdf';
const DECLARE_URL = 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/dichiarazione-utilizzo-abbonamento-integrato/';
const INFO_URL = 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/';
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
let step = '1';

function fillSelects() {
  LINES.forEach((l) => $('line').append(new Option(linePlain(l.code).full, l.code)));
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
  $('line-more').open = true;
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

// A station picked or typed: one line is chosen for the user, several open the "which line" screen.
function pickStation(name) {
  $('station').value = name;
  closeSuggestions();
  $('station-count').textContent = '';
  const choice = lineChoice(linesForStation(name));
  if (choice.auto) $('line').value = choice.auto;
  else if (choice.choose && !choice.choose.includes($('line').value)) $('line').value = '';
  showLine();
  save();
  return choice;
}

function showLine() {
  const plain = linePlain($('line').value);
  $('auto-line').hidden = !plain;
  $('auto-line-name').textContent = plain ? plain.full : '';
}

function lineCards(codes) {
  const box = $('line-cards');
  box.querySelectorAll('label').forEach((n) => n.remove());
  $('hub-lede').textContent = `Da ${$('station').value} passano più linee. Tocca quella che prendi di solito.`;
  for (const code of codes) {
    const plain = linePlain(code);
    const input = el('input');
    input.type = 'radio';
    input.name = 'line-card';
    input.value = code;
    input.checked = $('line').value === code;
    input.addEventListener('change', () => { $('line').value = code; showLine(); save(); });
    box.append(add(el('label', undefined, 'card-opt'), input, el('span', plain.ends, 't'), el('span', plain.via || plain.full, 's')));
  }
}

function showSuggestions() {
  const list = $('station-results');
  const query = $('station').value;
  list.replaceChildren();
  const found = searchStations(query);
  for (const s of found) {
    const button = el('button');
    button.type = 'button';
    const name = nameWithMatch(s.name, query);
    name.append(el('small', s.lines.length === 1 ? linePlain(s.lines[0]).full : `${s.lines.length} linee`));
    button.append(name);
    button.addEventListener('click', () => { pickStation(s.name); $('next').focus(); });
    list.append(add(el('li'), button));
  }
  const typed = query.trim();
  if (!found.length && normalize(typed).length >= 2) {
    const p = el('p', `Nessuna stazione per “${typed}”. Controlla come l’hai scritta o `, 'empty');
    const link = el('button', 'scegli la linea dall’elenco', 'linkish');
    link.type = 'button';
    link.addEventListener('click', () => { closeSuggestions(); focusLine(); });
    p.append(link, '.');
    list.append(add(el('li'), p));
  }
  list.hidden = list.children.length === 0;
  $('station-count').textContent = typed
    ? (found.length ? `${found.length} ${found.length === 1 ? 'stazione' : 'stazioni'}` : 'Nessuna stazione trovata')
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
  meta.append(el('span', ctx.line ? linePlain(ctx.line.code).ends : 'Intera rete', 'chip'));
  meta.append(el('span', `${PASS_SHORT[ctx.passType]}${ctx.price > 0 && !report.pass.integrated && !report.pass.excluded ? ` · ${plainEuro(ctx.price)}` : ''}`, 'chip'));
  const stamp = el('div', yes ? 'SÌ' : 'NO', 'stamp');
  stamp.setAttribute('aria-hidden', 'true');
  const words = el('div');
  let title = yes ? 'Sì, ti spetta l’indennizzo' : 'Per ora no';
  let sub;
  if (report.pass.excluded) {
    title = 'Questo abbonamento è escluso';
    sub = 'Non dà diritto all’indennizzo per ritardi';
  } else if (!report.payable && report.open > 0) {
    title = 'Sotto i 4 €: niente indennizzo';
    sub = `La linea ha superato la soglia in ${mesi(report.open)}, ma l’importo è sotto il minimo`;
  } else if (yes && ctx.passType === 'ivol') {
    title = 'Sì, se l’IVOL è di Trenord o hai dichiarato la direttrice';
    sub = `${mesi(report.claimable)} ancora da richiedere negli ultimi 12. IVOL di altri operatori: serve la dichiarazione della direttrice entro il 5 del mese`;
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
    body.append(el('p', 'Fino a circa', 'amount-label'));
    const amount = el('p', report.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'amount');
    amount.append(el('small', ' €'));
    body.append(amount);
    const base = pass.monthsCovered === 12 ? `30% di 1/12 di ${plainEuro(ctx.price)}` : `30% di ${plainEuro(ctx.price)}`;
    body.append(add(el('p', undefined, 'calc'), bold(mesi(report.claimable)), ' × ', bold(euro(refund.amount)), ` (${base})`));
    body.append(add(el('div', undefined, 'must'),
      el('p', 'Ti spetta se avevi un abbonamento valido per questa linea in ciascuno di questi mesi, a questo prezzo.', 'condition'),
      el('p', 'Arriva come voucher Trenord (un buono), non in denaro: puoi chiedere di convertirlo in denaro entro 12 mesi dall’emissione.', 'voucher')));
  } else if (refund.status === 'below-min') {
    body.append(add(el('div', undefined, 'note-box'), el('p', `L’importo (${euro(refund.amount)}) è sotto i 4 €: non viene erogato.`)));
  } else if (refund.status === 'integrated') {
    body.append(add(el('div', undefined, 'note-box'), el('p', 'Il 10% della quota dell’operatore: non possiamo stimarlo, perché non è indicata sul titolo.')));
  } else if (refund.status === 'need-price') {
    const prompt = el('button', 'Inserisci il prezzo per vedere l’importo', 'linkish');
    prompt.type = 'button';
    prompt.addEventListener('click', () => goTo('3'));
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
  const when = dateLabel(info.row.deadline);
  if (info.urgent) {
    const left = info.days === 0 ? 'Scade oggi' : info.days === 1 ? 'Manca 1 giorno' : `Mancano ${info.days} giorni`;
    p.append(bold(left), el('br'), `Il mese di ${monthLabel(info.row.month)} va chiesto entro il ${when}.`);
  } else {
    p.append(bold(`Hai tempo fino al ${when}`), el('br'), `per il mese di ${monthLabel(info.row.month)}.`);
  }
  if (info.others === 1) p.append(` L’altro mese scade il ${dateLabel(info.otherFrom)}.`);
  else if (info.others > 1 && info.otherFrom === info.otherTo) p.append(` Gli altri ${info.others} mesi scadono il ${dateLabel(info.otherFrom)}.`);
  else if (info.others > 1) p.append(` Gli altri ${info.others} mesi scadono tra il ${dateLabel(info.otherFrom)} e il ${dateLabel(info.otherTo)}.`);
  box.append(clock(), p);
  return box;
}

function newTab(a) {
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function copyButton(text) {
  const button = el('button', 'Copia i dati', 'linkish copy');
  button.type = 'button';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copiati';
    } catch {
      button.textContent = 'Non riesco a copiarli: selezionali a mano';
    }
  });
  return button;
}

function source(estimate) {
  const info = el('a', 'pagina ufficiale Trenord sull’indennizzo per ritardi');
  info.href = INFO_URL;
  newTab(info);
  return add(el('p', undefined, 'source'), 'Fonte: ', info, estimate ? '. Stima indicativa: fa fede Trenord.' : '.');
}

function helpBox() {
  const mail = el('a', 'info@iltrenotideve.eu');
  mail.href = 'mailto:info@iltrenotideve.eu';
  return add(el('div', undefined, 'help-box'), el('p', 'Hai bisogno di aiuto? Scrivici'), mail,
    el('p', 'Non siamo Trenord: la richiesta va fatta a Trenord.', 'help-note'));
}

function nowSteps(items) {
  const box = el('section', undefined, 'now');
  box.setAttribute('aria-labelledby', 'now-h');
  const h = el('h3', 'Cosa fare adesso', 'section-title');
  h.id = 'now-h';
  const list = el('ol', undefined, 'now-steps');
  for (const [what, need] of items) list.append(add(el('li'), ...[].concat(what), add(el('span', undefined, 'need'), ...[].concat(need))));
  box.append(h, list);
  return box;
}

function claimBlock(report, ctx, body) {
  const details = claimDetails(report, ctx);
  const cta = el('a', 'Accedi all’Area Personale Trenord ', 'cta');
  cta.href = CLAIM_URL;
  newTab(cta);
  const arrow = el('span', '→', 'arrow');
  arrow.setAttribute('aria-hidden', 'true');
  cta.append(arrow);
  body.append(cta);
  const months = add(el('ul', undefined, 'claim-months'), ...details.months.map((m) => el('li', m)));
  const need2 = ['Ti serve: il numero della tua tessera Trenord e i mesi da chiedere:', months];
  if (navigator.clipboard) need2.push(copyButton(details.text));
  const form = [bold('Compila il form online dedicato'), ', scegliendo la tessera e l’abbonamento.'];
  if (ctx.passType === 'annuale') form.push(' Per l’annuale Trenord suggerisce di chiedere mese per mese.');
  body.append(nowSteps([
    [[bold('Accedi all’Area Personale Trenord'), ' con il pulsante qui sopra.'], 'Ti serve: l’email e la password del tuo account Trenord.'],
    [form, need2],
    [[bold('Ricevi il voucher'), ' entro 30 giorni dalla richiesta.'],
      'Lo usi su trenord.it e malpensaexpress.it entro 12 mesi dall’emissione; entro 12 mesi puoi anche chiedere di convertirlo in denaro.'],
  ]));
}

// Everything else for a YES result, kept out of the way under "Altri dettagli".
function claimExtras(report, ctx) {
  const box = el('div', undefined, 'claim');
  const details = claimDetails(report, ctx);
  const list = el('dl', undefined, 'claim-data');
  details.items.filter(([k]) => k !== 'Mesi indennizzabili').forEach(([k, v]) => list.append(el('dt', k), el('dd', v)));
  box.append(list, el('p', 'Trenord dice di «accedere alla tua Area Personale e compilare il form online dedicato, selezionando la tessera e l’abbonamento per cui inoltrare la tua domanda».', 'claim-alt'));
  const phone = el('a', '02-72494949');
  phone.href = 'tel:+390272494949';
  const pec = el('a', 'rimborsi@pec.trenord.it');
  pec.href = 'mailto:rimborsi@pec.trenord.it';
  const paper = el('a', 'modulo Trenord');
  paper.href = FORM_URL;
  newTab(paper);
  box.append(add(el('p', undefined, 'claim-alt'), bold('Assistenza Trenord: '), 'chiama il ', phone, ' (tutti i giorni dalle 6 a mezzanotte).'));
  box.append(add(el('p', undefined, 'claim-alt'), bold('Senza Area Personale: '),
    'compila il modulo cartaceo in biglietteria o in un MyLink Point, oppure manda via PEC a ', pec,
    ' o per posta a Trenord S.r.l. – Ufficio Rimborsi, Piazzale Cadorna 14 – 20121 Milano il ', paper, ' compilato, allegando copia del documento d’identità.'));
  if (ctx.passType === 'ivol') {
    const declare = el('a', 'apposito form online');
    declare.href = DECLARE_URL;
    newTab(declare);
    box.append(add(el('p', undefined, 'claim-alt'), bold('IVOL comprato da un altro operatore? '),
      'Per avere l’indennizzo dovevi dichiarare la direttrice che usi di più entro il giorno 5 del mese di utilizzo, tramite l’', declare, '.'));
  }
  return box;
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
}

function noSteps(body) {
  const again = el('button', 'Rifai i 3 passi', 'linkish');
  again.type = 'button';
  again.addEventListener('click', () => goTo('1'));
  body.append(nowSteps([
    [bold('Per ora non c’è niente da chiedere.'), 'Nessun mese degli ultimi 12 è ancora richiedibile per questa scelta.'],
    [bold('Ricontrolla quando esce il prossimo elenco.'), 'Di solito esce entro fine mese: le tue risposte restano salvate in questo browser.'],
    [bold('Usi un’altra linea o un altro abbonamento?'), again],
  ]));
}

function excludedBlock(body) {
  const link = el('a', 'Vedi quali abbonamenti sono esclusi');
  link.href = 'regole/';
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
    const shown = state === 'expired' ? 'Scaduto' : state === 'below' ? '< 4 €' : r.index === null ? (r.qualifies ? 'Sì' : 'No') : percent(r.index, 1);
    const said = `${monthLabel(r.month)}: ${r.qualifies ? 'sopra la soglia' : 'no'}${state === 'expired' ? ', scaduto' : ''}${state === 'below' ? ', importo sotto i 4 €' : ''}${r.index === null ? '' : `, indice ${percent(r.index)}`}`;
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
    const state = tileState(r);
    const tr = el('tr', undefined, { yes: 'yes', no: 'no', expired: 'yes expired', below: 'no expired' }[state]);
    tr.append(el('td', monthLabel(r.month)));
    tr.append(el('td', state === 'below' ? 'Sotto 4 €' : r.qualifies ? 'Sì' : 'No'));
    tr.append(el('td', r.index === null ? 'n.d.' : percent(r.index)));
    tr.append(el('td', state === 'yes' || state === 'expired' ? `${dateLabel(r.deadline)}${r.expired ? ' (scaduto)' : ''}` : '–'));
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

function moreDetails(...children) {
  const d = el('details', undefined, 'details');
  d.append(el('summary', 'Altri dettagli'), ...children);
  return d;
}

function ticket(report, ctx) {
  const yes = report.claimable > 0 && !report.pass.excluded;
  const card = el('article', undefined, `ticket ${yes ? 'is-yes' : 'is-no'}`);
  const perf = el('div', undefined, 'perf');
  perf.setAttribute('aria-hidden', 'true');
  const body = el('div', undefined, 'ticket-body');
  const extras = [];
  if (report.pass.excluded) {
    excludedBlock(body);
  } else if (!report.payable && report.open > 0) {
    amountBlock(report, ctx, body);
    noSteps(body);
  } else if (yes) {
    amountBlock(report, ctx, body);
    const deadline = deadlineBlock(report);
    if (deadline) body.append(deadline);
    claimBlock(report, ctx, body);
    extras.push(claimExtras(report, ctx));
  } else {
    noBlock(report, body);
    noSteps(body);
  }
  body.append(helpBox());
  if (!report.pass.excluded) body.append(moreDetails(...extras, monthsGrid(report), table(report)));
  body.append(source(yes));
  card.append(ticketHead(report, ctx, yes), perf, body);
  return card;
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
  const price = parsePrice($('price').value) || 0;
  const report = buildReport({ data, lineCode, passType, price, today: new Date() });
  const line = PASS_TYPES[passType].scope === 'network' ? null : LINES.find((l) => l.code === lineCode);
  out.replaceChildren(ticket(report, { line, passType, price }));
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
    if (step === 'result') render();
  } catch {
    out.removeAttribute('aria-busy');
    out.replaceChildren(failure());
  }
}

const state = () => ({ line: $('line').value, passType: $('pass').value, price: $('price').value });

function showStep() {
  const result = step === 'result';
  $('check').hidden = result;
  $('result-wrap').hidden = !result;
  document.querySelector('.wiz-main').classList.toggle('in-flow', step !== '1');
  if (result) return;
  document.querySelectorAll('.wstep').forEach((s) => { s.hidden = s.dataset.step !== step; });
  const n = Number.parseInt(step, 10);
  const total = lastStep($('pass').value);
  $('progress-label').textContent = `Passo ${n} di ${STEPS}`;
  document.querySelectorAll('.progress-bar i').forEach((bar, i) => { bar.className = i + 1 < n ? 'done' : i + 1 === n ? 'on' : ''; });
  $('back').disabled = step === '1';
  $('back').hidden = step === '1';
  $('next').textContent = n === total ? 'Vedi il risultato →' : 'Avanti →';
  const annual = $('pass').value === 'annuale';
  $('price-lede').textContent = `Scrivi il prezzo del tuo abbonamento ${annual ? 'annuale' : 'mensile'}, in euro.`;
  $('price-tiny').hidden = annual;
  $('step-error').textContent = '';
}

function goTo(next) {
  step = next;
  showStep();
  if (step === 'result') {
    render();
    $('result').focus({ preventScroll: true });
  } else {
    document.querySelector(`.wstep[data-step="${step}"] .q`).focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function forward() {
  if (step === '1') {
    const choice = $('station').value.trim() && !$('line-more').open ? pickStation($('station').value.trim()) : null;
    if (choice?.choose) {
      lineCards(choice.choose);
      return goTo('1b');
    }
  }
  const n = Number.parseInt(step, 10);
  const error = stepError(n, state());
  if (error) {
    $('step-error').textContent = error;
    (n === 3 ? $('price') : $('station')).focus();
    return;
  }
  save();
  if (n >= lastStep($('pass').value)) return goTo('result');
  goTo(String(n + 1));
}

function backward() {
  if (step === '2') return goTo(linesForStation($('station').value).length > 1 ? '1b' : '1');
  if (step === '1b') return goTo('1');
  goTo(String(Number.parseInt(step, 10) - 1));
}

function start() {
  fillSelects();
  restore();
  syncPassKind();
  showLine();
  const codes = linesForStation($('station').value);
  if (codes.length > 1) lineCards(codes);
  $('station').addEventListener('input', () => {
    showSuggestions();
    const codes = linesForStation($('station').value);
    if (!codes.includes($('line').value)) $('line').value = '';
    showLine();
    save();
  });
  $('station').addEventListener('keydown', suggestionKeys);
  $('station-results').addEventListener('keydown', suggestionKeys);
  $('line').addEventListener('input', () => { showLine(); save(); });
  $('pass').addEventListener('input', () => { syncPassKind(); save(); showStep(); });
  $('price').addEventListener('input', () => { $('step-error').textContent = ''; save(); });
  document.querySelectorAll('input[name="pass-kind"]').forEach((radio) => radio.addEventListener('change', () => {
    if (!radio.checked) return;
    $('pass').value = passFromChoice(radio.value, $('pass').value);
    save();
    showStep();
  }));
  $('check').addEventListener('submit', (e) => { e.preventDefault(); forward(); });
  $('back').addEventListener('click', backward);
  $('edit').addEventListener('click', () => goTo('1'));
  step = loadPrefs(storage) && isComplete(state()) ? 'result' : '1';
  showStep();
  load();
}

start();
