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
- ☑ (14/11) I tre file TXT (assessment, allenamento, nutrizione) vengono generati e si scaricano; contenuto coerente con i tab (verificato a mano)
- ☑ (14/11) Piani di allenamento e nutrizionale completi, nessuna frase interrotta
- ☐ Piano nutrizionale: arriva fino a SUPPLEMENTAZIONE e NOTE pratiche, nessuna frase interrotta
- ☐ La scheda in tab Allenamento si popola con il core (4 esercizi) in Push, Pull e Total Body
- ☑ (14/11) Nel bin `…724`: `assessment.report.documento_assessment` presente; i log degli esercizi sono intatti
- ☑ (14/11) Download "Assessment Completo" due volte: i due file sono identici, nessuna rigenerazione
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

## F6 — Restyling tab Nutrizione (Step 1)
- [ ] Pillola Allenamento/Riposo: cambia il target (2845 → 2495 kcal con 80/185/38) e `aria-pressed` segue.
- [ ] Anello: archi proporzionali, `#kcal-value` al centro, legenda con grammi e % uguali a quelli degli accordion.
- [ ] Accordion Proteine/Carboidrati/Grassi: si aprono uno alla volta, alimenti e grammature identici a prima.
- [ ] Icona (i): mostra il testo "Come usarlo" originale; chiude con Esc, clic fuori, "Chiudi".
- [ ] Titolo di pagina cambia per tab; tagline solo su Nutrizione.
- [ ] Dopo un assessment: card "Piano Nutrizionale da Assessment AI" e "Distribuzione Pasti" visibili, senza emoji.
- [ ] Nav flottante leggibile su iPhone e PC; tasto chat non copre la nav.

### F6b — Dettaglio pasti in accordion
- [ ] Dopo un assessment: il piano nutrizionale è diviso in accordion per titolo; il primo è aperto; i testi coincidono con il documento scaricato.
- [ ] Se il piano contiene una sezione "Timing", il suo testo compare anche nel pannello (i).
- [ ] Formato a doppia colonna: ogni pasto è un accordion con kcal e P/C/G per Allen. e Riposo.

### F6c — Piano nutrizionale in sotto-sezioni con switch giorno
- [ ] Dopo un assessment: "Macro Target e Timing Nutrienti" mostra i macro di Allenamento e Riposo (come nel piano) e la tabella Timing; il giorno selezionato in alto è evidenziato.
- [ ] "Distribuzione Pasti": Colazione, Metà Mattina, Pranzo, Metà Pomeriggio, Cena; cambiando Giorno Allenamento/Riposo cambia il contenuto di ogni pasto e i pasti aperti restano aperti.
- [ ] "Supplementazione" e "Note" (titolo originale del piano) mostrano il testo del piano.
- [ ] Nessuna sezione "Altro" inattesa; se compare, annotare il titolo e segnalarlo.
- [ ] Piano con formato non riconosciuto: si vede il raggruppamento a titoli (ripiego), nessun testo perso.
- [ ] Il testo del piano nella tab coincide con il file Piano Nutrizionale scaricato.

## F7 — Restyling tab Allenamento (Step 2)
- [ ] Esporta/Importa backup non sono più in Allenamento: sono in fondo al Profilo, con lo stesso comportamento (file `backup_allenamento_AAAA-MM-GG.json`).
- [ ] Ogni esercizio è una card; se ha dati, mostra il badge con l'ultimo carico (kg, oppure serie x rip se senza peso) e la riga "Ultima: …" identica a prima.
- [ ] "+ Registra" apre l'esercizio e mette il cursore sul campo serie; "Salva" salva come prima (stessa chiave per sessione, es. `Lat machine_PULL`).
- [ ] Clic sul nome apre/chiude l'esercizio; storico ed eliminazione voce (✕) funzionano.
- [ ] Push / Pull / Total Body: i core (Dead Bug, Bird Dog, Pallof Press, Plank TRX) sono presenti in tutte e tre.
- [ ] Dopo un assessment la scheda si aggiorna e le card restano nello stesso stile.

## F8 — Diario e Profilo (restyling)
- `tests/diario-profilo-ui.test.js`: id/handler originali presenti, Brain Dump card evidenziata, lista report con IAM in evidenza, hero verde, pulsanti download.
- Verifica visiva manuale a 390px (anteprima): nessuno scroll orizzontale, salvataggio diario e storico funzionanti.
- Generazione piani: una chiamata per piano (allenamento, nutrizione), coperta da `static-checks.test.js`.

## F9 — Gate pre-pubblicazione e sanity check kcal
- `tests/pre-push-check.sh`: sintassi + suite + controlli statici; da eseguire PRIMA di ogni commit/push.
- `tests/kcal-sanity.test.js`: `verificaSommeKcal` boccia piani con somma fuori ±5% o pasti mancanti.
- In app: dopo la generazione, se le somme non tornano parte UN tentativo di ricalibrazione con l'errore esplicito; si tiene il piano con scarto minore.
- Limite noto: l'output reale dell'AI si verifica solo con un assessment sul deploy.

## F10 — Verifiche finali da fare con assessment reale (prima del merge in `main`)
Da eseguire su un nuovo assessment generato sul deploy Netlify di `v2`, con modulo compilato:
- [ ] **Timeout Netlify:** nessun errore/timeout nella generazione; controllare nei log di `claude-proxy` la durata delle chiamate piano nutrizionale e piano allenamento (e dell'eventuale ricalibrazione kcal) rispetto al limite della function.
- [ ] **Completezza file:** i txt "Assessment Completo", "Piano di Allenamento" e "Piano Nutrizionale" non sono tagliati (ultima sezione/riga presente).
- [ ] **Tre esempi per pasto, anche a riposo:** ogni pasto del giorno di riposo ha 3 esempi, come l'allenamento (il parser separa titolo pasto e contenuto, verificato su piano reale del 15/11).
- [ ] **Kcal coerenti (da fare al merge):** le kcal totali del tab Nutrizione (anello, tabella Macro Target, riga di controllo sotto "Distribuzione Pasti") coincidono con il file txt scaricato e con i dati generati dall'AI, per giorno di allenamento e di riposo.
- Decisione 15/11: target kcal calcolati dall'app e passati all'AI come "TARGET OBBLIGATORI" (resta così finché funziona e risulta corretto). Nessun carico in kg nel piano e nessun kg suggerito: eventuale apprendimento solo dai dati inseriti dall'utente, non ora.
- [ ] Da verificare: la formula usa sempre `+5` (Mifflin-St Jeor maschile) anche se il campo Sesso esiste; da gestire prima di aprire l'app a utenti donna.

## F11 — Memoria persistente (storico chat + profilo sintetico)
- `tests/memoria.test.js`: normalizzazione, limiti (40 messaggi, 2000 caratteri), 12 messaggi al modello, scatto ogni 10 messaggi utente, validazione del profilo, prompt anti-invenzione, integrazione statica.
- `tests/jsonbin-proxy.test.js`: alias `memoria` (patch senza toccare le altre chiavi, bin non configurato).
- Verifica end-to-end con servizi simulati (Playwright): 10 messaggi → profilo creato (useRAG=false), profilo nel prompt dell'11°, aggiornamento alla chiusura, ripristino dopo ricarica (12 messaggi), chat funzionante se il bin non c'è.
- Da fare su deploy reale: creare il bin JSONBin con contenuto `{"payload":"{}"}`, impostare `BIN_MEMORIA` su Netlify (v2), poi controllare che il profilo rifletta solo ciò che l'utente ha detto e che non ci siano timeout.

## F12 — Diario nel contesto del coach
- `tests/diario-contesto.test.js`: ultimi 7 giorni, ordine, giorni compilati/senza voce, azioni "NON fatte" esplicite, troncamento, voci incomplete, integrazione statica.
- Verifica end-to-end con servizi simulati: il diario di oggi compare nel prompt della chat (sintomi, sonno, brain dump non fatto).
- Da fare su deploy reale: il coach cita il diario in modo pertinente e non inventa giorni mancanti.

## F13 — Collaudo manuale sul deploy v2 (memoria, diario in chat, piano nutrizionale)
Prerequisiti: `BIN_MEMORIA` impostato su Netlify (v2) e bin con contenuto `{"payload":"{}"}`; modulo assessment compilato con peso, altezza, età.
1. **Banner e bin:** il banner blu dell'ambiente di test è presente; nessun errore rosso.
2. **Memoria, salvataggio:** apri la chat, scrivi 10 messaggi su obiettivi, ostacoli e limiti fisici. Nel bin memoria (JSONBin) devono comparire `userId`, `storico` (20 voci) e, entro pochi secondi dopo il 10° messaggio, `profilo`.
3. **Profilo fedele:** ogni voce del `profilo` deve riflettere solo ciò che hai scritto tu. Qualsiasi invenzione o diagnosi = difetto da segnalare.
4. **Memoria, ripristino:** chiudi e ricarica la pagina, riapri la chat: devi rivedere gli ultimi 12 messaggi. Chiedi "cosa ti ho detto sui miei obiettivi?": la risposta deve essere coerente col profilo.
5. **Chiusura chat:** scrivi 2-3 messaggi e chiudi la chat: il campo `aggiornato` del profilo deve cambiare.
6. **Diario in chat:** salva una voce di diario oggi (sonno basso, un sintomo, brain dump NON spuntato). In chat chiedi "come sto andando questa settimana?": il coach deve citare quei dati senza inventare giorni mancanti.
7. **Nuovo assessment (F10):** nessun timeout; file Assessment, Piano di Allenamento, Piano Nutrizionale non tagliati; 3 esempi per pasto anche a riposo; kcal del tab Nutrizione = txt = piano AI (giorno di allenamento e di riposo).
8. **Modulo vuoto:** lascia peso, altezza o età vuoti e premi "Avanti": deve comparire "Compila prima: …" e non deve generare nulla.
9. **Tab restylati su iPhone:** Nutrizione, Allenamento, Diario, Profilo senza scroll orizzontale, nav flottante non sovrapposta ai contenuti.
10. **Log Netlify:** nessun errore o timeout in `claude-proxy` e `jsonbin-proxy`; annota la durata massima delle chiamate.

## F14 — Regola "fatti dichiarati vs deduzioni" nel prompt del coach
- `tests/diario-contesto.test.js`: la regola è nel prompt di sistema, prima del contesto assessment.
- Collaudo manuale (deploy): ripetere in chat "ho fatto candidature e non trovo un lavoro adeguato" e "dormivo 5 ore": il coach non deve affermare come fatti cose non dette (es. come scrive le candidature), né contraddire i dati dichiarati senza spiegare su quale base; le deduzioni devono essere domande o ipotesi. Lo stile resta diretto.
