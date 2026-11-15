// Diario nel prompt del coach: funzione pura estratta da index.html (DIARIO-CTX-START/END).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const m = html.match(/\/\/ DIARIO-CTX-START([\s\S]*?)\/\/ DIARIO-CTX-END/);
assert.ok(m, 'marcatori DIARIO-CTX non trovati');
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[1] + ';this.f=diarioPerPrompt;', ctx);
const f = ctx.f;
const v = (data, extra) => Object.assign({ data, sonno_ore: 7, sonno_qualita: 4, stato_emotivo: 3, energia: 2, brain_dump: true, respiro: false, palestra: true, sintomi: [{ nome: 'Dolore lombare', intensita: 3 }], note: 'giornata pesante', azione_domani: 'camminata' }, extra || {});

test('senza voci recenti il contesto è vuoto', () => {
  assert.strictEqual(f([], '2026-11-15'), '');
  assert.strictEqual(f(null, '2026-11-15'), '');
  assert.strictEqual(f([v('2026-10-01')], '2026-11-15'), '');
  assert.strictEqual(f([v('2026-11-15')], 'data-errata'), '');
});
test('include solo gli ultimi 7 giorni, dal più recente, con i dati inseriti', () => {
  const t = f([v('2026-11-08'), v('2026-11-09'), v('2026-11-14'), v('2026-11-15')], '2026-11-15');
  assert.ok(!t.includes('2026-11-08'));
  assert.ok(t.indexOf('2026-11-15') < t.indexOf('2026-11-14'));
  assert.ok(t.includes('sonno 7h (qualità 4/5)') && t.includes('Dolore lombare (3/5)') && t.includes('camminata'));
});
test('giorni compilati e senza voce sono dichiarati, e le azioni non fatte sono esplicite', () => {
  const t = f([v('2026-11-15'), v('2026-11-13', { respiro: false, palestra: false })], '2026-11-15');
  assert.ok(t.includes('2 giorni compilati, 5 senza voce'));
  assert.ok(t.includes('respiro NON fatto') && t.includes('allenamento/movimento NON fatto'));
  assert.ok(t.includes('non inventare'));
});
test('voci incomplete non rompono e i testi lunghi sono troncati', () => {
  const t = f([{ data: '2026-11-15' }, v('2026-11-14', { note: 'x'.repeat(900), sintomi: [null, { nome: 'a'.repeat(200) }] }), 7, null], '2026-11-15');
  assert.ok(t.length < 2300);
  assert.ok(!t.includes('x'.repeat(250)));
});
test('integrazione statica: il contesto entra nel prompt e si aggiorna dopo il salvataggio', () => {
  assert.ok(html.includes('${chatDiarioContext}'));
  assert.ok(html.includes('aggiornaContestoDiario(await caricaDiario())'));
  assert.ok(html.includes('if (ok) aggiornaContestoDiario(voci);'));
});

test('prompt del coach: regola su fatti dichiarati e deduzioni', () => {
  assert.ok(html.includes('REGOLA SUI FATTI'));
  assert.ok(html.includes('distingui ciò che ha detto lui da ciò che deduci tu'));
  assert.ok(html.includes('Non contraddire i fatti che l\'utente ha dichiarato'));
  assert.ok(html.indexOf('REGOLA SUI FATTI') < html.indexOf('${chatAssessmentContext}', html.indexOf('REGOLA SUI FATTI')));
});
