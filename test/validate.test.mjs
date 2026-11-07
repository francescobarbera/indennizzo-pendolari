import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateData } from '../lib/validate.mjs';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

test('the published data and the frozen fixture are structurally valid', () => {
  assert.deepEqual(validateData(load('../data/indennizzi.json')), []);
  assert.deepEqual(validateData(load('./fixtures/indennizzi-2026-11.json')), []);
});

test('broken data is rejected with a reason', () => {
  const data = load('./fixtures/indennizzi-2026-11.json');
  const broken = structuredClone(data);
  delete broken.months[3].lines['07'];
  broken.months[4].lines['12'].qualifies = 'SI';
  broken.months[5].source = 'https://example.com/x.pdf';
  broken.months[6].month = broken.months[5].month;
  delete broken.months[7].ivol;
  const problems = validateData(broken);
  for (const re of [/Dir\. 07: esito mancante/, /Dir\. 12: esito mancante/, /fonte non Trenord/, /duplicati/, /IVOL: esito mancante/]) {
    assert.ok(problems.some((p) => re.test(p)), re.source);
  }
  assert.deepEqual(validateData({ months: [] }), ['nessun mese nei dati']);
});

test('the publication date is optional but must be a real date after the month', () => {
  const data = load('./fixtures/indennizzi-2026-11.json');
  const m = data.months.find((x) => x.month === '2025-10');
  m.published = '2025-12-19';
  assert.deepEqual(validateData(data), []);
  for (const bad of ['2025-10-20', '2025-12', '19/12/2025', null]) {
    m.published = bad;
    assert.ok(validateData(data).some((p) => /2025-10: data di pubblicazione non valida/.test(p)), String(bad));
  }
});
