// dev/tests-777-small.js — audit 2026-11-19 (TODO #777), the small reproduced rows of sections C and D:
// C7 a row field named __proto__ · C8 a place merged into its own child · C11 lookup tables and inherited names ·
// D4 the designer's review merge and inherited section names.
//   node dev/tests-777-small.js             every case
//   node dev/tests-777-small.js --only C8   the cases whose name contains the text
var assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
var LE = require("./load-engine.js"), realLog = console.log, realErr = console.error, warns = [];
console.warn = function () { warns.push([].join.call(arguments, " ")); }; console.info = console.log = console.debug = function () {};
LE.loadEngine("game.js");
var ROOT = path.join(__dirname, "..");
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }
function fresh() { var ws = LE.makeTestWorld({}); migrateWorldState(ws); worldState = ws; warns.length = 0; return ws; }

kase("C11: a lookup table answers only for its own words — an inherited name is no entry", function () {
  assert.strictEqual(sayMoodSteer("constructor"), "", "an inherited property name passed the mood allow-list");
  assert.strictEqual(sayMoodSteer("toString"), ""); assert.strictEqual(sayMoodSteer("hasOwnProperty"), "");
  assert.strictEqual(sayMoodSteer("warmly"), "warmly", "a listed feeling no longer passes");
  assert.strictEqual(voiceAgeLabel("constructor"), "Constructor", "an inherited property was returned as an age label: " + String(voiceAgeLabel("constructor")).slice(0, 40));
  assert.strictEqual(voiceAgeLabel("young"), "Young"); assert.strictEqual(voiceAgeLabel("middle_aged"), "Middle-aged"); assert.strictEqual(voiceAgeLabel("ancient"), "Ancient");
});

kase("C7: a row field named __proto__ rides a move like any other field, and the row keeps its prototype", function () {
  var extras = JSON.parse('{"__proto__":{"evil":1},"note":"etched"}'), rows = [];
  var r = invAdd(rows, "Odd key", 1, extras);
  assert.ok(r.ok, r.reason);
  assert.strictEqual(Object.getPrototypeOf(r.row), Object.prototype, "the row's prototype was replaced by the field's value");
  assert.ok(Object.prototype.hasOwnProperty.call(r.row, "__proto__") && r.row.note === "etched", "the field was lost in the move: " + JSON.stringify(Object.keys(r.row)));
  assert.strictEqual(r.row.evil, undefined, "the field's value became the row's inheritance");
  var plain = [{ name: "Brass ring", qty: 1, equipped: false }], c = invCarryFields(plain, "Brass ring", JSON.parse('{"name":"Brass ring","qty":1,"__proto__":{"evil":1},"note":"x"}'), 1);
  assert.ok(c.ok, c.reason);
  assert.strictEqual(Object.getPrototypeOf(c.row), Object.prototype, "carrying fields onto a row replaced its prototype");
  assert.ok(Object.prototype.hasOwnProperty.call(c.row, "__proto__") && c.row.note === "x");
});

kase("C8: a place cannot be merged into its own child", function () {
  fresh(); memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes["Town"] = newMapNode(1, null); memory.map.nodes["Town|Inn"] = newMapNode(1, "Town"); memory.map.nodes["Town|Inn|Cellar"] = newMapNode(1, "Town|Inn");
  worldState.world.location = "Town";
  var R = { muts: [], turn: 5 };
  assert.strictEqual(locMerge("Town|Inn", "Town", R), false, "a place was merged into its own child");
  assert.strictEqual(locMerge("Town|Inn|Cellar", "Town", { muts: [], turn: 5 }), false, "a place was merged into its own grandchild");
  assert.ok(memory.map.nodes["Town"] && memory.map.nodes["Town|Inn"].parent === "Town", "the map was changed by the refused merge");
  assert.ok(R.muts.some(function (m) { return /merge refused/.test(m); }), "the refusal was not said: " + JSON.stringify(R.muts));
  Object.keys(memory.map.nodes).forEach(function (k) { assert.notStrictEqual(locResolve(memory.map.nodes[k].parent || ""), locResolve(k), k + " is its own parent"); });
  memory.map.nodes["Hamlet"] = newMapNode(1, null);
  assert.strictEqual(locMerge("Town", "Hamlet", { muts: [], turn: 5 }), true, "an ordinary merge is refused");
});

kase("D4: the designer's review merge knows only its own section names — an inherited one is an unknown section", function () {
  var page = fs.readFileSync(path.join(ROOT, "blueprint-designer.html"), "utf8");
  var ctx = { DesignerCreatures: require("../designer-creatures.js"), DesignerActs: require("../designer-acts.js"), console: console }; vm.createContext(ctx);
  vm.runInContext(page.slice(page.indexOf("var _PATCH_PRESERVE="), page.indexOf("async function applyFinding(")), ctx);
  var bp = normalizeBlueprint({ format: "tnd-blueprint-v1", name: "B", premise: "p", acts: [{ title: "Act 1", goal: "g", arcs: [{ title: "a", objective: "o" }] }], npcs: [], locations: [], creatures: [] });
  ["constructor", "toString", "hasOwnProperty", "__proto__"].forEach(function (sec) {
    var before = JSON.stringify(bp), threw = null;
    try { ctx.applyPatches(bp, [{ section: sec, name: "X", item: { name: "X" }, value: "v" }], {}); } catch (e) { threw = e; }
    assert.ok(threw, "a patch for the section \"" + sec + "\" was applied");
    assert.strictEqual(JSON.stringify(bp), before, "a refused patch changed the blueprint");
    assert.ok(!Object.prototype.hasOwnProperty.call(bp, sec) || sec === "__proto__", "the blueprint gained a \"" + sec + "\" field");
  });
  ctx.applyPatches(bp, [{ section: "npcs", name: "Bram", item: { name: "Bram", role: "ally" } }], {});
  assert.strictEqual(bp.npcs.length, 1, "an ordinary patch no longer applies");
  ctx.applyPatches(bp, [{ section: "premise", item: "A new premise." }], {});
  assert.strictEqual(bp.premise, "A new premise.");
});

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
todo.forEach(function (c) {
  try { c.fn(); passed++; realLog.call(console, "PASS #777 " + c.name); }
  catch (e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 3).join("\n    ")); }
});
if (failed) { realErr.call(console, "#777 small: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
realLog.call(console, "ALL GREEN — " + passed + " #777 small cases");
