import { LINES } from './lines.mjs';
import { PASS_TYPES } from './refund.mjs';
import { normalize, searchStations } from './stations.mjs';
import { buildReport } from './report.mjs';
import { MAIN_PASSES, OTHER_PASSES, browserStorage, loadPrefs, passChoice, passFromChoice, savePrefs } from './prefs.mjs';
import { ticket } from './ticket.mjs';
import { dataPill } from './view.mjs';
import { STEPS, isComplete, lastStep, lineChoice, linePlain, linesForStation, offerLineList, parsePrice, pricePlaceholder, priceUnit, stepError } from './wizard.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const add = (parent, ...children) => { parent.append(...children); return parent; };
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

// The line list appears only when the station search finds nothing.
function showLineList(submitted = false) {
  const more = $('line-more');
  more.hidden = !offerLineList({ station: $('station').value, line: $('line').value, submitted });
  if (more.hidden) more.open = false;
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
  if (plain) $('step-error').textContent = '';
}

function lineCards(codes) {
  const box = $('line-cards');
  box.querySelectorAll('label').forEach((n) => n.remove());
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
  if (!found.length && normalize(typed).length >= 2) list.append(add(el('li'), el('p', `Nessuna stazione per “${typed}”.`, 'empty')));
  list.hidden = list.children.length === 0;
  $('station-count').textContent = typed
    ? (found.length ? `${found.length} ${found.length === 1 ? 'stazione' : 'stazioni'}` : 'Nessuna stazione trovata. Puoi scegliere la linea dall’elenco.')
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
  const today = new Date();
  const report = buildReport({ data, lineCode, passType, price, today });
  const line = PASS_TYPES[passType].scope === 'network' ? null : LINES.find((l) => l.code === lineCode);
  const copy = navigator.clipboard ? (text) => navigator.clipboard.writeText(text) : null;
  out.replaceChildren(ticket(report, { line, passType, price }, { today, goTo, copy }));
}

function fillUpdated() {
  const text = dataPill(data);
  if (!text) return;
  $('updated').textContent = text;
  $('updated').hidden = false;
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
  $('price-unit').textContent = priceUnit($('pass').value);
  $('price').placeholder = pricePlaceholder($('pass').value);
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
    if (n === 1) {
      // A partial name still has matches to pick from; otherwise offer the line list.
      if (searchStations($('station').value).length) showSuggestions();
      showLineList(true);
    }
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
  showLineList();
  const codes = linesForStation($('station').value);
  if (codes.length > 1) lineCards(codes);
  $('station').addEventListener('input', () => {
    showSuggestions();
    const codes = linesForStation($('station').value);
    if (!codes.includes($('line').value)) $('line').value = '';
    showLine();
    showLineList();
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
  $('wizard-loading').hidden = true;
  document.querySelector('.wiz-main').classList.add('ready');
  load();
}

start();
