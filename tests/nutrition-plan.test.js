const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.split('// PIANO-PARSE-START')[1].split('// PIANO-PARSE-END')[0];
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.parse=parsePianoNutrizionale;this.norm=normTesto;', ctx);
const fx = (n) => fs.readFileSync(__dirname + '/fixtures/' + n, 'utf8');
const attese = (t) => t.split('\n').map(r => r.trim()).filter(r => r && !/^-{3,}$/.test(r)).sort();
const regDi = (p) => Array.from(p.registro).sort();

test('formato A (come il piano reale): sezioni, pasti e macro', () => {
  const p = ctx.parse(fx('piano-sintetico-a.txt'));
  assert.strictEqual(p.riuscito, true);
  assert.ok(p.titolo.startsWith('PIANO NUTRIZIONALE'));
  assert.ok(p.timing && p.supp && p.note);
  assert.strictEqual(p.note.titolo, '5) NOTE STRATEGICHE');
  assert.strictEqual(Object.keys(p.giorni.allenamento.pasti).length, 5);
  assert.strictEqual(Object.keys(p.giorni.riposo.pasti).length, 3);
  assert.strictEqual(p.macro.allenamentoValori.kcal, '2800');
  assert.strictEqual(p.macro.allenamentoValori.P, '170');
  assert.strictEqual(p.macro.allenamentoValori.C, '300');
  assert.strictEqual(p.macro.allenamentoValori.G, '80');
  assert.strictEqual(p.macro.riposoValori.kcal, '2400');
  assert.strictEqual(p.giorni.allenamento.pasti.metamattina.titolo, 'Metà Mattina (pre-WO) — 450 kcal');
  assert.ok(p.giorni.riposo.pasti.pranzo.righe.some(r => r.includes('carboidrati moderati')));
});

test('formato A: nessuna riga persa', () => {
  const t = fx('piano-sintetico-a.txt');
  assert.strictEqual(JSON.stringify(regDi(ctx.parse(t))), JSON.stringify(attese(t)));
});

test('formato B (titoli diversi): varianti riconosciute e nulla perso', () => {
  const t = fx('piano-sintetico-b.txt');
  const p = ctx.parse(t);
  assert.strictEqual(p.riuscito, true);
  assert.ok(p.giorni.allenamento.pasti.metamattina, 'Spuntino mattina -> Metà Mattina');
  assert.strictEqual(p.giorni.allenamento.extra.length, 1);
  assert.strictEqual(p.giorni.allenamento.extra[0].titolo, 'Spuntino serale — 200 kcal');
  assert.ok(p.giorni.riposo.pasti.cena);
  assert.ok(p.supp && p.supp.titolo === 'Integrazione');
  assert.ok(p.note && /pratiche/.test(p.note.titolo));
  assert.strictEqual(p.altro.length, 1);
  assert.ok(p.preambolo.some(r => /Macro target allenamento/.test(r)));
  assert.strictEqual(JSON.stringify(regDi(p)), JSON.stringify(attese(t)));
});

test('formato sconosciuto: non riuscito, quindi si usa il ripiego', () => {
  const p = ctx.parse('Solo testo libero\nsenza titoli ne pasti riconoscibili\n'.repeat(30));
  assert.strictEqual(p.riuscito, false);
});

test('testo vuoto o nullo non solleva errori', () => {
  assert.strictEqual(ctx.parse('').riuscito, false);
  assert.strictEqual(ctx.parse(null).riuscito, false);
});

test('una frase che inizia con "Cena" non è un pasto', () => {
  const p = ctx.parse('## Giorno allenamento\n**Colazione — 500 kcal**\n- uova\nCena abbondante e ricca di carboidrati sconsigliata nei giorni di riposo per ragioni varie\n');
  assert.strictEqual(Object.keys(p.giorni.allenamento.pasti).length, 1);
  assert.ok(p.giorni.allenamento.pasti.colazione.righe.some(r => /Cena abbondante/.test(r)));
});

test('un pasto duplicato nello stesso giorno finisce in extra', () => {
  const p = ctx.parse('## Giorno allenamento\n**Pranzo — 500 kcal**\n- a\n**Pranzo — 300 kcal**\n- b\n');
  assert.strictEqual(p.giorni.allenamento.extra.length, 1);
});

test('la UI usa il parser con ripiego e lo switch di giorno', () => {
  assert.ok(html.includes('parsePianoNutrizionale(dietaTesto)'));
  assert.ok(html.includes('costruisciPianoAccordion(dietaTesto)'));
  assert.ok(html.includes('if (pianoParsato) renderPianoNutrizione();'));
  assert.ok(/btnAllenamento\.addEventListener\('click'/.test(html));
});

test('le variabili di stato del piano sono dichiarate prima del primo render', () => {
  const dich = html.indexOf('let pianoParsato');
  const primo = html.indexOf('renderNutrizione();', html.indexOf('function renderNutrizione'));
  assert.ok(dich > 0 && dich < primo);
});
