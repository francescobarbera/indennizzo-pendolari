import { LINE_CODES } from './lines.mjs';
import { PASS_TYPES } from './refund.mjs';

export const PREFS_KEY = 'indennizzo-pendolari:prefs:v1';
export const MAIN_PASSES = ['mensile', 'annuale'];
export const OTHER_PASSES = Object.keys(PASS_TYPES).filter((k) => !MAIN_PASSES.includes(k));
const DEFAULT_PASS = 'mensile';

// Which control of the pass picker represents a pass type: 'mensile', 'annuale' or 'altro'.
export function passChoice(passType) {
  if (MAIN_PASSES.includes(passType)) return passType;
  return Object.hasOwn(PASS_TYPES, passType) ? 'altro' : DEFAULT_PASS;
}

// The pass type selected by a picker choice; 'altro' keeps the current other type or picks the first one.
export function passFromChoice(choice, current) {
  if (MAIN_PASSES.includes(choice)) return choice;
  if (choice === 'altro') return OTHER_PASSES.includes(current) ? current : OTHER_PASSES[0];
  return DEFAULT_PASS;
}

function cleanPrice(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  return /^\d{1,5}(\.\d{1,2})?$/.test(text) ? text : '';
}

export function sanitizePrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    station: typeof p.station === 'string' ? p.station.trim().slice(0, 80) : '',
    line: typeof p.line === 'string' && LINE_CODES.has(p.line) ? p.line : '',
    pass: typeof p.pass === 'string' && Object.hasOwn(PASS_TYPES, p.pass) ? p.pass : DEFAULT_PASS,
    price: cleanPrice(p.price),
  };
}

export function loadPrefs(storage) {
  try {
    const raw = storage?.getItem(PREFS_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function savePrefs(storage, prefs) {
  try {
    if (!storage) return false;
    storage.setItem(PREFS_KEY, JSON.stringify(sanitizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}

// Reading window.localStorage itself can throw (privacy modes, blocked storage).
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
