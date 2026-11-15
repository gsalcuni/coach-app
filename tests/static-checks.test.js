// Controlli statici su index.html: nessun segreto nel codice pubblicato, salvataggi per singola chiave.
// Esecuzione: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('nessuna chiave JSONBin nel codice (formato $2a$/$2b$)', () => {
  assert.ok(!/\$2[aby]\$\d{2}\$/.test(html));
});

test('il browser non chiama direttamente JSONBin né usa X-Master-Key', () => {
  assert.ok(!html.includes('api.jsonbin.io'));
  assert.ok(!html.includes('X-Master-Key'));
  assert.ok(!/JSONBIN_KEY\s*=/.test(html));
});

test('nessun ID di bin scritto nel codice', () => {
  assert.ok(!html.includes('6a4599beda38895dfe1ef074'));
  assert.ok(!html.includes('6a4599e2f5f4af5e29508282'));
  assert.ok(!html.includes('6af8813cac6210605a878724'));
  assert.ok(!html.includes('6af8819aac6210605a8787f4'));
});

test('i log degli esercizi si salvano per singola chiave', () => {
  assert.ok(html.includes('salvaStoricoLocale(nome)'));
  assert.ok(!/await salvaStoricoLocale\(\);/.test(html));
});

test("l'assessment si salva con patch sulla sola chiave 'assessment'", () => {
  assert.ok(html.includes("binPatch(BIN_ALLENAMENTO, 'assessment'"));
  assert.ok(!html.includes('binData.assessment ='));
});

test('gli script inline hanno sintassi valida', () => {
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  assert.doesNotThrow(() => new Function(code));
});

test('la scheda di default ha il core completo in tutte e tre le sessioni', () => {
  const m = html.match(/const CORE_DEFAULT = (\[[^\]]*\]);\s*const SCHEDA = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'CORE_DEFAULT / SCHEDA non trovati');
  const core = new Function('return ' + m[1])();
  assert.deepStrictEqual([...core], ['Dead Bug', 'Bird Dog', 'Pallof Press', 'Plank TRX']);
  for (const giorno of ['lunedi', 'mercoledi', 'venerdi']) {
    assert.ok(new RegExp(giorno + ":\\s*\\{[^}]*\\.\\.\\.CORE_DEFAULT").test(m[2]), 'core mancante in ' + giorno);
  }
});

test('piani generati con una sola chiamata ciascuno, con continuazione', () => {
  const h = require('fs').readFileSync(__dirname + '/../index.html', 'utf8');
  assert.ok(!h.includes('parte 1 di 2') && !h.includes('parte 2 di 2'));
  assert.ok(h.includes('const [t6, t7, t8] = await Promise.all(['));
  assert.ok(h.includes('piano_nutrizionale_completo: testoNutrizione'));
  assert.ok(h.includes('piano_allenamento_completo: t6.trim()'));
  assert.ok(h.includes('Usa ESATTAMENTE queste kcal per pasto'));
  assert.ok((h.match(/maxTokens: 2500/g) || []).length >= 2);
});

test('Prompt piano nutrizionale: target kcal/macro per pasto passati all\'AI', () => {
  const h = require('fs').readFileSync(__dirname + '/../index.html', 'utf8');
  assert.ok(h.includes('targetNutrizione'));
  assert.ok(h.includes('TARGET OBBLIGATORI'));
  assert.ok(/\$\{targetNutrizione\}/.test(h));
});

test('Assessment: blocca peso/altezza/età a 0 prima di generare', () => {
  const h = require('fs').readFileSync(__dirname + '/../index.html', 'utf8');
  assert.ok(h.includes("Compila prima: "));
  assert.ok(h.indexOf('Compila prima: ') < h.indexOf("document.getElementById('profilo-foto').style.display = 'block'", h.indexOf('Compila prima: ')) );
});
