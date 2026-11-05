import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { collectMonths, mergeData } from '../lib/update.mjs';
import { assertValidData } from '../lib/validate.mjs';

const run = promisify(execFile);
const DATA = new URL('../data/indennizzi.json', import.meta.url);
const HEADERS = { 'user-agent': 'indennizzo-pendolari (+https://github.com/francescobarbera/indennizzo-pendolari)' };

async function fetchOk(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${url}`);
  return res;
}

async function main() {
  const work = await mkdtemp(join(tmpdir(), 'indennizzi-'));
  try {
    const months = await collectMonths({
      fetchText: async (url) => (await fetchOk(url)).text(),
      pdfToText: async (url) => {
        const file = join(work, 'in.pdf');
        await writeFile(file, Buffer.from(await (await fetchOk(url)).arrayBuffer()));
        const { stdout } = await run('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-']);
        return stdout;
      },
    });
    const previous = JSON.parse(await readFile(DATA, 'utf8').catch(() => 'null'));
    const { changed, data } = mergeData(previous, months, new Date());
    assertValidData(data);
    if (!changed) return console.log(`Nessuna novità (${data.months.length} mesi).`);
    const tmp = new URL('../data/indennizzi.json.tmp', import.meta.url);
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
    await rename(tmp, DATA);
    console.log(`Dati aggiornati: ${data.months.length} mesi, ultimo ${data.months.at(-1).month}.`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`Aggiornamento fallito, nessun dato scritto: ${err.message}`);
  process.exit(1);
});
