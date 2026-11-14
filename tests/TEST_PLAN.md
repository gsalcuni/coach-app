# Piano di test — Coach App v2

Si aggiorna a ogni funzionalità. Si completa tutto **prima** del merge di `v2` su `main`.
Stato: ☐ da fare · ☑ superato (data)

## Come si eseguono
- **Automatici** (nessuna rete, pochi secondi): `node --test tests/*.test.js`
- **Manuali**: sul deploy `v2--monumental-mousse-9113b4.netlify.app`, con il banner **blu** e i bin di test (`…878724`, `…8787f4`).
- Regola: se il banner è rosso, non si salva nulla.

## F1 — Chiave JSONBin spostata in funzione Netlify
Automatici: `jsonbin-proxy.test.js` (origine, alias, info, set/get, blocco bin di produzione, chiave mancante), `static-checks.test.js` (nessuna chiave o ID bin nel codice).
Manuali:
- ☑ (14/11) Banner blu con `…878724` / `…8787f4`
- ☑ (14/11) Un carico salvato compare nel bin di test e **non** in quello di produzione
- ☐ Nel sorgente della pagina (Ctrl+U) non compare la chiave (cerca `$2a$` / `$2b$`)
- ☐ Con la funzione non raggiungibile il banner diventa rosso e spiega il motivo

## F2 — Salvataggio per singola chiave (niente sovrascrittura dell'assessment)
Automatici: patch con conservazione delle altre chiavi, due patch consecutivi, bin vuoto, chiavi pericolose, bin illeggibile.
Manuali:
- ☐ Salva un carico (esercizio A). Senza ricaricare, aggiungi a mano `"prova":"x"` nel bin `…724`. Salva un carico su esercizio B. Nel bin devono esserci A, B e `prova`
- ☐ Elimina una voce di storico: sparisce solo quella
- ☐ Assessment di prova: dopo la generazione, i log degli esercizi sono ancora tutti presenti
- ☐ Import di backup: l'assessment esistente non viene perso

## Regressione sulle funzioni già esistenti (da rifare prima del merge)
- ☐ Caricamento iniziale con bin vuoto: nessun errore in console
- ☐ Scheda: giorni, esercizi, salvataggio di serie/ripetizioni/peso/note
- ☐ Diario: salva e ricarica una voce
- ☐ Assessment completo (foto Cloudinary + 7 chiamate): termina e salva
- ☐ Download piano allenamento / nutrizione / assessment
- ☐ Chat: risposta con RAG, retry automatico su errore
- ☐ Benchmark RAG sul deploy v2 (soglia: ≥ 4.5; riferimento 4.7). Sotto soglia = niente merge

## Prossime funzionalità (da compilare quando si implementano)
- ☐ Fix chiave log per sessione (`esercizio_SESSIONE`) + migrazione dei log esistenti
- ☐ Input vocale
- ☐ Chiamata 8 + storico assessment come array (e fix del troncamento dei piani completi)
- ☐ Memoria persistente + profilo
- ☐ Diario collegato a prompt e chat
- ☐ Check mensile

## Procedura di passaggio in produzione (alla fine)
1. Tutti i test automatici verdi e tutte le caselle manuali spuntate.
2. Backup dei bin di produzione (copia del contenuto in un file).
3. Migrazione dei dati, se lo schema è cambiato (script e prova prima sui bin di test con una copia dei dati veri).
4. Su Netlify, per il contesto **Production**: `JSONBIN_KEY`, `BIN_ALLENAMENTO`, `BIN_DIARIO` con i valori di produzione e `ALLOW_PROD_BINS=1`.
5. **Ruotare la chiave master di JSONBin** e aggiornare `JSONBIN_KEY` su Netlify (la vecchia è stata esposta nell'HTML pubblico).
6. Merge di `v2` su `main`, deploy, verifica con una voce reale.
7. Piano di rientro: se qualcosa non va, revert del merge e ripristino dei bin dal backup.
