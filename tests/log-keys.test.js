// Test della logica delle chiavi dei log per sessione (codice estratto da index.html tra i marcatori LOG-KEYS).
// Esecuzione: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ LOG-KEYS-START([\s\S]*?)\/\/ LOG-KEYS-END/);
assert.ok(m, 'marcatori LOG-KEYS non trovati in index.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1] + '\nthis.chiaveLog = chiaveLog; this.storicoEsercizio = storicoEsercizio; this.SESSIONE_ID = SESSIONE_ID;', ctx);
const { chiaveLog, storicoEsercizio } = ctx;

test('le chiavi sono diverse per ogni sessione', () => {
  const k = ['lunedi', 'mercoledi', 'venerdi'].map(g => chiaveLog('Dead Bug', g));
  assert.deepStrictEqual(k, ['Dead Bug_PUSH', 'Dead Bug_PULL', 'Dead Bug_TOTAL_BODY']);
  assert.strictEqual(new Set(k).size, 3);
});

test('giorno sconosciuto: chiave comunque distinta e stabile', () => {
  assert.strictEqual(chiaveLog('Dead Bug', 'sabato'), 'Dead Bug_SABATO');
});

test('un carico nuovo registrato in Push non compare in Pull né in Total Body', () => {
  const s = {};
  s[chiaveLog('Dead Bug', 'lunedi')] = [{ data: '2026-11-14', ripetizioni: 15, ts: 100 }];
  assert.strictEqual(storicoEsercizio(s, 'Dead Bug', 'lunedi').length, 1);
  assert.strictEqual(storicoEsercizio(s, 'Dead Bug', 'mercoledi').length, 0);
  assert.strictEqual(storicoEsercizio(s, 'Dead Bug', 'venerdi').length, 0);
});

test('le voci vecchie (solo nome) restano visibili in tutte le sessioni e sono marcate', () => {
  const s = { 'Dead Bug': [{ data: '2026-11-06', ripetizioni: 15, ts: 50 }] };
  for (const g of ['lunedi', 'mercoledi', 'venerdi']) {
    const r = storicoEsercizio(s, 'Dead Bug', g);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0]._legacy, true);
    assert.strictEqual(r[0]._chiave, 'Dead Bug');
  }
});

test('voci nuove e vecchie sono ordinate dalla più recente', () => {
  const s = {
    'Dead Bug': [{ ts: 50 }, { ts: 10 }],
    'Dead Bug_PUSH': [{ ts: 100 }, { ts: 30 }]
  };
  assert.deepStrictEqual(storicoEsercizio(s, 'Dead Bug', 'lunedi').map(e => e.ts), [100, 50, 30, 10]);
});

test("ogni voce porta la chiave in cui vive (serve per eliminarla dal posto giusto)", () => {
  const s = { 'Pulley': [{ ts: 1 }], 'Pulley_PULL': [{ ts: 2 }] };
  const r = storicoEsercizio(s, 'Pulley', 'mercoledi');
  assert.deepStrictEqual(r.map(e => e._chiave), ['Pulley_PULL', 'Pulley']);
});

test('i dati originali non vengono modificati dalla lettura', () => {
  const s = { 'Dead Bug': [{ ts: 1 }] };
  const prima = JSON.stringify(s);
  storicoEsercizio(s, 'Dead Bug', 'lunedi');
  assert.strictEqual(JSON.stringify(s), prima);
});

test('esercizio senza storico: lista vuota', () => {
  assert.strictEqual(storicoEsercizio({}, 'Leg Press', 'venerdi').length, 0);
});

test("la chiave 'assessment' non interferisce con gli esercizi", () => {
  const s = { assessment: { completato: true } };
  assert.strictEqual(storicoEsercizio(s, 'Pulley', 'mercoledi').length, 0);
});

test("il salvataggio e l'eliminazione in index.html usano la chiave per sessione", () => {
  assert.ok(html.includes('saveBtn.dataset.saveEs = chiaveLog(nome, giornoCorrente)'));
  assert.ok(html.includes('delBtn.dataset.deleteEs = entry._chiave'));
  assert.ok(html.includes('storicoEsercizio(storico, nome, giornoCorrente)'));
});
