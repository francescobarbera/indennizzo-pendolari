import { readFile } from 'node:fs/promises';
import { assertValidData } from '../lib/validate.mjs';

try {
  const data = JSON.parse(await readFile(new URL('../data/indennizzi.json', import.meta.url), 'utf8'));
  assertValidData(data);
  console.log(`Dati validi: ${data.months.length} mesi, ultimo ${data.months.at(-1).month}.`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
