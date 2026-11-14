// Test della dettatura vocale in chat (soluzione A). Codice estratto da index.html tra i marcatori VOICE.
// Esecuzione: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ VOICE-START([\s\S]*?)\/\/ VOICE-END/);
assert.ok(m, 'marcatori VOICE non trovati');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1] + '\nthis.unisci = unisciTestoDettato; this.msg = messaggioErroreDettatura; this.crea = creaDettatura;', ctx);
const { unisci, msg, crea } = ctx;

class FakeRec {
  constructor() { FakeRec.last = this; this.started = 0; this.stopped = 0; this.failStart = false; }
  start() { if (this.failStart) throw new Error('InvalidStateError'); this.started++; }
  stop() { this.stopped++; if (this.onend) this.onend(); }
}
const risultati = (...parti) => ({ results: parti.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin })) });

function nuovaDett(base) {
  const log = { testo: [], stato: [], errori: [] };
  const d = crea(FakeRec, {
    onTesto: t => log.testo.push(t),
    onStato: a => log.stato.push(a),
    onErrore: e => log.errori.push(e)
  });
  return { d, log, rec: FakeRec.last };
}

test('lingua italiana, una frase per volta, testo provvisorio attivo', () => {
  const { rec } = nuovaDett();
  assert.strictEqual(rec.lang, 'it-IT');
  assert.strictEqual(rec.continuous, false);
  assert.strictEqual(rec.interimResults, true);
});

test('toggle avvia, un secondo toggle ferma', () => {
  const { d, log, rec } = nuovaDett();
  d.toggle('');
  assert.strictEqual(rec.started, 1);
  assert.strictEqual(d.attiva(), true);
  d.toggle('');
  assert.strictEqual(rec.stopped, 1);
  assert.strictEqual(d.attiva(), false);
  assert.deepStrictEqual([...log.stato], [true, false]);
});

test('il testo detto si aggiunge a quello già scritto', () => {
  const { d, log, rec } = nuovaDett();
  d.toggle('Ciao coach');
  rec.onresult(risultati(['come', false]));
  rec.onresult(risultati(['come sto andando', true]));
  assert.deepStrictEqual([...log.testo], ['Ciao coach come', 'Ciao coach come sto andando']);
});

test('campo vuoto: nessuno spazio iniziale', () => {
  assert.strictEqual(unisci('', 'ciao'), 'ciao');
  assert.strictEqual(unisci('  ', ' ciao '), 'ciao');
  assert.strictEqual(unisci('Ciao  ', 'coach'), 'Ciao coach');
  assert.strictEqual(unisci('Ciao', ''), 'Ciao');
});

test('parte finale e parte provvisoria si sommano', () => {
  const { d, log, rec } = nuovaDett();
  d.toggle('');
  rec.onresult(risultati(['oggi ho dormito poco', true], [' e mi fa male la schiena', false]));
  assert.strictEqual(log.testo[log.testo.length - 1], 'oggi ho dormito poco e mi fa male la schiena');
});

test('fine del riconoscimento spegne lo stato', () => {
  const { d, log, rec } = nuovaDett();
  d.toggle('');
  rec.onend();
  assert.strictEqual(d.attiva(), false);
  assert.strictEqual(log.stato[log.stato.length - 1], false);
});

test("un errore spegne lo stato e segnala il codice", () => {
  const { d, log, rec } = nuovaDett();
  d.toggle('');
  rec.onerror({ error: 'not-allowed' });
  assert.strictEqual(d.attiva(), false);
  assert.deepStrictEqual([...log.errori], ['not-allowed']);
});

test('start che lancia eccezione: errore start-failed e nessuno stato attivo', () => {
  const { d, log, rec } = nuovaDett();
  rec.failStart = true;
  d.toggle('');
  assert.strictEqual(d.attiva(), false);
  assert.deepStrictEqual([...log.errori], ['start-failed']);
});

test('messaggi di errore comprensibili', () => {
  assert.match(msg('not-allowed', false), /Microfono non consentito/);
  assert.match(msg('service-not-allowed', true), /schermata Home/);
  assert.match(msg('service-not-allowed', false), /Siri o la Dettatura/);
  assert.match(msg('no-speech', false), /Non ho sentito/);
  assert.strictEqual(msg('aborted', false), '');
  assert.match(msg('qualcosa', false), /qualcosa/);
});

test('in index.html il microfono compare solo se il browser supporta la dettatura', () => {
  assert.ok(html.includes('window.SpeechRecognition || window.webkitSpeechRecognition'));
  assert.ok(/if \(!Ctor \|\| !micBtn \|\| !input\) return;/.test(html));
  assert.ok(/\.chat-mic-btn \{[^}]*display:none/.test(html));
});
