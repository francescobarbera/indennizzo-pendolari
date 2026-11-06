// Pure helpers for the 3-step guided check (no DOM), testable in node.
import { LINES } from './lines.mjs';
import { PASS_TYPES } from './refund.mjs';
import { STATIONS, normalize } from './stations.mjs';

export const STEPS = 3;

// Lines serving a station typed or picked by name; [] when the name is not a known station.
export function linesForStation(name) {
  const q = normalize(String(name ?? ''));
  if (!q) return [];
  for (const [station, codes] of STATIONS) if (normalize(station) === q) return codes;
  return [];
}

// One line: choose it for the user. Several: ask which one. None: let them pick from the list.
export function lineChoice(codes) {
  if (codes.length === 1) return { auto: codes[0] };
  if (codes.length > 1) return { choose: codes };
  return { none: true };
}

// Line names in plain words: "Tirano – Sondrio – Lecco – Milano"; cards show ends and the towns between.
export function linePlain(code) {
  const line = LINES.find((l) => l.code === code);
  if (!line) return null;
  const towns = line.name.split('-').map((t) => t.trim());
  const middle = towns.slice(1, -1);
  return {
    full: towns.join(' – '),
    ends: `${towns[0]} – ${towns.at(-1)}`,
    via: middle.length ? `via ${middle.length === 1 ? middle[0] : `${middle.slice(0, -1).join(', ')} e ${middle.at(-1)}`}` : '',
  };
}

// Integrated passes have no amount to compute and excluded ones pay nothing, so they skip the price.
export function needsPrice(passType) {
  const pass = PASS_TYPES[passType];
  return Boolean(pass) && !pass.integrated && !pass.excluded;
}

export function lastStep(passType) {
  return needsPrice(passType) ? 3 : 2;
}

export function parsePrice(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  return /^\d{1,5}(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
}

// What stops the user from going on from a step, in plain words; null when they can go on.
export function stepError(step, { line, passType, price }) {
  if (step === 1 && !line && PASS_TYPES[passType]?.scope !== 'network') return 'Scegli la stazione o la linea per andare avanti.';
  if (step === 3 && needsPrice(passType) && !(parsePrice(price) > 0)) return 'Scrivi il prezzo in euro, per esempio 61.';
  return null;
}

// A saved set of answers that is complete enough to show the result straight away.
export function isComplete(state) {
  return [1, 3].every((step) => stepError(step, state) === null);
}
