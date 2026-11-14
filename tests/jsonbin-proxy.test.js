// Test automatici della funzione jsonbin-proxy (senza rete: JSONBin è simulato).
// Esecuzione: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const https = require('https');
const { EventEmitter } = require('events');

const BIN_TEST_ALL = '6af8813cac6210605a878724';
const BIN_TEST_DIA = '6af8819aac6210605a8787f4';
const BIN_PROD_ALL = '6a4599beda38895dfe1ef074';

process.env.JSONBIN_KEY = 'chiave-finta';
process.env.BIN_ALLENAMENTO = BIN_TEST_ALL;
process.env.BIN_DIARIO = BIN_TEST_DIA;

let store, puts, lastPutBody;
function mockJsonbin(initialPayload) {
  store = { payload: initialPayload };
  puts = 0;
  lastPutBody = null;
  https.request = (opts, cb) => {
    const req = new EventEmitter();
    let body = '';
    req.write = b => { body += b; };
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = 200;
      cb(res);
      let out;
      if (opts.method === 'GET') out = { record: { payload: store.payload } };
      else { puts++; lastPutBody = JSON.parse(body); store = lastPutBody; out = { metadata: {} }; }
      res.emit('data', JSON.stringify(out));
      res.emit('end');
    };
    return req;
  };
}

const { handler } = require('../netlify/functions/jsonbin-proxy.js');
const call = (body, headers = { host: 'sito.netlify.app' }, method = 'POST') =>
  handler({ httpMethod: method, headers, body: JSON.stringify(body) });

test('metodo diverso da POST rifiutato', async () => {
  assert.strictEqual((await call({}, {}, 'GET')).statusCode, 405);
});

test('origine diversa dal sito rifiutata', async () => {
  const r = await call({ op: 'info' }, { origin: 'https://altro.example', host: 'sito.netlify.app' });
  assert.strictEqual(r.statusCode, 403);
});

test('stessa origine accettata', async () => {
  const r = await call({ op: 'info' }, { origin: 'https://sito.netlify.app', host: 'sito.netlify.app' });
  assert.strictEqual(r.statusCode, 200);
});

test('info restituisce solo le ultime 6 cifre dei bin', async () => {
  const body = JSON.parse((await call({ op: 'info' })).body);
  assert.strictEqual(body.allenamento, '878724');
  assert.strictEqual(body.diario, '8787f4');
  assert.strictEqual(body.allenamento_produzione, false);
  assert.ok(!JSON.stringify(body).includes(BIN_TEST_ALL));
});

test('bin sconosciuto rifiutato', async () => {
  assert.strictEqual((await call({ op: 'get', bin: 'altro' })).statusCode, 400);
});

test('get restituisce il payload', async () => {
  mockJsonbin('{"a":1}');
  const r = await call({ op: 'get', bin: 'allenamento' });
  assert.strictEqual(JSON.parse(r.body).payload, '{"a":1}');
});

test('set scrive una stringa', async () => {
  mockJsonbin('{}');
  const r = await call({ op: 'set', bin: 'diario', value: '[1,2]' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(lastPutBody.payload, '[1,2]');
});

test('set rifiuta valori non stringa', async () => {
  mockJsonbin('{}');
  assert.strictEqual((await call({ op: 'set', bin: 'diario', value: { a: 1 } })).statusCode, 400);
  assert.strictEqual(puts, 0);
});

test('patch aggiorna una sola chiave e conserva le altre (assessment incluso)', async () => {
  mockJsonbin(JSON.stringify({
    'Lat machine': [{ peso: 60, ts: 1 }],
    assessment: { completato: true, data: '2026-09-16' },
    Pulley: [{ peso: 55, ts: 2 }]
  }));
  const r = await call({ op: 'patch', bin: 'allenamento', key: 'Lat machine', value: [{ peso: 66, ts: 3 }, { peso: 60, ts: 1 }] });
  assert.strictEqual(r.statusCode, 200);
  const o = JSON.parse(store.payload);
  assert.strictEqual(o['Lat machine'].length, 2);
  assert.deepStrictEqual(o.assessment, { completato: true, data: '2026-09-16' });
  assert.strictEqual(o.Pulley.length, 1);
  assert.strictEqual(typeof store.payload, 'string');
});

test('due patch consecutivi su chiavi diverse non si cancellano', async () => {
  mockJsonbin('{}');
  await call({ op: 'patch', bin: 'allenamento', key: 'A', value: [1] });
  await call({ op: 'patch', bin: 'allenamento', key: 'B', value: [2] });
  const o = JSON.parse(store.payload);
  assert.deepStrictEqual([o.A, o.B], [[1], [2]]);
});

test('patch su bin appena creato (payload oggetto vuoto)', async () => {
  mockJsonbin({});
  const r = await call({ op: 'patch', bin: 'allenamento', key: 'X', value: [1] });
  assert.strictEqual(r.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(store.payload), { X: [1] });
});

test('patch rifiuta chiavi pericolose', async () => {
  mockJsonbin('{}');
  for (const key of ['__proto__', 'constructor', 'prototype', '', 'x'.repeat(201)]) {
    assert.strictEqual((await call({ op: 'patch', bin: 'allenamento', key, value: 1 })).statusCode, 400);
  }
  assert.strictEqual(puts, 0);
});

test('patch non scrive se il contenuto del bin è illeggibile', async () => {
  mockJsonbin('{rotto');
  const r = await call({ op: 'patch', bin: 'allenamento', key: 'x', value: 1 });
  assert.strictEqual(r.statusCode, 409);
  assert.strictEqual(puts, 0);
});

test('scritture su bin di produzione bloccate senza ALLOW_PROD_BINS', async () => {
  process.env.BIN_ALLENAMENTO = BIN_PROD_ALL;
  delete process.env.ALLOW_PROD_BINS;
  mockJsonbin('{}');
  try {
    assert.strictEqual((await call({ op: 'set', bin: 'allenamento', value: '{}' })).statusCode, 403);
    assert.strictEqual((await call({ op: 'patch', bin: 'allenamento', key: 'x', value: 1 })).statusCode, 403);
    assert.strictEqual(puts, 0);
    const info = JSON.parse((await call({ op: 'info' })).body);
    assert.strictEqual(info.allenamento_produzione, true);
    process.env.ALLOW_PROD_BINS = '1';
    assert.strictEqual((await call({ op: 'set', bin: 'allenamento', value: '{}' })).statusCode, 200);
  } finally {
    process.env.BIN_ALLENAMENTO = BIN_TEST_ALL;
    delete process.env.ALLOW_PROD_BINS;
  }
});

test('senza JSONBIN_KEY la funzione risponde con errore esplicito', async () => {
  const k = process.env.JSONBIN_KEY;
  delete process.env.JSONBIN_KEY;
  try {
    const r = await call({ op: 'info' });
    assert.strictEqual(r.statusCode, 500);
    assert.match(r.body, /JSONBIN_KEY non configurata/);
  } finally { process.env.JSONBIN_KEY = k; }
});
