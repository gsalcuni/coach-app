// Proxy JSONBin: la chiave master resta sul server (variabile d'ambiente JSONBIN_KEY).
// Il browser non conosce né la chiave né gli ID dei bin: indica solo un alias.
const https = require('https');

const BIN_BASE_PATH = '/v3/b/';
const ALIAS = { allenamento: 'BIN_ALLENAMENTO', diario: 'BIN_DIARIO', memoria: 'BIN_MEMORIA' };
// Bin di produzione: scrivibili solo se ALLOW_PROD_BINS=1 (da impostare al passaggio in produzione).
const BIN_PRODUZIONE = ['6a4599beda38895dfe1ef074', '6a4599e2f5f4af5e29508282'];
const MAX_VALUE_CHARS = 900000;

function jsonbinRequest(method, binId, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = https.request({
      hostname: 'api.jsonbin.io',
      path: BIN_BASE_PATH + binId + (method === 'GET' ? '/latest' : ''),
      method,
      headers: {
        'X-Master-Key': process.env.JSONBIN_KEY,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const reply = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method Not Allowed' });

  // Solo chiamate dal sito stesso (nessun CORS aperto).
  const origin = event.headers.origin || event.headers.Origin;
  const host = event.headers.host || event.headers.Host;
  if (origin) {
    let originHost = '';
    try { originHost = new URL(origin).host; } catch (e) {}
    if (originHost !== host) return reply(403, { error: 'Origin non consentita' });
  }

  if (!process.env.JSONBIN_KEY) return reply(500, { error: 'JSONBIN_KEY non configurata' });

  let req;
  try { req = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'JSON non valido' }); }

  // Info per il banner dell'ambiente di test: solo le ultime 6 cifre degli ID.
  if (req.op === 'info') {
    const out = {};
    for (const [alias, envName] of Object.entries(ALIAS)) {
      const id = process.env[envName] || '';
      out[alias] = id ? id.slice(-6) : null;
      out[alias + '_produzione'] = BIN_PRODUZIONE.includes(id);
    }
    out.scrittura_produzione_consentita = process.env.ALLOW_PROD_BINS === '1';
    return reply(200, out);
  }

  const envName = ALIAS[req.bin];
  if (!envName) return reply(400, { error: 'Bin non valido' });
  const binId = process.env[envName];
  if (!binId) return reply(500, { error: envName + ' non configurato' });

  try {
    if (req.op === 'get') {
      const r = await jsonbinRequest('GET', binId);
      if (r.status !== 200) return reply(r.status, { error: 'JSONBin GET fallito', detail: r.body });
      const payload = r.body && r.body.record ? r.body.record.payload : null;
      return reply(200, { payload: payload === undefined ? null : payload });
    }
    if (req.op === 'set') {
      if (typeof req.value !== 'string') return reply(400, { error: 'value deve essere una stringa' });
      if (req.value.length > MAX_VALUE_CHARS) return reply(413, { error: 'value troppo grande' });
      if (BIN_PRODUZIONE.includes(binId) && process.env.ALLOW_PROD_BINS !== '1') {
        return reply(403, { error: 'Scrittura su bin di produzione bloccata in questo ambiente' });
      }
      const r = await jsonbinRequest('PUT', binId, { payload: req.value });
      if (r.status !== 200) return reply(r.status, { error: 'JSONBin PUT fallito', detail: r.body });
      return reply(200, { ok: true });
    }
    if (req.op === 'patch') {
      // Aggiorna una o più chiavi dell'oggetto salvato: legge il contenuto più recente, cambia SOLO quelle chiavi, riscrive.
      // Evita che una copia vecchia in memoria nel browser sovrascriva altre chiavi (es. assessment).
      // Forma singola: { key, value }. Forma multipla (una sola scrittura): { entries: { chiave: valore, ... } }.
      const entries = req.entries && typeof req.entries === 'object' && !Array.isArray(req.entries)
        ? req.entries
        : (typeof req.key === 'string' ? { [req.key]: req.value } : null);
      if (!entries) return reply(400, { error: 'key non valida' });
      const chiavi = Object.keys(entries);
      if (chiavi.length === 0 || chiavi.length > 10) return reply(400, { error: 'key non valida' });
      for (const key of chiavi) {
        if (!key || key.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(key)) {
          return reply(400, { error: 'key non valida' });
        }
      }
      if (BIN_PRODUZIONE.includes(binId) && process.env.ALLOW_PROD_BINS !== '1') {
        return reply(403, { error: 'Scrittura su bin di produzione bloccata in questo ambiente' });
      }
      const g = await jsonbinRequest('GET', binId);
      if (g.status !== 200) return reply(g.status, { error: 'JSONBin GET fallito', detail: g.body });
      let current = g.body && g.body.record ? g.body.record.payload : null;
      if (typeof current === 'string') {
        try { current = JSON.parse(current); } catch (e) { return reply(409, { error: 'Contenuto del bin non leggibile: scrittura annullata' }); }
      }
      if (current === null || current === undefined) current = {};
      if (typeof current !== 'object' || Array.isArray(current)) return reply(409, { error: 'Il bin non contiene un oggetto: scrittura annullata' });
      for (const key of chiavi) current[key] = entries[key];
      const serialized = JSON.stringify(current);
      if (serialized.length > MAX_VALUE_CHARS) return reply(413, { error: 'contenuto troppo grande' });
      const w = await jsonbinRequest('PUT', binId, { payload: serialized });
      if (w.status !== 200) return reply(w.status, { error: 'JSONBin PUT fallito', detail: w.body });
      return reply(200, { ok: true });
    }
    return reply(400, { error: 'Operazione non valida' });
  } catch (e) {
    console.error('jsonbin-proxy error:', e.message);
    return reply(500, { error: 'Errore interno' });
  }
};
