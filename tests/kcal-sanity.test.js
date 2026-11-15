const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.split('// PIANO-PARSE-START')[1].split('// PIANO-PARSE-END')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src + ';this.verifica=verificaSommeKcal;', ctx);

function piano(kA, kR) {
  const nomi = ['Colazione', 'Metà Mattina', 'Pranzo', 'Metà Pomeriggio', 'Cena'];
  const blocco = (k) => k.map((v, i) => `**${nomi[i]} — ${v} kcal**\n- 100g riso, 150g pollo\n`).join('\n');
  return `# PIANO NUTRIZIONALE — 80kg\n\n---\n\n## 1) TIMING NUTRIENTI\n\n- Pre-WO: carboidrati\n\n---\n\n## 2) GIORNO ALLENAMENTO — 2733 kcal | P:160g | C:330g | G:64g\n\n${blocco(kA)}\n---\n\n## 3) GIORNO RIPOSO — 2383 kcal | P:160g | C:260g | G:72g\n\n${blocco(kR)}\n---\n\n## 4) SUPPLEMENTAZIONE\n\n- Creatina 5g\n\n---\n\n## 5) NOTE STRATEGICHE\n\n- Idratazione\n`;
}

test('piano con somme corrette passa il controllo', () => {
  const r = ctx.verifica(piano([601, 273, 820, 273, 766], [524, 191, 763, 191, 714]), 2733, 2383);
  assert.strictEqual(r.ok, true, JSON.stringify(r.dettagli));
});
test('piano con somma 2105 invece di 2733 viene bocciato', () => {
  const r = ctx.verifica(piano([450, 200, 650, 200, 605], [524, 191, 763, 191, 714]), 2733, 2383);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.dettagli.allenamento.somma, 2105);
});
test('piano con pasti mancanti viene bocciato', () => {
  const r = ctx.verifica('# PIANO NUTRIZIONALE\n\n## 2) GIORNO ALLENAMENTO\n\n**Pranzo — 800 kcal**\n- riso\n', 2733, 2383);
  assert.strictEqual(r.ok, false);
});
test('testo vuoto non genera errori', () => {
  assert.strictEqual(ctx.verifica('', 2733, 2383).ok, false);
});
