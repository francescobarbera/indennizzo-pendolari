import { LINES } from './lines.mjs';

const DIR_07 = ['Milano Centrale', 'Milano Porta Garibaldi', 'Sesto San Giovanni', 'Monza', 'Arcore',
  'Carnate-Usmate', 'Osnago', 'Cernusco-Merate', 'Olgiate-Calco-Brivio', 'Airuno',
  'Calolziocorte-Olginate', 'Vercurago-San Girolamo', 'Lecco Maggianico', 'Lecco',
  'Abbadia Lariana', 'Mandello del Lario', 'Olcio', 'Lierna', 'Fiumelatte', 'Varenna-Esino-Perledo',
  'Bellano-Tartavalle Terme', 'Dervio', 'Dorio', 'Piona', 'Colico', 'Delebio', 'Cosio-Traona',
  'Morbegno', 'Talamona', 'Ardenno-Masino', 'San Pietro Berbenno', 'Castione Andevenno', 'Sondrio',
  'Poggiridenti-Tresivio-Piateda', 'Ponte in Valtellina', 'Chiuro', 'San Giacomo di Teglio',
  'Tresenda-Aprica-Teglio', 'Bianzone', 'Villa di Tirano', 'Tirano'];

const LECCO_CARNATE = DIR_07.slice(DIR_07.indexOf('Arcore'), DIR_07.indexOf('Lecco') + 1);

const EXTRA = {
  '09': ['Colico'],
  '39': ['Milano Porta Garibaldi', 'Sesto San Giovanni', 'Monza', ...LECCO_CARNATE],
};

function townsOf(name) {
  return name.replace(/\(.*\)/, '').split('-').map((t) => t.trim()).filter(Boolean);
}

function buildIndex() {
  const index = new Map();
  const add = (station, code) => {
    if (!index.has(station)) index.set(station, new Set());
    index.get(station).add(code);
  };
  DIR_07.forEach((s) => add(s, '07'));
  Object.entries(EXTRA).forEach(([code, list]) => list.forEach((s) => add(s, code)));
  LINES.forEach((l) => townsOf(l.name).forEach((t) => add(t, l.code)));
  return new Map([...index].map(([s, codes]) => [s, [...codes].sort()]));
}

export const STATIONS = buildIndex();

export function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function searchStations(query, limit = 8) {
  const q = normalize(query);
  if (q.length < 2) return [];
  return [...STATIONS.keys()]
    .filter((s) => normalize(s).includes(q))
    .sort((a, b) => Number(!normalize(a).startsWith(q)) - Number(!normalize(b).startsWith(q)) || a.localeCompare(b, 'it'))
    .slice(0, limit)
    .map((name) => ({ name, lines: STATIONS.get(name) }));
}
