import { cp, rm } from 'node:fs/promises';

const out = new URL('../_site/', import.meta.url);
await rm(out, { recursive: true, force: true });
await cp(new URL('../site/', import.meta.url), out, { recursive: true });
await cp(new URL('../data/indennizzi.json', import.meta.url), new URL('data/indennizzi.json', out));
console.log('Sito pronto in _site/');
