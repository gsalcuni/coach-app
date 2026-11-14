const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

test('Diario: id e handler originali ancora presenti', () => {
  for (const id of ['scale-sonno','scale-qualita-sonno','scale-emotivo','scale-energia','check-braindump','check-respiro','check-palestra','azione-domani','fiero-oggi','affermazione','note-libere','diario-save-btn','add-sintomo-btn'])
    assert.ok(html.includes('id="' + id + '"'), id);
});
test('Diario: Brain Dump è card evidenziata', () => {
  assert.match(html, /check-row check-feat/);
});
test('Profilo: id, handler e report originali presenti', () => {
  for (const id of ['btn-inizia-assessment','btn-avanti-foto','btn-genera-assessment','btn-torna-form','btn-nuovo-assessment','export-btn','import-btn','import-input'])
    assert.ok(html.includes('id="' + id + '"'), id);
  for (const s of ["scaricaDoc('assessment')","scaricaDoc('allenamento')","scaricaDoc('nutrizione')",'report-feat','report-list','hero-verde'])
    assert.ok(html.includes(s), s);
});
