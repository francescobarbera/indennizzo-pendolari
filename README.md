# Indennizzo pendolari

Sito statico gratuito che dice ai pendolari lombardi se la loro direttrice ha maturato l'indennizzo mensile per ritardi e soppressioni, quanto vale, entro quando chiederlo e come. Sito indipendente, non affiliato a Trenord.

## Come funziona

- `scripts/update.mjs` legge la [pagina ufficiale degli indennizzi](https://www.trenord.it/assistenza/servizi/rimborsi-e-indennizzi/indennizzo-per-ritardi/), scarica tutti i PDF mensili linkati, li converte con `pdftotext -layout` e li analizza con `lib/parse.mjs`.
- Il parser gestisce i due formati: l'elenco delle direttrici con diritto (fino a febbraio 2026) e la `TABELLA_B` con l'indice di ogni direttrice e della rete IVOL (da marzo 2026).
- Il risultato va in `data/indennizzi.json`. Se anche un solo PDF non si legge, lo script esce con errore e non scrive nulla.
- Ogni mattina `.github/workflows/update.yml` esegue l'aggiornamento, committa i dati se sono cambiati e ripubblica il sito su GitHub Pages. In caso di errore apre (o commenta) una issue con l'etichetta `aggiornamento-fallito`.

## Sviluppo

Serve Node 22 e, per l'aggiornamento dei dati, `pdftotext` (poppler-utils).

```sh
npm test        # parser, calcoli, mappa stazioni, pagine
npm run update  # scarica e rigenera data/indennizzi.json
npm run build   # crea _site/ per GitHub Pages
```

Le fixture in `test/fixtures/` sono il testo dei PDF ufficiali da luglio 2024 ad agosto 2026.

## Regole applicate

- Una direttrice ha diritto all'indennizzo per un mese se soppressioni più ritardi oltre 15 minuti sono almeno il 10% dei treni programmati.
- Indennizzo: 30% del mensile, oppure 30% di un dodicesimo dell'annuale, per ogni mese. Abbonamenti integrati (TrenoCittà, IVOL): 10% della quota Trenord, non stimata qui. IVOL valutato sull'intera rete.
- Esclusi settimanali, STIBM, IVOP e gratuiti. Sotto i 4 € non si paga.
- Scadenza: mensile 12 mesi dalla fine di validità; annuale 12 mesi dalla pubblicazione dell'elenco (l'elenco del mese M esce entro la fine di M+2, quindi stimiamo la fine di M+14). Se il PDF indica una data, vale quella.
