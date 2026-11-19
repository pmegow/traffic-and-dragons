// dev/tests-772-console.js — #772: the console that collects the game's popups (owner 2026-11-16; rulings 2026-11-18:
// only inventory changes still pop up, everything else is collected; a dot is green while something is unread).
// The pure half: the kind table, the route, the bounded session ring, the one renderer, and the call sites.
//   node dev/tests-772-console.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0; const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('a toast\'s kind comes from its third argument and from nothing else; a call that names none is a notice', () => {
  assert.equal(toastKind({ kind: 'inventory' }), 'inventory');
  assert.equal(toastKind(undefined), 'notice'); assert.equal(toastKind(null), 'notice'); assert.equal(toastKind({}), 'notice');
  assert.equal(toastKind({ kind: '' }), 'notice'); assert.equal(toastKind({ kind: 7 }), 'notice'); assert.equal(toastKind('inventory'), 'notice', 'a bare string is not a kind');
  assert.equal(TOAST_KIND_DEFAULT, 'notice');
});

test('only an inventory change pops while the console can be opened; everything pops while it cannot', () => {
  assert.deepEqual(Object.keys(TOAST_KINDS), ['inventory'], 'the owner\'s ruling: inventory changes, nothing else');
  assert.equal(toastPops('inventory', true), true);
  assert.equal(toastPops('notice', true), false, 'a notice is collected');
  assert.equal(toastPops('some-new-kind', true), false, 'a kind the table lacks is collected');
  assert.equal(toastPops('toString', true), false, 'an inherited name is no row of the table');
  assert.equal(toastPops('notice', false), true, 'no door to the console: the line must be seen');
  assert.equal(toastPops('inventory', false), true);
});

test('the ring keeps every line with its time, turn and kind; only a line that did not pop is new; reading clears the count', () => {
  consoleClear(); engine.makeTestWorld(); worldState.turn = 12;
  const before = Date.now(), a = consolePush('Quest opportunity: The Bell', 'notice', false), b = consolePush('Collected: rope', 'inventory', true);
  assert.equal(a.turn, 12); assert.ok(a.at >= before); assert.equal(a.kind, 'notice'); assert.equal(a.popped, false); assert.equal(b.popped, true);
  assert.equal(consoleEntries().length, 2, 'a popped line is on record too');
  assert.equal(consoleNewCount(), 1, 'the popped line was already seen');
  consoleEntries().push('x'); assert.equal(consoleEntries().length, 2, 'a reader gets a copy');
  consoleRead(); assert.equal(consoleNewCount(), 0); assert.equal(consoleEntries().length, 2, 'reading removes nothing');
  consolePush(null, undefined, false); assert.equal(consoleEntries()[2].msg, ''); assert.equal(consoleEntries()[2].kind, 'notice');
  consoleClear(); assert.equal(consoleEntries().length, 0); assert.equal(consoleNewCount(), 0);
});

test('the ring is bounded: past the cap the oldest lines are dropped and counted', () => {
  consoleClear(); assert.equal(CONSOLE_CAP, 300);
  for (let i = 0; i < CONSOLE_CAP + 7; i++) consolePush('line ' + i, 'notice', false);
  const e = consoleEntries();
  assert.equal(e.length, CONSOLE_CAP); assert.equal(e[0].msg, 'line 7', 'the oldest went first'); assert.equal(e[e.length - 1].msg, 'line ' + (CONSOLE_CAP + 6));
  assert.equal(consoleDroppedCount(), 7);
  consoleClear(); assert.equal(consoleDroppedCount(), 0);
});

test('the renderer shows each line once, oldest first, escaped, with its time and turn; an empty console and dropped lines are said', () => {
  assert.match(consoleRowsHtml([], 0), /Nothing yet/);
  const at = new Date(2026, 10, 18, 9, 5).getTime();
  const html = consoleRowsHtml([{ at: at, turn: 3, msg: 'first <b>&', kind: 'notice' }, { at: at, turn: null, msg: 'second', kind: 'notice' }], 0);
  assert.ok(html.indexOf('first &lt;b&gt;&amp;') >= 0 && html.indexOf('<b>') < 0, 'a line is text, never markup');
  assert.ok(html.indexOf('first') < html.indexOf('second'), 'oldest first');
  assert.ok(html.indexOf('09:05 · turn 3') >= 0, 'time and turn'); assert.equal(html.split('turn').length - 1, 1, 'a line with no turn shows none');
  assert.equal(html.split("class='console-row'").length - 1, 2);
  assert.match(consoleRowsHtml([], 4), /4 older lines were dropped/); assert.match(consoleRowsHtml([], 1), /1 older line was dropped/);
});

test('showToast routes before it draws anything, records every line, and the three inventory changes name their kind', () => {
  const shell = read('ui-shell.js'), fn = shell.slice(shell.indexOf('function showToast(msg,ms,opts){'), shell.indexOf('function showLoadingModal('));
  const route = fn.indexOf('var _kind=toastKind(opts),_pops=toastPops(_kind,consoleDoorOpen());'), push = fn.indexOf('consolePush(msg,_kind,_pops);'), out = fn.indexOf('if(!_pops){'), draw = fn.indexOf('document.createElement("div")'), sound = fn.indexOf('Sound.playIfQuiet');
  assert.ok(route > 0 && push > route && out > push && draw > out && sound > out, 'kind, record, then the early return: a collected line draws no toast and plays no sound');
  assert.ok(fn.indexOf('consoleDotPaint();return;}') > out, 'a collected line paints the dot');
  assert.ok(!/_pops\s*=[^;]*(indexOf|test|match)\(/.test(fn), 'the route never reads the message');
  assert.ok(read('game.js').indexOf('showToast("🎒 Collected: "+shown,undefined,{kind:"inventory"});') >= 0, 'items gained');
  assert.ok(read('ui-sheets.js').indexOf('+invDropNamesText(names)+stale,6000,{kind:"inventory"});') >= 0, 'items deleted from the sheet');
  assert.ok(read('ui-modals.js').indexOf('showToast(res.line,5000,{kind:"inventory"});') >= 0, 'a completed trade or stash move');
  let kinds = 0; ['game.js', 'ui-sheets.js', 'ui-modals.js', 'tag_table.js', 'api.js', 'state.js', 'helpers.js', 'atlas.js', 'ui-panels.js', 'identity.js'].forEach(f => { kinds += read(f).split('{kind:"inventory"}').length - 1; });
  assert.equal(kinds, 3, 'exactly three sites pop');
});

test('the Console button sits right of Table Talk with its dot, and the dot is grey until it is new', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('<span class="tab-badge" id="tab-tt-badge"></span></button><button class="chat-tab" id="console-btn"') >= 0, 'the next button after Table Talk');
  assert.ok(html.indexOf('onclick="showConsoleModal()">Console <span class="console-dot" id="console-dot"></span></button></div>') >= 0, 'the last button of the row, with the dot');
  assert.ok(html.indexOf('.console-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--t2)') >= 0, 'grey at rest');
  assert.ok(html.indexOf('.console-dot.new{background:var(--grn);opacity:1}') >= 0, 'green when new');
});

(async function () {
  for (const [name, fn] of tests) {
    if (only && name !== only) continue;
    try { await fn(); count++; console.log('PASS #772 console ' + name); } catch (e) { failed++; console.error('FAIL #772 console ' + name + ': ' + e.message); }
  }
  console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
  process.exit(failed || (only && !count) ? 1 : 0);
})();
