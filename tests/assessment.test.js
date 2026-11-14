// Test della logica dell'assessment: chiamate a Claude (tentativi e continuazione), archivio storico, documento.
// Esecuzione: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ ASSESSMENT-LIB-START([\s\S]*?)\/\/ ASSESSMENT-LIB-END/);
assert.ok(m, 'marcatori ASSESSMENT-LIB non trovati in index.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1] + '\nthis.callClaudeCompleto = callClaudeCompleto; this.compattaAssessment = compattaAssessment; this.aggiungiAStorico = aggiungiAStorico; this.promptDocumentoAssessment = promptDocumentoAssessment;', ctx);
const { callClaudeCompleto, compattaAssessment, aggiungiAStorico, promptDocumentoAssessment } = ctx;

// fetch finto: risponde con la sequenza data
function fakeFetch(risposte) {
  const chiamate = [];
  const f = async (url, opts) => {
    chiamate.push(JSON.parse(opts.body));
    const r = risposte[Math.min(chiamate.length - 1, risposte.length - 1)];
    return { status: r.status || 200, json: async () => r.body };
  };
  f.chiamate = chiamate;
  return f;
}
const ok = (testo, stop) => ({ body: { content: [{ text: testo }], stop_reason: stop || 'end_turn' } });
const senzaAttesa = { sleep: async () => {} };

test('risposta completa: una sola chiamata, non troncata', async () => {
  const f = fakeFetch([ok('piano completo')]);
  const r = await callClaudeCompleto(f, [{ role: 'user', content: 'x' }], senzaAttesa);
  assert.strictEqual(r.testo, 'piano completo');
  assert.strictEqual(r.troncato, false);
  assert.strictEqual(f.chiamate.length, 1);
  assert.strictEqual(f.chiamate[0].max_tokens, 1000);
});

test('risposta tagliata: continua dal punto in cui si è interrotta e unisce i pezzi', async () => {
  const f = fakeFetch([ok('Prima parte ', 'max_tokens'), ok('e seconda parte.')]);
  const r = await callClaudeCompleto(f, [{ role: 'user', content: 'x' }], senzaAttesa);
  assert.strictEqual(r.testo, 'Prima parte e seconda parte.');
  assert.strictEqual(r.troncato, false);
  assert.strictEqual(f.chiamate.length, 2);
  const msgs = f.chiamate[1].messages;
  assert.strictEqual(msgs.length, 3);
  assert.strictEqual(msgs[1].role, 'assistant');
  assert.strictEqual(msgs[1].content, 'Prima parte', 'il testo parziale non deve finire con spazi');
  assert.strictEqual(msgs[2].role, 'user');
  assert.strictEqual(f.chiamate[1].useRAG, false, 'la continuazione non usa il RAG');
});

test('il numero di continuazioni è limitato: nessun ciclo infinito', async () => {
  const f = fakeFetch([ok('a', 'max_tokens')]);
  const r = await callClaudeCompleto(f, [{ role: 'user', content: 'x' }], senzaAttesa);
  assert.strictEqual(f.chiamate.length, 3);
  assert.strictEqual(r.troncato, true);
  assert.strictEqual(r.testo, 'aaa');
});

test('errore temporaneo (sovraccarico): riprova e poi riesce', async () => {
  const f = fakeFetch([{ body: { error: { type: 'overloaded_error' } } }, ok('fatto')]);
  const r = await callClaudeCompleto(f, [{ role: 'user', content: 'x' }], senzaAttesa);
  assert.strictEqual(r.testo, 'fatto');
  assert.strictEqual(f.chiamate.length, 2);
});

test('errore non riprovabile: nessun nuovo tentativo, errore chiaro', async () => {
  const f = fakeFetch([{ body: { error: { type: 'invalid_request_error', message: 'no' } } }]);
  await assert.rejects(() => callClaudeCompleto(f, [{ role: 'user', content: 'x' }], senzaAttesa), /Proxy error/);
  assert.strictEqual(f.chiamate.length, 1);
});

test('errore temporaneo persistente: smette dopo i tentativi previsti', async () => {
  const f = fakeFetch([{ body: { error: { type: 'rate_limit_error' } } }]);
  await assert.rejects(() => callClaudeCompleto(f, [{ role: 'user', content: 'x' }], senzaAttesa), /Proxy error/);
  assert.strictEqual(f.chiamate.length, 3);
});

test('useRAG viene passato solo se richiesto', async () => {
  const f1 = fakeFetch([ok('a')]);
  await callClaudeCompleto(f1, [{ role: 'user', content: 'x' }], senzaAttesa);
  assert.ok(!('useRAG' in f1.chiamate[0]));
  const f2 = fakeFetch([ok('a')]);
  await callClaudeCompleto(f2, [{ role: 'user', content: 'x' }], Object.assign({ useRAG: false }, senzaAttesa));
  assert.strictEqual(f2.chiamate[0].useRAG, false);
});

const assessmentCompleto = (data, extra) => Object.assign({
  completato: true, data,
  parametri: { peso: 82 }, foto: { frontale: 'f-' + data, laterale: 'l', posteriore: 'p' },
  report: { somatotipo: 'S', postura: 'P', iam: 'sostenibile', iam_desc: 'D', proiezione: 'X',
    piano_allenamento_completo: 'LUNGO'.repeat(1000), piano_nutrizionale_completo: 'LUNGO'.repeat(1000), documento_assessment: 'DOC'.repeat(500) }
}, extra || {});

test("l'archivio compatto tiene i dati utili al confronto e toglie i piani lunghi", () => {
  const c = compattaAssessment(assessmentCompleto('2026-09-16'));
  assert.strictEqual(c.data, '2026-09-16');
  assert.deepStrictEqual(Object.keys(c.report).sort(), ['iam', 'iam_desc', 'postura', 'proiezione', 'somatotipo']);
  assert.ok(JSON.stringify(c).length < 1500);
  assert.ok(c.archiviato_il);
});

test('il nuovo assessment manda il precedente in testa all’archivio', () => {
  const a1 = aggiungiAStorico([], assessmentCompleto('2026-09-16'));
  const a2 = aggiungiAStorico(a1, assessmentCompleto('2026-10-16'));
  assert.deepStrictEqual(Array.from(a2).map(x => x.data), ['2026-10-16', '2026-09-16']);
});

test("nessun assessment precedente: l'archivio resta com'è", () => {
  assert.strictEqual(aggiungiAStorico([], null).length, 0);
  assert.strictEqual(aggiungiAStorico(undefined, { completato: false }).length, 0);
  assert.strictEqual(aggiungiAStorico(undefined, undefined).length, 0);
});

test('lo stesso assessment non viene archiviato due volte', () => {
  const a1 = aggiungiAStorico([], assessmentCompleto('2026-09-16'));
  const a2 = aggiungiAStorico(a1, assessmentCompleto('2026-09-16'));
  assert.strictEqual(a2.length, 1);
});

test('l’archivio ha un massimo di voci (più recenti conservate)', () => {
  let arr = [];
  for (let i = 1; i <= 30; i++) arr = aggiungiAStorico(arr, assessmentCompleto('2026-01-' + String(i).padStart(2, '0')), 24);
  assert.strictEqual(arr.length, 24);
  assert.strictEqual(arr[0].data, '2026-01-30');
});

test("un archivio di 24 voci resta molto sotto il limite del bin", () => {
  let arr = [];
  for (let i = 1; i <= 24; i++) arr = aggiungiAStorico(arr, assessmentCompleto('2026-01-' + String(i).padStart(2, '0')), 24);
  assert.ok(JSON.stringify(arr).length < 40000, 'dimensione archivio: ' + JSON.stringify(arr).length);
});

test('i dati originali non vengono modificati', () => {
  const prec = assessmentCompleto('2026-09-16');
  const prima = JSON.stringify(prec);
  aggiungiAStorico([], prec);
  assert.strictEqual(JSON.stringify(prec), prima);
});

test('il prompt del documento contiene i dati dell’assessment', () => {
  const t = promptDocumentoAssessment({ peso: 82, altezza: 185, eta: 49, sesso: 'M', vita: 62, fianchi: 100, petto: 104, coscia_dx: 54, obiettivo: 'ricomposizione', limitazioni: '' },
    { somatotipo: 'S1', postura: 'P1', iam: 'sostenibile' });
  assert.match(t, /82kg 185cm 49a M/);
  assert.match(t, /Limitazioni:nessuna/);
  assert.match(t, /Somatotipo:S1/);
});

// ---- controlli su index.html ----
test('i piani completi sono generati con una sola chiamata ciascuno, in parallelo con il documento', () => {
  assert.match(html, /Scheda allenamento professionale\. /);
  assert.match(html, /Piano nutrizionale professionale\. /);
  assert.ok(!/parte 1 di 2/.test(html));
  assert.match(html, /const \[t6, t7, t8\] = await Promise\.all/);
});

test('assessment e archivio si salvano insieme con una sola scrittura per chiavi', () => {
  assert.ok(html.includes('binPatchMulti(BIN_ALLENAMENTO, { assessment: nuovoAssessment, assessment_storico: nuovoStorico })'));
});

test('il salvataggio si ferma se il bin non è leggibile (nessuna scrittura alla cieca)', () => {
  assert.ok(html.includes('Contenuto del bin non leggibile: assessment non salvato'));
});

test('il download usa il documento salvato e non rigenera a ogni scarico', () => {
  assert.ok(html.includes('let corpo = r.documento_assessment;'));
  assert.ok(html.includes('if (!corpo) {'));
  assert.ok(!html.includes("max_tokens: 2000"));
});

test("l'import di backup conserva anche l'archivio degli assessment", () => {
  assert.ok(html.includes('imported.assessment_storico = storico.assessment_storico'));
});

// ---- foto: formato e dimensioni ----
const im = html.match(/\/\/ IMAGE-LIB-START([\s\S]*?)\/\/ IMAGE-LIB-END/);
assert.ok(im, 'marcatori IMAGE-LIB non trovati');
const ctxImg = {};
vm.createContext(ctxImg);
vm.runInContext(im[1] + '\nthis.dimensioniRidotte = dimensioniRidotte;', ctxImg);
const { dimensioniRidotte } = ctxImg;

test('foto grandi: lato maggiore ridotto a 1600, proporzioni mantenute', () => {
  assert.deepStrictEqual({ ...dimensioniRidotte(4000, 3000, 1600) }, { w: 1600, h: 1200 });
  assert.deepStrictEqual({ ...dimensioniRidotte(3000, 4000, 1600) }, { w: 1200, h: 1600 });
});

test('foto già piccole: nessun ingrandimento', () => {
  assert.deepStrictEqual({ ...dimensioniRidotte(800, 600, 1600) }, { w: 800, h: 600 });
  assert.deepStrictEqual({ ...dimensioniRidotte(1600, 900, 1600) }, { w: 1600, h: 900 });
});

test('dimensioni sconosciute: valore sicuro, non zero', () => {
  const d = dimensioniRidotte(0, 0, 1600);
  assert.ok(d.w > 0 && d.h > 0);
});

test('le foto inviate a Claude sono sempre dichiarate JPEG e ricodificate in JPEG', () => {
  assert.ok(!/media_type:\s*fotoFiles/.test(html), 'il tipo non deve più venire dal nome del file');
  assert.strictEqual((html.match(/media_type: 'image\/jpeg'/g) || []).length, 3);
  assert.ok(html.includes("canvas.toDataURL('image/jpeg', 0.85)"));
});

// ---- diario: sempre un elenco ----
test('il diario ritorna sempre un elenco, anche con un bin appena creato', () => {
  const d = html.match(/async function caricaDiario\(\) \{([\s\S]*?)\n\}/);
  assert.ok(d, 'caricaDiario non trovata');
  assert.ok(d[1].includes('Array.isArray(dati)'));
  assert.ok(d[1].includes('catch'));
});

test('caricaDiario eseguita: bin vuoto, oggetto vuoto, testo non valido ed elenco reale', async () => {
  const d = html.match(/async function caricaDiario\(\) \{[\s\S]*?\n\}/)[0];
  const casi = [[null, 0], ['{}', 0], ['{rotto', 0], ['[]', 0], ['[{"data":"2026-11-14"}]', 1]];
  for (const [raw, attese] of casi) {
    const c = { BIN_DIARIO: 'diario', console: { warn() {} } };
    vm.createContext(c);
    vm.runInContext('async function binGet() { return ' + JSON.stringify(raw) + '; }\n' + d + '\nthis.f = caricaDiario;', c);
    const r = await c.f();
    assert.ok(Array.isArray(r) || (r && typeof r.slice === 'function'), 'deve avere slice: ' + raw);
    assert.strictEqual(r.length, attese, 'caso ' + raw);
  }
});
