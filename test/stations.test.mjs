import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATIONS, searchStations } from '../site/js/stations.mjs';
import { LINES } from '../site/js/lines.mjs';

test('all Dir. 07 stations map to line 07', () => {
  for (const s of ['Milano Centrale', 'Monza', 'Lecco', 'Varenna-Esino-Perledo', 'Colico', 'Morbegno', 'Sondrio', 'Tirano']) {
    assert.ok(STATIONS.get(s).includes('07'), s);
  }
});

test('shared stations list every line they serve', () => {
  assert.deepEqual(STATIONS.get('Colico'), ['07', '09']);
  assert.ok(STATIONS.get('Lecco').includes('39'));
});

test('search is accent and case insensitive and prefers prefix matches', () => {
  const [first] = searchStations('morb');
  assert.deepEqual(first, { name: 'Morbegno', lines: ['07'] });
  assert.equal(searchStations('SONDRIO')[0].name, 'Sondrio');
  assert.deepEqual(searchStations('m'), []);
});

test('every line endpoint town is searchable', () => {
  for (const line of LINES) {
    const town = line.name.split('-')[0].replace(/\(.*\)/, '').trim();
    assert.ok(STATIONS.get(town)?.includes(line.code), `${line.code} ${town}`);
  }
});
