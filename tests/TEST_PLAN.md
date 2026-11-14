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

## F3 — Log per sessione (`esercizio_SESSIONE`) con lettura dello storico precedente
Automatici: `log-keys.test.js` (chiavi distinte per sessione, voci vecchie visibili e marcate, ordinamento, chiave di eliminazione, assessment ignorato).
Manuali (sulla v2, con una copia dei tuoi dati nel bin di test):
- ☑ (14/11) Scheda di default: il core (Dead Bug, Bird Dog, Pallof Press, Plank TRX) è in Push, Pull e Total Body
- ☑ (14/11) Un esercizio salvato in una sessione compare solo lì (verificato a mano su bin di test vuoto)
- ☐ Con una copia dei dati di produzione nel bin `…724`: le voci vecchie compaiono con l'etichetta "storico precedente"
- ☐ Nel bin `…724` esiste la chiave per sessione (es. `Dead Bug_PUSH`) e la chiave vecchia `Dead Bug` è invariata
- ☐ Elimina una voce nuova e una vecchia: spariscono dalla chiave giusta
- ☐ La data "Ultima:" nella testata della card mostra la voce più recente

## F4 — Input vocale in chat (soluzione A: riconoscimento vocale del browser)
Automatici: `voice.test.js` (lingua it-IT, avvio/stop, testo aggiunto a quello scritto, parte provvisoria + finale, errori e messaggi, start che fallisce, microfono visibile solo con supporto).
Manuali (da fare **sull'iPhone**, nei due modi):
- ☑ (14/11) Safari su iPhone: il microfono 🎤 è visibile nella chat; tocco → "Sto ascoltando…"; parlo → il testo compare nel campo; tocco di nuovo → si ferma
- ☑ (14/11) Il testo detto compare nel campo (iPhone Safari e PC)
- ☐ Con Siri/Dettatura disattivati: messaggio chiaro, nessun blocco della chat
- ☐ App aggiunta alla schermata Home: se non funziona, appare il messaggio che spiega cosa fare (annotare il comportamento: serve per decidere se passare alla soluzione B)
- ☐ Permesso microfono negato: messaggio chiaro
- ☑ (14/11) Su PC Windows: funziona (browser da annotare)
- ☐ Parlare in italiano frasi con termini tecnici (es. "Lat machine", "epicondilite", "Pallof Press"): annotare gli errori di trascrizione
Esito da riportare nel backlog: se la A è inaffidabile su iPhone → attivare il task "evoluzione B".

## F5 — Chiamata 8 (documento assessment salvato), piani non troncati, storico degli assessment
Automatici: `assessment.test.js` (nuovi tentativi, continuazione delle risposte tagliate con limite, archivio compatto, ordine, duplicati, massimo di voci, dimensione), `jsonbin-proxy.test.js` (patch con più chiavi), controlli statici sul flusso.
Manuali (consumano token: l'assessment completo si fa **una volta**, sul bin di test; per il secondo assessment serve una seconda esecuzione):
- ☑ (14/11) Assessment completo sulla v2 con le tre foto: termina senza errori (tempo totale non annotato)
- ☑ (14/11) I tre file TXT (assessment, allenamento, nutrizione) vengono generati e si scaricano; contenuto coerente con i tab (verificato a mano). Da confermare esplicitamente: ultima sezione dei piani senza frasi interrotte
- ☐ Piano nutrizionale: arriva fino a SUPPLEMENTAZIONE e NOTE pratiche, nessuna frase interrotta
- ☐ La scheda in tab Allenamento si popola con il core (4 esercizi) in Push, Pull e Total Body
- ☐ Nel bin `…724`: `assessment.report.documento_assessment` presente; i log degli esercizi sono intatti
- ☐ Download "Assessment Completo" due volte: i due file sono **identici**
- ☐ Secondo assessment: nel bin compare `assessment_storico` con la voce precedente in forma compatta (senza piani lunghi); `assessment` è il nuovo
- ☐ Con una copia dei dati di produzione (assessment del 16/09 senza documento): il primo download lo genera e lo salva, il secondo è identico
- ☐ Dimensione del bin dopo l'assessment: da annotare, e da confrontare con il limite del piano JSONBin
- ☐ Con la funzione Claude lenta o in errore temporaneo: l'assessment non resta a metà (annotare il comportamento)

## Regressione sulle funzioni già esistenti (da rifare prima del merge)
- ☐ Caricamento iniziale con bin vuoto: nessun errore in console
- ☐ Scheda: giorni, esercizi, salvataggio di serie/ripetizioni/peso/note
- ☐ Diario: salva e ricarica una voce
- ☐ Assessment completo (foto Cloudinary + 7 chiamate): termina e salva
- ☐ Download piano allenamento / nutrizione / assessment
- ☐ Chat: risposta con RAG, retry automatico su errore
- ☐ Benchmark RAG sul deploy v2 (soglia: ≥ 4.5; riferimento 4.7). Sotto soglia = niente merge

## Prossime funzionalità (da compilare quando si implementano)
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
