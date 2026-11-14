const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const tab = (id, next) => html.slice(html.indexOf('id="' + id + '"'), html.indexOf('id="' + next + '"'));

test('backup spostato nel Profilo, non più nella tab Allenamento', () => {
  const all = tab('tab-allenamento', 'tab-diario');
  const prof = html.slice(html.indexOf('id="tab-profilo"'), html.indexOf('<!-- SPINNER -->'));
  for (const id of ['export-btn', 'import-btn', 'import-input']) {
    assert.ok(!all.includes('id="' + id + '"'), id + ' ancora in Allenamento');
    assert.ok(prof.includes('id="' + id + '"'), id + ' assente nel Profilo');
    assert.strictEqual(html.split('id="' + id + '"').length - 1, 1, id + ' duplicato');
  }
  assert.ok(prof.includes('Esporta backup') && prof.includes('Importa backup'));
  assert.ok(html.includes("document.getElementById('export-btn').addEventListener('click'"));
  assert.ok(html.includes("document.getElementById('import-input').addEventListener('change'"));
});

test('card esercizio: tasto Registra, badge e dati salvataggio invariati', () => {
  assert.ok(html.includes("registra.textContent = '+ Registra'"));
  assert.ok(html.includes("class=\"es-badge\""));
  assert.ok(html.includes("saveBtn.dataset.saveEs = chiaveLog(nome, giornoCorrente);"));
  assert.ok(html.includes("dataset.input = 'serie'") && html.includes("dataset.input = 'rip'") && html.includes("dataset.input = 'peso'") && html.includes("dataset.input = 'note'"));
  assert.ok(html.includes('Nessun dato registrato'));
  assert.ok(html.includes('Ultima: '));
});

test('il tasto Registra non porta attributi di salvataggio o eliminazione', () => {
  const i = html.indexOf("registra.className = 'es-registra'");
  const blocco = html.slice(i, i + 600);
  assert.ok(!/dataset\.(saveEs|deleteEs)/.test(blocco));
});

test('niente emoji di sistema in Allenamento e nel pulsante chat', () => {
  const t = tab('tab-allenamento', 'tab-diario');
  const chat = html.slice(html.indexOf('id="chat-open-btn"'), html.indexOf('id="chat-open-btn"') + 400);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2B06}\u{2B07}]/u.test(t + chat));
});
