// tests-430-ledger-rows-live.js — #430 (owner field report 2026-09-21): the inventory panel's ledger rows
// ("⇆ Trade with <keeper>", "⇅ Stow and take") were DEAD after every GM turn. Mechanism: _invLedgerRow baked
// the busy flag into the row at paint time (no onclick, grey, "Wait for the turn to finish"), and the turn's
// own repaint (syncUI in sendAction, game.js) runs BEFORE busy=false — nothing repaints after the flag flips.
// The owner stood in Ammut's house with a stocked chest and a greyed "Stow and take".
//
// The fix is the class, not the point: nothing about busy is baked into the DOM. Rows always carry their
// click; ONE gate (invLedgerOpen) checks busy at CLICK time and refuses loudly. This battery pins:
//   • the field failure — a panel painted during a turn is live once the turn ends, with no repaint
//   • the gate — while busy: a toast and no opener call; idle: the opener runs
//   • an opener that is not on the page refuses loudly instead of throwing from an inline onclick
//   • source: _invLedgerRow never reads busy; both call sites pass a NAME, never a call
// BEHAVIOURAL through the real ui-panels.js in node with DOM stubs (the tests-audit-ui.js pattern).
// DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-430-ledger-rows-live.js

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
loader.makeTestWorld({ kind: "village", clock: { min: 12 * 1440 + 10 * 60 } });

// ── DOM + persistence stubs ───────────────────────────────────────────────────
var __toasts = [], __els = {};
function __stubEl(id) {
  return { id: id, appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "",
    className: "", classList: { add: function () {}, remove: function () {} }, addEventListener: function () {},
    setAttribute: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
}
function el(id) { if (!__els[id]) __els[id] = __stubEl(id); return __els[id]; }
global.window = global;
global.navigator = { userAgent: "node" };
global.document = { getElementById: function (id) { return el(id); }, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, createElement: function () { return __stubEl(); },
  body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } } };

var geval = eval;
["ui-shell.js", "ui-panels.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
showToast = function (m) { __toasts.push(String(m)); };
saveAll = function () {}; saveCore = function () {}; saveMem = function () {};
/* The two ledger predicates are pure engine reads; here they are stubbed OPEN so the rows paint. */
villageTradeContext = function () { return { ok: true, keeper: "Frizwick" }; };
stashTradeCatalog = function () { return { ok: true, carried: [], stored: [] }; };
kindDef = function () { return { id: "village", waresPerShop: true, stashQuantities: true }; };
var __opened = [];
showShopModal = function () { __opened.push("shop"); };
showStashModal = function () { __opened.push("stash"); };
showHouseDesignModal = function () { __opened.push("design"); };

function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
function fresh() { busy = false; __toasts.length = 0; __opened.length = 0; }
function paint() { updateInvPanel(); return el("inv-list").innerHTML; }
function rows(html) {
  var out = [], re = /<div class="ii inv-ledger"[^>]*>[^<]*<\/div>/g, m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}
/* Drive a row the way the browser would: read its data-open and run its onclick handler. */
function clickRow(rowHtml) {
  var name = (rowHtml.match(/data-open="([^"]+)"/) || [])[1];
  assert(name, "the row carries no data-open: " + rowHtml);
  assert(/onclick="invLedgerOpen\(this\.dataset\.open\)"/.test(rowHtml), "the row carries no click: " + rowHtml);
  return invLedgerOpen(name);
}

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS #430 " + name); }
  catch (e) { failed++; console.error("FAIL #430 " + name + " — " + (e && e.message)); }
}

// ── the field failure ────────────────────────────────────────────────────────
test("a panel painted DURING a turn is live once the turn ends, with no repaint (the chest after every GM turn)", function () {
  fresh();
  busy = true;
  var html = paint();                          /* syncUI runs while busy — exactly the sendAction order */
  var r = rows(html);
  assert.equal(r.length, 2, "expected the counter and the chest rows, got " + r.length + ": " + html);
  assert(!/Wait for the turn/.test(html), "the paint baked the busy state into a title");
  assert(!/var\(--t2\)/.test(r.join("")), "the paint baked the busy state into the colour");
  busy = false;                                /* the turn ends; nothing repaints */
  assert.equal(clickRow(r[1]), true, "the chest row painted during the turn is still dead after it");
  assert.deepEqual(__opened, ["stash"], "the chest did not open: " + JSON.stringify(__opened));
  assert.equal(clickRow(r[0]), true);
  assert.deepEqual(__opened, ["stash", "shop"]);
  assert.equal(__toasts.length, 0, "an idle click toasted: " + __toasts.join(" | "));
});

// ── the gate ─────────────────────────────────────────────────────────────────
test("while a turn is in flight a click refuses loudly and opens nothing", function () {
  fresh();
  var r = rows(paint());
  busy = true;
  assert.equal(clickRow(r[1]), false);
  assert.deepEqual(__opened, [], "the chest opened during a turn");
  assert.equal(__toasts.length, 1, "the refusal was silent");
  assert(/Wait for the turn to finish/.test(__toasts[0]), "toast: " + __toasts[0]);
  busy = false;
  assert.equal(clickRow(r[1]), true, "the same row is dead once the turn ended");
});

test("an opener missing from the page refuses loudly instead of throwing from an inline onclick", function () {
  fresh();
  assert.equal(invLedgerOpen("showNoSuchModal"), false);
  assert.equal(__toasts.length, 1);
  assert(/showNoSuchModal/.test(__toasts[0]) && /not available/.test(__toasts[0]), "toast: " + __toasts[0]);
  assert.equal(invLedgerOpen("showStashModal()"), false, "a NAME with parens must not resolve (the old call-string shape)");
});

test("the rows paint only where their predicate is open; the design row is untouched", function () {
  fresh();
  stashTradeCatalog = function () { return { ok: false, reason: "not in a house" }; };
  var html = paint();
  assert.equal(rows(html).length, 1, "the chest row painted outside a house");
  assert(/showHouseDesignModal\(\)/.test(html), "the design row went missing");
  stashTradeCatalog = function () { return { ok: true, carried: [], stored: [] }; };
});

// ── source contracts ─────────────────────────────────────────────────────────
test("source: _invLedgerRow never reads busy; the gate does; both call sites pass a NAME, never a call", function () {
  var s = src("ui-panels.js");
  var row = s.slice(s.indexOf("function _invLedgerRow("), s.indexOf("function updateInvPanel("));
  assert(row.length > 0, "_invLedgerRow is not defined before updateInvPanel");
  assert(!/busy/.test(row), "_invLedgerRow bakes the busy flag into the paint again");
  assert(/onclick="invLedgerOpen\(this\.dataset\.open\)"/.test(row), "the row does not route through the one gate");
  var gate = s.slice(s.indexOf("function invLedgerOpen("), s.indexOf("function _invLedgerRow("));
  assert(/busy/.test(gate) && /Wait for the turn to finish/.test(gate), "the gate does not check busy loudly");
  assert(s.indexOf("_invLedgerBusy") < 0, "the paint-time busy helper still ships");
  assert(/_invLedgerRow\("showShopModal",/.test(s), "the counter passes a call string, not a name");
  assert(/_invLedgerRow\("showStashModal",/.test(s), "the chest passes a call string, not a name");
  assert(!/_invLedgerRow\("[A-Za-z]+\(\)"/.test(s), "a call site still passes a call string");
  assert(src("dev/run-standalone-suites.js").indexOf("dev/tests-430-ledger-rows-live.js") >= 0, "this battery is not registered in run-standalone-suites.js");
});

if (failed) { console.error("#430 ledger rows: " + failed + " FAILED"); process.exit(1); }
console.log("#430 ledger rows: all green");
