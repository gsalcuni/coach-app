const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const h = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

test('logica e testi della tab Nutrizione invariati rispetto all\'originale', () => {
  const a = html.indexOf('const ALIMENTI'), b = html.indexOf('const CATEGORIE');
  assert.strictEqual(h(html.slice(a, b).trim()), '2dc3298c0d43c3ae');
  for (const [n, exp] of [['calcolaTDEE', '7624ac0a11bc3819'], ['calcolaTarget', '824fcdd62ee011a3']]) {
    const i = html.indexOf('function ' + n), j = html.indexOf('\n}\n', i) + 3;
    assert.strictEqual(h(html.slice(i, j).trim()), exp, n);
  }
  const t = html.slice(html.indexOf('id="tab-nutrizione"'));
  assert.strictEqual(h(t.match(/<div class="footnote">[\s\S]*?<\/div>/)[0]), 'bfd90cbbfb3aa388');
  assert.strictEqual(h(t.match(/<p class="intro">[\s\S]*?<\/p>/)[0]), '3571e705dbb84b51');
});

test('id e handler della tab Nutrizione ancora presenti', () => {
  for (const id of ['btn-allenamento', 'btn-riposo', 'kcal-value', 'peso', 'altezza', 'eta', 'macro-accordions', 'ring-p', 'ring-c', 'ring-g', 'nut-info-btn'])
    assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(html.includes("btnAllenamento.addEventListener('click'"));
  assert.ok(html.includes("btnRiposo.addEventListener('click'"));
  assert.ok(html.includes('Macronutrienti — tocca per vedere alternative'));
  assert.ok(!html.includes('id="bar-p"'));
});

test('anello: archi coerenti con le percentuali', () => {
  const src = html.split('// RING-START')[1].split('// RING-END')[0];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.f=calcolaAnello;', ctx);
  const r = ctx.f({ proteine: 22, carboidrati: 57, grassi: 21 }, 48, 3);
  const C = 2 * Math.PI * 48;
  assert.ok(Math.abs(r.circonferenza - C) < 1e-9);
  assert.ok(Math.abs(r.proteine.len - (0.22 * C - 3)) < 1e-9);
  assert.ok(Math.abs(r.carboidrati.offset + 0.22 * C) < 1e-9);
  assert.ok(Math.abs(r.grassi.offset + 0.79 * C) < 1e-9);
  const z = ctx.f({ proteine: 0, carboidrati: 0, grassi: 0 });
  assert.strictEqual(z.proteine.len, 0);
});

test('nessuna emoji di sistema nella tab Nutrizione e nella nav', () => {
  const t = html.slice(html.indexOf('id="tab-nutrizione"'), html.indexOf('id="tab-allenamento"'));
  const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t + nav));
});
