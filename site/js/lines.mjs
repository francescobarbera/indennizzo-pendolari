export const LINES = [
  ['01', 'Novara-Milano-Treviglio'],
  ['02', 'Saronno-Seregno-Milano-Albairate'],
  ['03', 'Domodossola-Gallarate-Milano'],
  ['04', 'Porto Ceresio-Varese-Gallarate-Milano'],
  ['05', 'Luino-Gallarate-Milano'],
  ['06', 'Chiasso-Como-Monza-Milano'],
  ['07', 'Tirano-Sondrio-Lecco-Milano'],
  ['08', 'Lecco-Molteno-Monza-Milano'],
  ['09', 'Chiavenna-Colico'],
  ['10', 'Lecco-Molteno-Como'],
  ['11', 'Lecco-Bergamo-Brescia'],
  ['12', 'Bergamo-Carnate-Milano'],
  ['14', 'Bergamo-Treviglio'],
  ['15', 'Bergamo-Pioltello-Milano'],
  ['16', 'Cremona-Treviglio'],
  ['17', 'Verona-Brescia-Treviglio-Milano'],
  ['18', 'Brescia-Piadena-Parma'],
  ['19', 'Brescia-Cremona'],
  ['20', 'Mantova-Cremona-Lodi-Milano'],
  ['21', 'Piacenza-Lodi-Milano'],
  ['22', 'Alessandria-Pavia-Milano'],
  ['23', 'Stradella-Pavia-Milano'],
  ['24', 'Pavia-Codogno'],
  ['25', 'Alessandria-Mortara-Milano'],
  ['26', 'Mortara-Novara'],
  ['27', 'Pavia-Torreberetti-Alessandria'],
  ['28', 'Pavia-Mortara-Vercelli'],
  ['29', 'Voghera-Piacenza'],
  ['30', 'Laveno-Varese-Saronno-Milano'],
  ['31', 'Como-Saronno-Milano'],
  ['32', 'Novara-Saronno-Milano'],
  ['33', 'Asso-Seveso-Milano'],
  ['34', 'Brescia-Iseo-Edolo'],
  ['35', 'Malpensa-Milano'],
  ['36', 'Saronno-Milano-Lodi (S1, S3, S12)'],
  ['37', 'Mariano/Camnago-Seveso-Milano (S2, S4)'],
  ['39', 'Lecco-Carnate-Milano'],
  ['40', 'Treviglio-Milano Passante-Varese'],
  ['42', 'Malpensa-Varese-Mendrisio-Como (S10, S40, S50)'],
].map(([code, name]) => ({ code, name }));

export const IVOL = { code: 'IVOL', name: 'Intera rete (abbonamento IVOL)' };

export const LINE_CODES = new Set(LINES.map((l) => l.code));

export function lineByCode(code) {
  if (code === IVOL.code) return IVOL;
  return LINES.find((l) => l.code === code);
}
