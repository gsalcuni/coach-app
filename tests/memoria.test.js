// Memoria persistente: funzioni pure estratte da index.html (marcatori MEMORIA-START/END).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const m = html.match(/\/\/ MEMORIA-START([\s\S]*?)\/\/ MEMORIA-END/);
assert.ok(m, 'marcatori MEMORIA non trovati');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(m[1] + ';this.L={normalizzaMemoria,memoriaVuota,aggiungiMessaggioMemoria,messaggiNonSintetizzati,serveAggiornamentoProfilo,haMessaggiDaSintetizzare,messaggiPerModello,promptProfilo,validaProfilo,testoProfiloPerPrompt,MAX:MEMORIA_MAX_MSG,CTX:MEMORIA_CONTESTO_MSG};', ctx);
const L = ctx.L;
const J = (x) => JSON.stringify(x);
const ts = (n) => new Date(Date.UTC(2026, 10, 15, 10, 0, n)).toISOString();

function conN(n) { let mem = L.memoriaVuota(); for (let i = 0; i < n; i++) { mem = L.aggiungiMessaggioMemoria(mem, 'user', 'd' + i, ts(i * 2)); mem = L.aggiungiMessaggioMemoria(mem, 'assistant', 'r' + i, ts(i * 2 + 1)); } return mem; }

test('normalizza: input nullo, rotto o di tipo sbagliato danno memoria vuota con userId', () => {
  for (const x of [null, undefined, '', 'non json', '[]', 42, []]) {
    const r = L.normalizzaMemoria(x);
    assert.strictEqual(r.userId, 'gianluca'); assert.strictEqual(J(r.storico), '[]'); assert.strictEqual(r.profilo, null);
  }
});
test('normalizza: scarta voci malformate e legge anche una stringa JSON', () => {
  const raw = J({ storico: [{ r: 'user', t: 'ciao', ts: ts(1) }, { r: 'boh', t: 'x', ts: ts(2) }, { r: 'user', t: '  ', ts: ts(3) }, null, { r: 'assistant', t: 'ok', ts: ts(4) }], profilo: { obiettivi: ['a'] } });
  const r = L.normalizzaMemoria(raw);
  assert.strictEqual(r.storico.length, 2);
  assert.strictEqual(r.profilo.obiettivi[0], 'a');
});
test('lo storico è limitato agli ultimi 40 messaggi e i testi a 2000 caratteri', () => {
  const mem = conN(30);
  assert.strictEqual(mem.storico.length, L.MAX);
  assert.strictEqual(mem.storico[mem.storico.length - 1].t, 'r29');
  const lungo = L.aggiungiMessaggioMemoria(L.memoriaVuota(), 'user', 'x'.repeat(5000), ts(0));
  assert.strictEqual(lungo.storico[0].t.length, 2000);
});
test('messaggi vuoti o con ruolo errato non vengono aggiunti', () => {
  let mem = L.memoriaVuota();
  mem = L.aggiungiMessaggioMemoria(mem, 'user', '   ', ts(0));
  mem = L.aggiungiMessaggioMemoria(mem, 'system', 'x', ts(1));
  assert.strictEqual(mem.storico.length, 0);
});
test('al modello vanno gli ultimi 12 messaggi e il primo è sempre dell\'utente', () => {
  const r = L.messaggiPerModello(conN(10));
  assert.ok(r.length <= L.CTX); assert.strictEqual(r[0].role, 'user');
  let mem = L.aggiungiMessaggioMemoria(L.memoriaVuota(), 'assistant', 'solo coach', ts(0));
  assert.strictEqual(L.messaggiPerModello(mem).length, 0);
});
test('aggiornamento profilo: scatta ogni 10 messaggi utente non sintetizzati', () => {
  assert.strictEqual(L.serveAggiornamentoProfilo(conN(9)), false);
  assert.strictEqual(L.serveAggiornamentoProfilo(conN(10)), true);
  let mem = conN(10);
  mem = { userId: mem.userId, storico: mem.storico, profilo: { sinteticoFinoA: mem.storico[mem.storico.length - 1].ts } };
  assert.strictEqual(L.serveAggiornamentoProfilo(mem), false);
  assert.strictEqual(L.haMessaggiDaSintetizzare(mem), false);
  mem = L.aggiungiMessaggioMemoria(mem, 'user', 'nuovo', ts(500));
  assert.strictEqual(L.haMessaggiDaSintetizzare(mem), true);
  assert.strictEqual(L.messaggiNonSintetizzati(mem).length, 1);
});
test('validaProfilo: accetta JSON anche tra testo/code fence, limita voci e lunghezza', () => {
  const ai = 'Ecco:\n```json\n' + J({ obiettivi: ['perdere 3 kg', 5, ''], pattern: Array(12).fill('x'.repeat(300)), resistenze: [], fisico: ['L5-S1'], eventi: [], impegni_aperti: ['camminata domani'] }) + '\n```';
  const p = L.validaProfilo(ai, ts(0), ts(9));
  assert.strictEqual(J(p.obiettivi), J(['perdere 3 kg']));
  assert.strictEqual(p.pattern.length, 8); assert.strictEqual(p.pattern[0].length, 150);
  assert.strictEqual(p.userId, 'gianluca'); assert.strictEqual(p.sinteticoFinoA, ts(9)); assert.strictEqual(p.versione, 1);
});
test('validaProfilo: risposte non valide vengono rifiutate (il profilo vecchio resta)', () => {
  for (const x of ['', 'nessun json', '{rotto', '[1,2]', J({ altro: 1 }), null]) assert.strictEqual(L.validaProfilo(x, ts(0), ts(1)), null);
});
test('prompt profilo: contiene le regole anti-invenzione, il profilo precedente e la conversazione', () => {
  const p = L.promptProfilo({ obiettivi: ['dormire di più'] }, [{ r: 'user', t: 'Sto dormendo 5 ore', ts: ts(1) }, { r: 'assistant', t: 'Perché?', ts: ts(2) }]);
  assert.ok(p.includes('SOLO ciò che l\'UTENTE ha dichiarato'));
  assert.ok(p.includes('non dedurre diagnosi'));
  assert.ok(p.includes('dormire di più'));
  assert.ok(p.includes('UTENTE: Sto dormendo 5 ore') && p.includes('COACH: Perché?'));
});
test('testo per il prompt di sistema: vuoto senza profilo, con voci e data se presente', () => {
  assert.strictEqual(L.testoProfiloPerPrompt(null), '');
  assert.strictEqual(L.testoProfiloPerPrompt({ obiettivi: [] }), '');
  const t = L.testoProfiloPerPrompt({ obiettivi: ['perdere 3 kg'], resistenze: ['salto gli allenamenti nei viaggi'], aggiornato: '2026-11-15T10:00:00Z' });
  assert.ok(t.includes('perdere 3 kg') && t.includes('salto gli allenamenti') && t.includes('2026-11-15'));
});
test('integrazione statica: la chat usa memoria, profilo nel prompt e registra dopo la risposta', () => {
  assert.ok(html.includes("const BIN_MEMORIA = 'memoria'"));
  assert.ok(html.includes('${testoProfiloPerPrompt(memoria.profilo)}'));
  assert.ok(html.includes('registraInMemoria(testo, risposta);'));
  assert.ok(html.includes('await caricaMemoria();'));
  assert.ok(/chat-close-btn[\s\S]{0,200}haMessaggiDaSintetizzare/.test(html));
});
