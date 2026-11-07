// The result ticket, built with DOM calls only (never HTML strings).
import { claimDetails, dateLabel, euro, monthLabel } from './report.mjs';
import { PASS_SHORT, barWidth, deadlineInfo, percent, worstMonth } from './view.mjs';
import { linePlain } from './wizard.mjs';

const CLAIM_URL = 'https://www.trenord.it/store/#/it/auth/login';
const DECLARE_URL = 'https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/dichiarazione-utilizzo-abbonamento-integrato/';
const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const add = (parent, ...children) => { parent.append(...children); return parent; };
const bold = (text) => el('b', text);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

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

function newTab(a) {
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function ticketHead(report, ctx, yes) {
  const head = el('div', undefined, 'ticket-head');
  const meta = el('div', undefined, 'ticket-meta');
  meta.append(el('span', ctx.line ? linePlain(ctx.line.code).ends : 'Intera rete', 'chip'));
  meta.append(el('span', `${PASS_SHORT[ctx.passType]}${ctx.price > 0 && !report.pass.integrated && !report.pass.excluded ? ` · ${plainEuro(ctx.price)}` : ''}`, 'chip'));
  const stamp = el('div', yes ? 'SÌ' : 'NO', 'stamp');
  stamp.setAttribute('aria-hidden', 'true');
  const words = el('div');
  let title = yes ? 'Sì, ti spetta l’indennizzo' : 'Per ora no';
  let sub = null;
  if (report.pass.excluded) {
    title = 'Questo abbonamento è escluso';
    sub = 'Non dà diritto all’indennizzo per ritardi';
  } else if (!report.payable && report.open > 0) {
    title = 'Sotto i 4 €: niente indennizzo';
    sub = `La linea ha superato la soglia in ${mesi(report.open)}, ma l’importo è sotto il minimo`;
  } else if (yes && ctx.passType === 'ivol') {
    title = 'Sì, se l’IVOL è di Trenord o hai dichiarato la direttrice';
    const declare = el('a', 'dichiarazione della direttrice');
    declare.href = DECLARE_URL;
    newTab(declare);
    sub = add(el('p'), 'IVOL di altri operatori: serve la ', declare, ' entro il 5 del mese');
  } else if (!yes && report.rows.some((r) => r.qualifies)) {
    sub = 'Nessun mese ancora richiedibile negli ultimi 12';
  } else if (!yes && report.rows.some((r) => r.index === null)) {
    // Months before March 2026 have no index, so the worst month below may not cover the whole year.
    sub = 'Nessun mese sopra la soglia negli ultimi 12';
  }
  words.append(el('h2', title));
  if (sub) words.append(typeof sub === 'string' ? el('p', sub) : sub);
  head.append(meta, add(el('div', undefined, 'verdict'), stamp, words));
  return head;
}

function condition(report) {
  if (report.pass.scope === 'network') return 'Ti spetta se avevi un abbonamento valido in ciascuno di questi mesi.';
  const priced = report.refund.status === 'amount' ? ', a questo prezzo' : '';
  return `Ti spetta se avevi un abbonamento valido per questa linea in ciascuno di questi mesi${priced}.`;
}

function amountBlock(report, ctx, body, { yes, goTo }) {
  const { refund, pass } = report;
  if (refund.status === 'amount') {
    body.append(el('p', 'Fino a circa', 'amount-label'));
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
    prompt.addEventListener('click', () => goTo('3'));
    body.append(add(el('div', undefined, 'note-box'), add(el('p'), prompt)));
  }
  if (yes) {
    body.append(add(el('div', undefined, 'must'),
      el('p', condition(report), 'condition'),
      el('p', 'Arriva come voucher Trenord, convertibile in denaro entro 12 mesi.', 'voucher')));
  }
  if (pass.scope === 'network') body.append(el('p', 'Gli IVOL sono valutati sull’intera rete, non sulla singola direttrice.', 'hint'));
}

function deadlineBlock(report, today) {
  const info = deadlineInfo(report, today);
  if (!info) return null;
  const box = el('div', undefined, info.urgent ? 'deadline' : 'deadline calm');
  box.setAttribute('role', 'note');
  const left = info.days === 0 ? 'Scade oggi' : info.days === 1 ? 'Manca 1 giorno' : `Mancano ${info.days} giorni`;
  const p = add(el('p'), bold(left), el('br'), `${capital(monthLabel(info.row.month))} va chiesto entro il ${dateLabel(info.row.deadline)}.`);
  box.append(clock(), p);
  return box;
}

function copyButton(text, copy) {
  const button = el('button', 'Copia i dati', 'linkish copy');
  button.type = 'button';
  button.addEventListener('click', async () => {
    try {
      await copy(text);
      button.textContent = 'Copiati';
    } catch {
      button.textContent = 'Non riesco a copiarli: selezionali a mano';
    }
  });
  return button;
}

function nowSteps(items) {
  const box = el('section', undefined, 'now');
  box.setAttribute('aria-labelledby', 'now-h');
  const h = el('h3', 'Cosa fare adesso', 'section-title');
  h.id = 'now-h';
  const list = el('ol', undefined, 'now-steps');
  for (const [what, need] of items) {
    const li = add(el('li'), ...[].concat(what));
    if (need) li.append(add(el('span', undefined, 'need'), ...[].concat(need)));
    list.append(li);
  }
  box.append(h, list);
  return box;
}

function claimBlock(report, ctx, body, { copy }) {
  const details = claimDetails(report, ctx);
  const login = add(el('a'), bold('Accedi all’Area Personale Trenord'));
  login.href = CLAIM_URL;
  newTab(login);
  const months = add(el('ul', undefined, 'claim-months'), ...details.months.map((m) => el('li', m)));
  const need2 = [months];
  if (ctx.passType === 'annuale') need2.push('Per l’annuale Trenord suggerisce di chiedere mese per mese. ');
  if (copy) need2.push(copyButton(details.text, copy));
  body.append(nowSteps([
    [login, 'Ti servono email e password Trenord.'],
    [bold('Compila il modulo con il numero della tessera e questi mesi:'), need2],
    [bold('Ricevi il voucher entro 30 giorni.')],
  ]));
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

// A new list can turn a month into a yes, but never lifts an amount under 4 €: no "check again" there.
function noSteps(body, { goTo, recheck }) {
  const again = el('button', 'Rifai i 3 passi', 'linkish');
  again.type = 'button';
  again.addEventListener('click', () => goTo('1'));
  const items = recheck ? [[bold('Ricontrolla a fine mese, quando esce il nuovo elenco.')]] : [];
  body.append(nowSteps([...items, [again]]));
}

function excludedBlock(body) {
  const link = el('a', 'Vedi quali abbonamenti sono esclusi');
  link.href = 'regole/';
  body.append(add(el('p', undefined, 'near'), link));
}

// opts: today (Date), goTo(step) to send the user back into the wizard, copy(text) or null without a clipboard.
export function ticket(report, ctx, opts) {
  const yes = report.claimable > 0 && !report.pass.excluded;
  const card = el('article', undefined, `ticket ${yes ? 'is-yes' : 'is-no'}`);
  const perf = el('div', undefined, 'perf');
  perf.setAttribute('aria-hidden', 'true');
  const body = el('div', undefined, 'ticket-body');
  if (report.pass.excluded) {
    excludedBlock(body);
  } else if (!report.payable && report.open > 0) {
    amountBlock(report, ctx, body, { ...opts, yes });
    noSteps(body, { ...opts, recheck: false });
  } else if (yes) {
    amountBlock(report, ctx, body, { ...opts, yes });
    const deadline = deadlineBlock(report, opts.today);
    if (deadline) body.append(deadline);
    claimBlock(report, ctx, body, opts);
  } else {
    noBlock(report, body);
    noSteps(body, { ...opts, recheck: true });
  }
  card.append(ticketHead(report, ctx, yes), perf, body);
  return card;
}
