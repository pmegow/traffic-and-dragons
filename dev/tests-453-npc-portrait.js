// tests-453-npc-portrait.js — #453 (owner 2026-09-24): the NPC sheet shows and edits the portrait for EVERY NPC, not
// only party members. The gate hid existing portraits (every Village resident carries one) and left townsfolk with no
// way to get a face. The real showNpcSheet runs here against a recording DOM stub (the tests-429 pattern), with
// modalShell and showPortraitModal captured so the avatar markup and the click path can be asserted; one source
// contract pins the two gates gone. DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-453-npc-portrait.js

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
loader.makeTestWorld({ kind: "adventure" });

// ── DOM stub: every id resolves to a recording element ──────────────────────
var __els = {}, __modals = [], __portraitCalls = [];
function el(id) {
  if (__els[id]) return __els[id];
  var e = { id: id, style: {}, innerHTML: "", textContent: "", className: "", value: "", _h: {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    appendChild: function () {}, remove: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }, focus: function () {},
    addEventListener: function (ev, fn) { (e._h[ev] = e._h[ev] || []).push(fn); } };
  __els[id] = e; return e;
}
global.window = global;
global.navigator = { userAgent: "node" };
global.document = { getElementById: function (id) { return el(id); }, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, createElement: function () { return el("_anon" + Math.random()); },
  body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } }, activeElement: null };

var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
showToast = function () {}; saveAll = function () {}; saveCore = function () {}; saveMem = function () {};
modalShell = function (id, html) { __modals.push({ id: id, html: html }); return el(id); };
showPortraitModal = function (refresh, opts) { __portraitCalls.push({ refresh: refresh, opts: opts }); };
wirePortraitDrag = function () {}; /* ui-portrait.js is not loaded — the drag wiring is DOM-only and not under test here */

function fresh() { __els = {}; __modals.length = 0; __portraitCalls.length = 0; loader.makeTestWorld({ kind: "adventure" }); }
function lastNpcHtml() { var m = __modals.filter(function (x) { return x.id === "npc-modal"; }).pop(); return m ? m.html : ""; }
function addTownsfolk(name, extra) {
  var n = { name: name, status: "steady", rel: "neutral", met: 1, pronouns: "she/her" };
  Object.keys(extra || {}).forEach(function (k) { n[k] = extra[k]; });
  worldState.npcs.push(n); memory.npcs[name] = { attitude: "", knowledge: [], events: [] };
  return n;
}

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS #453 " + name); }
  catch (e) { failed++; console.error("FAIL #453 " + name + " — " + (e && e.message)); }
}

test("a non-party NPC WITH a portrait shows it on the editable avatar (the sheet used to draw initials over it)", function () {
  fresh(); addTownsfolk("Ash Yarwick", { portrait: "data:image/jpeg;base64,ASHY" });
  showNpcSheet("Ash Yarwick"); var h = lastNpcHtml();
  assert.ok(h.indexOf("id='npc-portrait-img' src='data:image/jpeg;base64,ASHY'") >= 0, "portrait not rendered: " + h.slice(0, 240));
  assert.ok(h.indexOf("id='npc-avatar-btn'") >= 0, "the avatar is not the editable one");
});

test("a non-party NPC WITHOUT a portrait gets the editable avatar (initials + the edit overlay), never the dead initials circle", function () {
  fresh(); addTownsfolk("Mother Vane");
  showNpcSheet("Mother Vane"); var h = lastNpcHtml();
  assert.ok(h.indexOf("id='npc-avatar-btn'") >= 0, "no editable avatar");
  assert.ok(h.indexOf("cs-avatar-overlay") >= 0, "no edit overlay");
  assert.ok(h.indexOf("cursor:default") < 0, "the dead initials circle is still there");
});

test("clicking a townsfolk avatar opens the portrait modal for THAT NPC; a generated portrait lands on the NPC (no sheet → npc.portrait) and marks the portrait sync dirty", function () {
  fresh(); var dirty = 0; storageAdapter.markPortraitDirty = function () { dirty++; };
  var n = addTownsfolk("Mother Vane");
  showNpcSheet("Mother Vane");
  var av = el("npc-avatar-btn"); assert.ok(av._h.click && av._h.click.length, "no click handler on the avatar");
  av._h.click[0]({});
  assert.equal(__portraitCalls.length, 1, "the portrait modal did not open");
  var o = __portraitCalls[0].opts;
  assert.equal(o.subject.name, "Mother Vane", "the modal's subject is not this NPC");
  assert.ok(!o.getPortrait(), "getPortrait returned a portrait for a portrait-less NPC");
  o.setPortrait("data:x");
  assert.equal(n.portrait, "data:x", "the generated portrait did not land on the NPC");
  assert.equal(dirty, 1, "the portrait sync was not marked dirty");
});

test("a non-party NPC WITH a sheet stores the generated portrait on the sheet (the #3 single home), never beside it", function () {
  fresh(); storageAdapter.markPortraitDirty = function () {};
  var n = addTownsfolk("Halvard", { charSheet: { name: "Halvard", cls: "Warrior", level: 1, hp: 5, maxHp: 5, stats: {}, abilities: [], spells: [], inventory: [] } });
  showNpcSheet("Halvard");
  el("npc-avatar-btn")._h.click[0]({});
  __portraitCalls[0].opts.setPortrait("data:y");
  assert.equal(n.charSheet.portrait, "data:y", "the sheet did not receive the portrait");
  assert.ok(!n.portrait, "a duplicate portrait was left on the NPC record");
});

test("source: the party gate on the NPC sheet's avatar and its handlers is gone", function () {
  var s = fs.readFileSync(path.join(ROOT, "ui-sheets.js"), "utf8");
  assert.ok(s.indexOf("var avatarHtml=isParty") < 0, "the avatar markup is still party-gated");
  assert.ok(s.indexOf('if(isParty&&document.getElementById("npc-avatar-btn"))') < 0, "the portrait handlers are still party-gated");
});

if (failed) { console.error("#453 npc portrait: " + failed + " FAILED"); process.exit(1); }
console.log("ALL GREEN — #453 npc portrait (5 groups)");
