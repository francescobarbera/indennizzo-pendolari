import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseIndennizzo, ParseError } from '../lib/parse.mjs';

const dir = new URL('./fixtures/', import.meta.url);
const parsed = readdirSync(dir).filter((f) => f.endsWith('.txt'))
  .map((f) => parseIndennizzo(readFileSync(new URL(f, dir), 'utf8'), f));
const byMonth = Object.fromEntries(parsed.map((p) => [p.month, p]));

function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key === to) return out;
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
}

const ARCHIVE = monthsBetween('2024-07', '2026-08');

test('every archived month Jul 2024 - Aug 2026 parses exactly once', () => {
  assert.deepEqual(parsed.map((p) => p.month).sort(), ARCHIVE);
});

test('Dir. 07 qualifies exactly in the expected months', () => {
  const expected = new Set(['2024-07', '2024-09', '2024-10', '2024-11', '2024-12',
    '2025-01', '2025-05', '2025-06', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-06', '2026-07', '2026-08']);
  for (const month of ARCHIVE) {
    assert.equal(byMonth[month].lines['07'].qualifies, expected.has(month), month);
  }
});

test('table months carry an index for every line and the network', () => {
  const march = byMonth['2026-03'];
  assert.equal(march.format, 'tabella');
  assert.equal(march.lines['07'].index, 3.74);
  assert.deepEqual(march.lines['05'], { qualifies: true, index: 10.3, deadline: null });
  assert.deepEqual(march.ivol, { qualifies: false, index: 5.13, deadline: null });
});

test('list months read stated deadlines, wrapped lines and IVOL', () => {
  assert.equal(byMonth['2024-07'].lines['12'].deadline, '2026-10');
  assert.equal(byMonth['2024-08'].lines['08'].deadline, '2025-11');
  assert.equal(byMonth['2026-01'].ivol.qualifies, true);
  assert.equal(byMonth['2025-10'].lines['31'].qualifies, true);
  assert.equal(byMonth['2025-10'].lines['07'].deadline, null);
});

test('rejects text that is not a recognisable indennizzo PDF', () => {
  assert.throws(() => parseIndennizzo('', 'x'), ParseError);
  assert.throws(() => parseIndennizzo('<html>Errore</html>', 'x'), ParseError);
  assert.throws(() => parseIndennizzo('MARZO 2026\n• Dir. 99 Nowhere', 'x'), /sconosciuta/);
  assert.throws(() => parseIndennizzo('MARZO 2026\nnessun elenco', 'x'), /vuoto/);
});

test('rejects an incomplete table or an index inconsistent with the outcome', () => {
  const table = readFileSync(new URL('TABELLA_B_MARZO_26.txt', dir), 'utf8');
  const truncated = table.split('\n').filter((l) => !/^\s+07\s/.test(l)).join('\n');
  assert.throws(() => parseIndennizzo(truncated, 'x'), /mancano: 07/);
  const flipped = table.replace(/(Tirano-Sondrio-Lecco-Milano\s+3,74\s+)No/, '$1SI');
  assert.throws(() => parseIndennizzo(flipped, 'x'), /incoerente/);
});
