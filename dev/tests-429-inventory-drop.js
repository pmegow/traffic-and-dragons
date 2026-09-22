// tests-429-inventory-drop.js — #429 BATCH DROP (owner 2026-09-21): the character sheet's × MARKS an
// inventory row for dropping (the name goes red, the × becomes the un-mark); one "Drop N items" button at
// the foot of the list commits every mark at once. The thorn: clearing a hundred single-campaign items one
// native confirm at a time. Rulings: the button (not a prompt on close), no confirm and no undo (the red
// rows are the review), the button at the foot of the inventory list; closing the sheet discards pending
// marks with a toast, never silently.
//
// Two kinds of assertion, deliberately (the tests-audit-ui.js pattern):
//   • BEHAVIOURAL — the engine + the sheet files are geval'd into node with DOM stubs, so the real
//     mark / commit / discard functions run against the real fixture world.
//   • SOURCE CONTRACT — the modal shells a headless run cannot drive: the onClose wiring on both sheet
//     hosts, the render deciding marks through the plan, the confirm-free path, the dead per-item drop.
// DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-429-inventory-drop.js

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } });

// ── DOM + persistence stubs ───────────────────────────────────────────────────
var __toasts = [], __saves = 0, __invPanel = 0, __rerender = 0, __npcShown = [];
function __stubEl() {
  return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "",
    className: "", classList: { add: function () {}, remove: function () {} }, addEventListener: function () {},
    setAttribute: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
}
global.window = global;
global.navigator = { userAgent: "node" };
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, createElement: function () { return __stubEl(); },
  body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } } };
/* The per-item native confirm is DEAD — reaching it is the failure this battery exists to catch. */
global.confirm = function () { throw new Error("window.confirm reached — the × must mark, never prompt"); };

var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js"].forEach(function (f) {
  geval(fs.readFileSync(path.join(ROOT, f), "utf8"));
});
// The UI files define their own shells — re-stub AFTER loading or every assertion drives real DOM.
showToast = function (m) { __toasts.push(String(m)); };
saveAll = function () { __saves++; }; saveCore = function () {}; saveMem = function () {};
updateInvPanel = function () { __invPanel++; };
_csReRender = function () { __rerender++; return true; };
refreshCharSheetInPlace = function () { __rerender++; return true; };
showCharSheet = function () {};
showNpcSheet = function (n) { __npcShown.push(n); };

function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
function fresh() {
  busy = false; __toasts.length = 0; __saves = 0; __invPanel = 0; __rerender = 0; __npcShown.length = 0;
  var w = loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } });
  _invDropMarks.camp = null; _invDropMarks.by = {};
  return w;
}
function marksFor(owner) { return _invDropMarksFor(owner); }
/* The whole rendered row for one item: from its cs-list-row open tag to the row's close. */
function rowOf(html, name) {
  var a = html.indexOf('data-item="' + name + '"'); if (a < 0) return "";
  return html.slice(html.lastIndexOf('<div class="cs-list-row"', a), html.indexOf("</div>", a));
}

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS #429 " + name); }
  catch (e) { failed++; console.error("FAIL #429 " + name + " — " + (e && e.message)); }
}

// ── the × marks ──────────────────────────────────────────────────────────────
test("the × marks a row; the second × un-marks it; nothing is dropped, saved or confirmed", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Longsword", "Chain shirt", "Rope"];
  markInvItem("", 1, null);
  assert.equal(c.inventory.length, 3, "the × still drops at once");
  assert.equal(invDropCount(marksFor("")), 1, "the row was not marked");
  assert.equal(__saves, 0, "a mark is session state — it must not save");
  assert.equal(__rerender, 1, "the sheet did not repaint after the mark");
  markInvItem("", 1, null);
  assert.equal(invDropCount(marksFor("")), 0, "the second × did not un-mark");
  assert.equal(c.inventory.length, 3);
  markInvItem("", 99, null); markInvItem("", "x", null);
  assert.equal(invDropCount(marksFor("")), 0, "an out-of-range index marked something");
  assert.equal(__toasts.length, 0, "a mark toasted: " + __toasts.join(" | "));
});

// ── the button commits ───────────────────────────────────────────────────────
test("Drop N items commits every mark at once: one splice pass, worn pruned, one save, one toast, marks cleared, panels repainted", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Longsword", "Chain shirt", "Rope", "Bread"]; c.worn = ["Chain shirt"];
  markInvItem("", 1, null); markInvItem("", 3, null);
  __saves = 0; __rerender = 0; __invPanel = 0;
  dropMarkedItems("", null);
  assert.deepEqual(c.inventory, ["Longsword", "Rope"], "the wrong rows went: " + JSON.stringify(c.inventory));
  assert.deepEqual(c.worn, [], "a dropped item is still listed as worn — attireLine would inject it into every prompt (E4)");
  assert.equal(__saves, 1, "expected exactly one save, got " + __saves);
  assert.equal(__toasts.length, 1, "expected one toast, got: " + __toasts.join(" | "));
  assert(/Dropped 2 items: Chain shirt, Bread/.test(__toasts[0]), "the toast does not name the count and the items: " + __toasts[0]);
  assert.equal(invDropCount(marksFor("")), 0, "marks survived the commit");
  assert(__rerender >= 1 && __invPanel >= 1, "the sheet and the side panel were not repainted");
});

test("a GM splice between the mark and the button drops the marked item, not the row that slid into its index", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Lamp", "Rope", "Torch"];
  markInvItem("", 2, null);              /* Torch */
  c.inventory.splice(0, 1);              /* the GM took the lamp: Torch is now at index 1 */
  dropMarkedItems("", null);
  assert.deepEqual(c.inventory, ["Rope"], "dropped by stale index: " + JSON.stringify(c.inventory));
});

test("a mark the GM already consumed is refused loudly and drops nothing", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Lamp", "Potion"];
  markInvItem("", 1, null);
  c.inventory.splice(1, 1);              /* the potion was drunk on the GM's turn */
  __saves = 0; __toasts.length = 0;
  dropMarkedItems("", null);
  assert.deepEqual(c.inventory, ["Lamp"], "something else was dropped");
  assert.equal(__saves, 0, "a refused commit still saved");
  assert.equal(__toasts.length, 1, "the refusal was silent");
  assert(/Nothing to drop/.test(__toasts[0]) && /Potion/.test(__toasts[0]), "the refusal does not name the vanished item: " + __toasts[0]);
  assert.equal(invDropCount(marksFor("")), 0, "the stale mark lingered");
});

test("a stale mark beside live ones is reported in the same toast, the live ones still drop", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Lamp", "Potion", "Rope"];
  markInvItem("", 1, null); markInvItem("", 2, null);
  c.inventory.splice(1, 1);
  __toasts.length = 0;
  dropMarkedItems("", null);
  assert.deepEqual(c.inventory, ["Lamp"]);
  assert(/Dropped 1 item: Rope/.test(__toasts[0]) && /no longer carried: Potion/.test(__toasts[0]), "toast: " + __toasts[0]);
});

// ── the render ───────────────────────────────────────────────────────────────
test("the render: marked rows read red with the un-mark ×, the button carries the live count at the foot of the list, no marks → no button", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Longsword", "Chain shirt", "Rope"];
  var plain = csSheetSections(c, "");
  assert(plain.indexOf("inv-drop-btn") < 0, "the button renders with nothing marked");
  assert(plain.indexOf("inv-marked") < 0, "a row reads marked with nothing marked");
  assert(/markInvItem\(this\.dataset\.own,this\.dataset\.idx,event\)/.test(plain), "the × no longer calls markInvItem");
  assert(!/dropInvItem\(/.test(plain), "the × still calls the dead per-item drop");
  markInvItem("", 0, null); markInvItem("", 2, null);
  var marked = csSheetSections(c, "");
  var btnAt = marked.indexOf("inv-drop-btn"), lastRowAt = marked.lastIndexOf('class="inv-x"');
  assert(btnAt > 0, "the button is missing with two marks");
  assert(btnAt > lastRowAt, "the button is not at the foot of the list");
  assert(/Drop 2 items/.test(marked), "the button does not carry the live count");
  assert.equal((marked.match(/inv-marked/g) || []).length, 2, "expected two marked rows");
  var swordRow = rowOf(marked, "Longsword");
  /* the NAME span itself must carry the red — the × beside it is red on a marked row too, so a bare row-wide match proves nothing (sabotage 2026-09-21 found exactly that hole) */
  assert(/class="inv-name inv-marked"[^>]*style="[^"]*color:var\(--dng\)/.test(swordRow), "the marked row's name is not red");
  assert(/title="Keep this item/.test(swordRow), "the × on a marked row does not read as the un-mark");
  var shirtRow = rowOf(marked, "Chain shirt");
  assert(shirtRow && !/inv-marked/.test(shirtRow), "an unmarked row reads marked");
  assert(/title="Mark this item to drop"/.test(shirtRow), "the × on an unmarked row does not read as the mark");
  /* a library/preview sheet (invOwner undefined) never shows marks or the button */
  var preview = csSheetSections(c, undefined);
  assert(preview.indexOf("inv-drop-btn") < 0 && preview.indexOf("inv-x") < 0, "a read-only sheet grew drop controls");
});

test("the render paints a mark on the row it belongs to even after the GM shifted the array", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Lamp", "Rope", "Torch"];
  markInvItem("", 2, null);              /* Torch */
  c.inventory.splice(0, 1);              /* → ["Rope","Torch"]: Torch now at 1 */
  var html = csSheetSections(c, "");
  var torchRow = rowOf(html, "Torch"), ropeRow = rowOf(html, "Rope");
  assert(torchRow && /inv-marked/.test(torchRow), "the shifted mark lost its row");
  assert(ropeRow && !/inv-marked/.test(ropeRow), "the mark painted the row that slid into the old index");
  assert(/Drop 1 item</.test(html), "the count does not follow the resolved plan");
});

// ── companions ───────────────────────────────────────────────────────────────
test("companion sheets share the path: marks keyed by the companion's name, the commit writes its charSheet and reopens its sheet", function () {
  fresh();
  worldState.npcs = [{ name: "Nyla", charSheet: { name: "Nyla", inventory: ["Dagger", "Lute", "Bread"], worn: ["Lute"] } }];
  document.getElementById = function (id) { return id === "npc-modal" ? __stubEl() : null; };
  markInvItem("Nyla", 1, null); markInvItem("Nyla", 2, null);
  assert.equal(invDropCount(marksFor("Nyla")), 2);
  assert.equal(invDropCount(marksFor("")), 0, "a companion mark landed on the hero");
  __saves = 0; __npcShown.length = 0;
  dropMarkedItems("Nyla", null);
  assert.deepEqual(worldState.npcs[0].charSheet.inventory, ["Dagger"]);
  assert.deepEqual(worldState.npcs[0].charSheet.worn, []);
  assert.equal(__saves, 1);
  assert.deepEqual(__npcShown, ["Nyla"], "the companion sheet was not reopened after the drop");
  document.getElementById = function () { return null; };
});

// ── close discards, loudly ───────────────────────────────────────────────────
test("closing the sheet discards pending marks with a toast; silent when there is nothing to discard", function () {
  fresh();
  worldState.character.inventory = ["Lamp", "Rope"];
  markInvItem("", 0, null); markInvItem("", 1, null);
  __toasts.length = 0;
  assert.equal(_invDropDiscard(""), 2);
  assert.equal(invDropCount(marksFor("")), 0, "marks survived the close");
  assert.equal(__toasts.length, 1, "the discard was silent");
  assert(/2 marks cleared/.test(__toasts[0]) && /nothing dropped/.test(__toasts[0]), "toast: " + __toasts[0]);
  assert.deepEqual(worldState.character.inventory, ["Lamp", "Rope"], "the close dropped something");
  assert.equal(_invDropDiscard(""), 0);
  assert.equal(__toasts.length, 1, "a close with nothing pending toasted");
});

test("marks never cross a campaign switch", function () {
  fresh();
  worldState.character.inventory = ["Lamp"];
  markInvItem("", 0, null);
  assert.equal(invDropCount(marksFor("")), 1);
  worldState.campId = "another-campaign";
  assert.equal(invDropCount(marksFor("")), 0, "a mark from the last campaign is still pending");
});

// ── source contracts ─────────────────────────────────────────────────────────
test("source: the per-item drop is dead, the mark and the commit never reach a confirm, both sheet hosts discard on close, the render decides marks through the plan", function () {
  var s = src("ui-sheets.js");
  assert(s.indexOf("function dropInvItem(") < 0, "the per-item confirm path still ships");
  var body = s.slice(s.indexOf("function markInvItem("), s.indexOf("function rejectEpithet("));
  assert(body.length > 0, "markInvItem is not defined before rejectEpithet");
  assert(!/confirm\(/.test(body), "the mark/commit path reaches a confirm");
  assert(/function dropMarkedItems\(/.test(body) && /function _invDropDiscard\(/.test(body), "the commit or the discard is missing");
  var commit = body.slice(body.indexOf("function dropMarkedItems("), body.indexOf("function _invDropDiscard("));
  assert(/invDropPlan\(/.test(commit) && /invDropApply\(/.test(commit), "the commit does not go through the pure plan/apply pair");
  assert(/wornPrune\(cs\)/.test(commit), "the commit does not prune worn (E4)");
  assert(/saveAll\(\)/.test(commit), "the commit does not save");
  var hero = s.slice(s.indexOf("function showCharSheet("), s.indexOf('getElementById("cs-export-btn")'));
  assert(/onClose:function\(\)\{[^}]*_invDropDiscard\(""\)/.test(hero), "the hero sheet's close does not discard the marks");
  var npc = s.slice(s.indexOf("function showNpcSheet("), s.indexOf('getElementById("npc-export-btn")'));
  assert(/onClose:function\(\)\{[^}]*_invDropDiscard\(name\)/.test(npc), "the companion sheet's close does not discard the marks");
  var render = s.slice(s.indexOf('var invRows=""'), s.indexOf("invHtml=(c.outfit"));
  assert(/invDropPlan\(/.test(render), "the render marks rows by raw key instead of the resolved plan");
  assert(/inv-drop-btn/.test(render) && /invDropButtonText\(/.test(render), "the render has no Drop button");
  assert(src("dev/run-standalone-suites.js").indexOf("dev/tests-429-inventory-drop.js") >= 0, "this battery is not registered in run-standalone-suites.js");
});

if (failed) { console.error("#429 inventory drop: " + failed + " FAILED"); process.exit(1); }
console.log("#429 inventory drop: all green");
