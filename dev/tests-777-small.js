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
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

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
// ── batch 2 (2026-11-20): C10 the item-section store is bounded · C12 the coin scan is bounded · C16 four small items ──
kase("C10: the item-section store is bounded — the oldest records of things nobody carries are let go, and what is carried is never asked again", function () {
  var ws = fresh(), i, cap = ITEM_KIND_STORE_CAP;
  assert.ok(cap >= 100, "no bound is declared");
  ws.itemKinds = keyedDict();
  for (i = 0; i < cap + 50; i++) ws.itemKinds["old thing " + i] = { kind: "mundane", turn: i };
  ws.character.inventory = invRows(["old thing 0", "old thing 1"]).rows || ws.character.inventory;
  invHealSheet(ws.character);
  assert.ok(invHolds(ws.character.inventory, "old thing 0"), "fixture: the hero does not carry the oldest thing");
  var dropped = itemKindsTrim(ws);
  assert.strictEqual(Object.keys(ws.itemKinds).length, cap, "the store is not held at its bound: " + Object.keys(ws.itemKinds).length);
  assert.strictEqual(dropped, 50);
  assert.ok(ws.itemKinds["old thing 0"] && ws.itemKinds["old thing 1"], "a record of something the hero carries was dropped — it would be asked (and billed) again");
  assert.ok(!ws.itemKinds["old thing 2"] && ws.itemKinds["old thing " + (cap + 49)], "the oldest records were not the ones let go");
  assert.ok(warns.some(function (w) { return /item-section record/.test(w) && /50/.test(w); }), "letting records go is not said: " + JSON.stringify(warns));
  assert.strictEqual(itemKindsTrim(ws), 0, "a store at its bound was trimmed again");
  // the two doors: the load, and the turn that files a new answer
  ws.itemKinds["one more"] = { kind: "tool", turn: 9999 }; migrateWorldState(ws);
  assert.strictEqual(Object.keys(ws.itemKinds).length, cap, "the load does not hold the store at its bound");
  var s = src("item-kinds.js"), at = s.indexOf("async function itemKindsSettle"), body = s.slice(at, s.indexOf("\n}", at));
  assert.ok(/itemKindsTrim\(ws\)/.test(body), "a turn that files answers never trims the store");
});
kase("C12: the coin scan stays fast on a long run of number words, and still reads the amounts of an ordinary reply", function () {
  var run = new Array(9144).join("twenty "), t0 = Date.now(), r = coinNarrationAmounts(run), ms = Date.now() - t0;
  assert.ok(ms < 1500, "64 KB of number words took " + ms + " ms (the scan runs on every reply)");
  assert.deepStrictEqual(r.amounts, []);
  r = coinNarrationAmounts("You count out twenty gold pieces and pocket 5 sp.");
  assert.deepStrictEqual(r.amounts.map(function (a) { return a.text; }), ["20 gp", "5 sp"], "an ordinary reply is read differently: " + JSON.stringify(r.amounts));
  var long = new Array(COIN_NARRATION_SCAN_MAX + 200).join("x") + " You hand over 30 gold.";
  warns.length = 0; console.info = function () { warns.push([].join.call(arguments, " ")); };
  r = coinNarrationAmounts(long); console.info = function () {};
  assert.deepStrictEqual(r.amounts, [], "text past the bound was scanned");
  assert.ok(warns.some(function (w) { return /coin/.test(w) && /not scanned|only the first/.test(w); }), "a reply cut for the scan is not said: " + JSON.stringify(warns));
});
kase("C16: a button may not name a blueprint place the story has not shown; one the story has named passes", function () {
  var ws = fresh();
  memory.map.nodes["The Drowned Archive"] = newMapNode(null, null, { description: "a flooded library", blueprintSeeded: true });
  var man = buildSceneManifest();
  var v = validateSuggestion("Seek the Drowned Archive.", man);
  assert.ok(v && v.rule === "unintroduced-place", "a button naming a place only the outline knows passed: " + JSON.stringify(v));
  var v2 = validateSuggestion("Search the archive shelves.", man);
  assert.ok(!(v2 && v2.rule === "unintroduced-place"), "a common word was read as the outline's place: " + JSON.stringify(v2));
  ws.transcript.push({ t: ws.turn, r: "gm", x: "The ferryman speaks of the Drowned Archive, beyond the weir." });
  if (typeof invalidateTranscriptMemo === "function") invalidateTranscriptMemo();
  v = validateSuggestion("Seek the Drowned Archive.", man);
  assert.ok(!(v && v.rule === "unintroduced-place"), "a place the story has named is still held back: " + JSON.stringify(v));
  memory.map.nodes["The Salt Stair"] = newMapNode(3, null, { blueprintSeeded: true }); memory.map.nodes["The Salt Stair"].visits = 1;
  v = validateSuggestion("Climb the Salt Stair.", man);
  assert.ok(!(v && v.rule === "unintroduced-place"), "a visited place is held back");
});
kase("C16: the painter is never told the hero is \"undefined\"", function () {
  var ws = fresh(), c = ws.character; delete c.age; delete c.appear;
  var req = buildSceneRenderRequest(c, [], ws.world, {}), text = JSON.stringify(req);
  assert.ok(text.indexOf("undefined") < 0, "the render request says undefined: " + text.slice(0, 400));
  assert.ok(text.indexOf(c.name) >= 0, "fixture: the hero is not in the request");
  c.age = "early twenties"; c.appear = "a scar across the brow";
  text = JSON.stringify(buildSceneRenderRequest(c, [], ws.world, {}));
  assert.ok(/early twenties/.test(text) && /a scar across the brow/.test(text), "a hero with an age and a look lost them");
});
kase("C16: a blueprint is applied from a copy — the file's own acts and creatures are not written into or shared", function () {
  var ws = fresh(), bp = { name: "Test", premise: "A test.", acts: [{ title: "Act One", arcs: [{ title: "Arc A" }] }, { title: "Act Two", arcs: [{ title: "Arc B" }] }], creatures: [{ name: "Marsh Wight", description: "pale" }] };
  var before = JSON.stringify(bp);
  applyBlueprint(bp);
  assert.strictEqual(JSON.stringify(bp), before, "applying a blueprint wrote into the file's own object: " + JSON.stringify(bp).slice(0, 300));
  assert.ok(worldState.skeleton && worldState.skeleton.acts[0].status === "active", "fixture: the skeleton was not installed");
  assert.notStrictEqual(worldState.skeleton.acts, bp.acts, "the campaign shares the file's act list");
  assert.notStrictEqual(worldState.bestiary, bp.creatures, "the campaign shares the file's creature list");
  worldState.bestiary[0].name = "changed in play";
  assert.strictEqual(bp.creatures[0].name, "Marsh Wight", "a change in play reached the file's own creature");
});
kase("C16: the prompt of Death's arrival says Death has just arrived — until the arrival is in the book", function () {
  var ws = fresh();
  ws.deathScene = { walk: 1, cause: "slain", stage: "question", arrivalOwed: true };
  assert.ok(/Death has just arrived/.test(buildDeathSceneBlock()), "the arrival's own prompt lacks its arrival line (the stage has already moved on when it is built)");
  delete ws.deathScene.arrivalOwed;
  assert.ok(!/Death has just arrived/.test(buildDeathSceneBlock()), "the arrival line is sent after the arrival");
});

var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
todo.forEach(function (c) {
  try { c.fn(); passed++; realLog.call(console, "PASS #777 " + c.name); }
  catch (e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 3).join("\n    ")); }
});
if (failed) { realErr.call(console, "#777 small: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
realLog.call(console, "ALL GREEN — " + passed + " #777 small cases");
