// tests-481-g5-class-guards.js — #481 G5 (audit 2026-09-29, Fable-approved): three "class-wide" guards checked hand-written
// lists. The #356 scan counted tickers in six named files while model/image waits froze their status elsewhere (the audit named
// four; the derived scan found seven: the designer's creature, generate, review and apply waits, the wizard's random hero, the
// scene Enhance); the palette contract never looked at pages that skip satellite.css (story_compiler, necro_spells_TMP); the
// SW allowlist contracts named three satellites while necro_spells_TMP was served cache-first. dev/class-guards.js derives all
// three classes from the source, with ONE reasoned exemption registry.
//   node dev/tests-481-g5-class-guards.js
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const cg = require('./class-guards.js');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G5 ' + name); } catch (e) { failed++; console.error('FAIL #481 G5 ' + name + ' — ' + (e && e.message || e)); } }
const flagged = list => cg.frozenWaitPaints(null, { sources: cg.sourcesOf(list), exempt: [] }).map(p => p.fn + ':' + p.literal);

test('the live tree: every model/image wait ticks, every page is on the palette and network-first, no stale exemption', () => {
  assert.deepEqual(cg.allProblems(root), []);
});
test('a frozen status is found in every wait shape: await, a promise, through a named helper, inside a .map flow, the \\u2026 escape', () => {
  assert.deepEqual(flagged([{ file: 'a.js', text: 'async function f(b){b.textContent="Working…";await callGM("x");}' }]), ['f:Working…'], 'await');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'function g(el){el.innerHTML="<i>Rendering…</i>";falFetch("e",{}).then(function(){});}' }]), ['g:<i>Rendering…</i>'], 'a promise');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'async function helper(){return await callGM("x");}' }, { file: 'b.js', text: 'async function h(b){b.textContent="Thinking…";await helper();}' }]), ['h:Thinking…'], 'through a helper in another file');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'async function inner(){return await callGM("x");}\nasync function outer(){return await inner();}' }, { file: 'b.js', text: 'async function h2(b){b.textContent="Composing…";await outer();}' }]), ['h2:Composing…'], 'through two helpers (the fixpoint, not one level)');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'async function r(){setStatus("Reviewing 3 sections…","");await Promise.all([1,2].map(function(c){return callGM(c);}));}' }]), ['r:Reviewing 3 sections…'], 'a .map flow');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'async function d(el){el.textContent="Drafting\\u2026";await callGM("x");}' }]), ['d:Drafting\\u2026'], 'the escape');
  assert.deepEqual(flagged([{ file: 'p.html', text: '<p>Don\'t {panic}</p><script>function send(){return callGM("x");}\nfunction go(b){b.textContent="Sending…";send();}</script>' }]), ['go:Sending…'], 'a page-local helper (prose apostrophes and braces outside the script ignored)');
});
test('nothing that is not a frozen wait is flagged: a ticker, a deferred handler, a call inside a string, a module-private name, another page\'s helper', () => {
  assert.deepEqual(flagged([{ file: 'a.js', text: 'async function f(el){var t=elapsedTicker(el,"Working…",{text:true});await callGM("x");t.stop();}' }]), [], 'a ticker is not a paint');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'function wire(b){b.textContent="Open…";b.addEventListener("click",function(){callGM("x");});b.onclick=function(){falFetch("e");};setTimeout(function(){callGM("y");},9);}' }]), [], 'a function that wires a waiting handler is not waiting');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'function list(el){el.innerHTML="<button onclick=\\"callGM(1)\\">Load…</button>";}' }]), [], 'a call inside a string is markup');
  assert.deepEqual(flagged([{ file: 'a.js', text: 'var M=(function(){function run(){return callGM("x");}return {go:function(){return run();}};})();\nfunction other(el){el.textContent="Saving…";run();}' }]), [], 'a module-private run() is nobody\'s global');
  assert.deepEqual(flagged([{ file: 'p.html', text: '<script>function send(){return callGM("x");}</script>' }, { file: 'q.html', text: '<script>function go2(b){b.textContent="Sending…";send();}</script>' }]), [], 'another page\'s helper');
  assert.deepEqual(cg.frozenWaitPaints(null, { sources: cg.sourcesOf([{ file: 'a.js', text: 'async function f(b){b.textContent="Working…";await callGM("x");}' }]), exempt: [{ file: 'a.js', literal: 'Working…', why: 'fixture' }] }), [], 'an exemption filters its paint');
});
test('the palette class: a page without satellite.css fails unless exempt; an exemption the page no longer needs is stale', () => {
  const pages = [{ file: 'a.html', text: '<link rel="stylesheet" href="satellite.css">' }, { file: 'b.html', text: '<style>:root{--bg:#000}</style>' }, { file: 'c.html', text: '<p>no ui</p>' }];
  const probs = cg.paletteProblems(null, { pages: pages, exempt: { 'c.html': 'fixture: no UI' } });
  assert.equal(probs.length, 1, JSON.stringify(probs)); assert.match(probs[0], /^b\.html does not link satellite\.css/);
  const stale = cg.staleExemptions(null, { pages: pages, registry: { palette: { 'a.html': 'x', 'gone.html': 'y' }, networkFirst: { 'nope.html': 'z' }, paints: [] } });
  assert.equal(stale.length, 3, JSON.stringify(stale));
  assert.ok(stale.some(s => /a\.html, which links satellite\.css/.test(s)) && stale.some(s => /gone\.html, which is not a tracked/.test(s)) && stale.some(s => /nope\.html/.test(s)));
});
test('the network-first class: every page outside APP_SHELL must match sw.js\'s regex', () => {
  const sw = 'var APP_SHELL = [\n  "./",\n  "./piper-host.html",\n  "./globals.js"\n];\nself.addEventListener("fetch",function(e){\n  if(/blueprint-designer|todo-viewer|\\/test\\.html(?:$|[?#])/.test(e.request.url)){\n  }\n});\n';
  const pages = ['index.html', 'piper-host.html', 'todo-viewer.html', 'test.html', 'rogue.html'].map(f => ({ file: f, text: '' }));
  const probs = cg.networkFirstProblems(null, { pages: pages, sw: sw, exempt: {} });
  assert.equal(probs.length, 1, JSON.stringify(probs)); assert.match(probs[0], /^rogue\.html is outside APP_SHELL/);
  assert.throws(() => cg.networkFirstProblems(null, { pages: pages, sw: sw.replace('if(/blueprint-designer|', 'if(/other|'), exempt: {} }), /network-first regex line/, 'a reshaped fetch handler fails loudly, never passes');
});
test('a thinking marker\'s words change only through setThinking: a direct write in the function that painted it is found (its callbacks included)', () => {
  const writes = list => cg.thinkingMarkerWrites(null, { sources: cg.sourcesOf(list) }).map(p => p.fn + ':' + p.name);
  assert.deepEqual(writes([{ file: 'a.js', text: 'function f(){var th=addMsg("thinking","Working...");gen(function(t){th.innerHTML=t;});}' }]), ['f:th'], 'a progress callback');
  assert.deepEqual(writes([{ file: 'a.js', text: 'async function g(){var m;m=addMsg(\'thinking\',"A...");await callGM("x");m.textContent="B...";}' }]), ['g:m'], 'a later assignment, single quotes');
  assert.deepEqual(writes([{ file: 'a.js', text: 'function f(){var th=addMsg("thinking","Working...");setThinking(th,"Next...");th.remove();}' }]), [], 'setThinking is the sanctioned path');
  assert.deepEqual(writes([{ file: 'a.js', text: 'function a(){var th=addMsg("thinking","W...");th.remove();}\nfunction b(th){th.textContent="a table cell";}' }]), [], 'another function\'s th is another variable');
  assert.deepEqual(writes([{ file: 'a.js', text: 'function f(){var n=addMsg("narrator","x");n.innerHTML="y";var th=addMsg("thinking","W...");log("th.innerHTML=z");}' }]), [], 'a narration, and a write inside a string, are not marker writes');
});
test('every exemption carries a reason', () => {
  cg.EXEMPT.paints.forEach(e => assert.ok(e.file && e.literal && e.why && e.why.length > 20, 'paint exemption without a reason: ' + JSON.stringify(e)));
  Object.keys(cg.EXEMPT.palette).concat(Object.keys(cg.EXEMPT.networkFirst)).forEach(f => assert.ok(String(cg.EXEMPT.palette[f] || cg.EXEMPT.networkFirst[f]).length > 20, 'exemption without a reason: ' + f));
});
test('the fixed waits stop their ticker BEFORE the terminal text (else the next tick overwrites the result)', () => {
  const gm = fs.readFileSync(path.join(root, 'game.js'), 'utf8'), cc = fs.readFileSync(path.join(root, 'char-creation.js'), 'utf8'), bpd = fs.readFileSync(path.join(root, 'blueprint-designer.html'), 'utf8');
  const enh = gm.slice(gm.indexOf('enhanceBtn.addEventListener("click"'), gm.indexOf('var portraitBtn=mkBtn('));
  assert.ok(/var _et=elapsedTicker\(enhanceBtn,"Enhancing…",\{text:true\}\)/.test(enh), 'the Enhance button rides the ticker');
  assert.equal((enh.match(/_et\.stop\(\);enhanceBtn\.textContent="✨ Enhance"/g) || []).length, 2, 'both terminal writes (success, failure) stop the ticker first');
  const rh = cc.slice(cc.indexOf('async function aiRandomHero('), cc.indexOf('async function aiRandomiseAll('));
  assert.ok(/showLoadingModal\("Writing your hero…"\)/.test(rh) && /finally\{if\(_done\)_done\(\);/.test(rh), 'the random hero waits under the ticking loading modal, removed in finally');
  assert.ok(/function statusTicker\(base\)\{setStatus\(base,""\);return elapsedTicker\(document\.getElementById\("statusline"\),base,\{text:true\}\);\}/.test(bpd), 'the designer\'s statusTicker');
  assert.ok(/var _at=_applyingAll\?null:statusTicker\(/.test(bpd), 'a lone apply ticks; inside Apply-all the batch owns the line');
  assert.ok(/\}finally\{_applyingAll=false;if\(_bt\)_bt\.stop\(\);\}/.test(bpd), 'the batch stops its ticker before the summary');
});
console.log('#481 G5 CLASS GUARDS: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
