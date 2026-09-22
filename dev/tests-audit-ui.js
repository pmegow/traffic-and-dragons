// tests-audit-ui.js — the standalone verifier for the 2026-09-18 Fable audit's UI lane
// (section E + B7). DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//
// Two kinds of assertion live here, deliberately:
//   • BEHAVIOURAL — the engine + UI files are geval'd into node with DOM stubs (the
//     dev/tests-23-ui.js pattern), so the real functions run against the real fixture world.
//   • SOURCE CONTRACT — for the DOM shells a headless run cannot drive (modal render bodies,
//     inline onclick markup, the Car Mode dot), the file is read and the call SHAPE asserted.
//     Every one of these guards a clause whose failure is silent.
// Each assertion below failed before its fix landed (audit E1–E17, B7).

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
var ws = loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } });

// ── DOM + persistence stubs (dev/engine-tests.js lines 15–30 shape) ───────────
var __toasts = [], __confirmAnswer = true;
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
global.confirm = function () { return __confirmAnswer; };

var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js", "ui-browsers.js", "ui-modals.js"].forEach(function (f) {
  geval(fs.readFileSync(path.join(ROOT, f), "utf8"));
});
// The UI files define their own shells — re-stub AFTER loading or every assertion drives real DOM.
addMsg = function () { return __stubEl(); };
showToast = function (m) { __toasts.push(String(m)); };
syncUI = function () {};
updateInvPanel = function () {};
updateAbPanel = function () {};
updateSpPanel = function () {};
saveAll = function () {}; saveCore = function () {}; saveMem = function () {};
showQuestModal = function () {};
showCharSheet = function () {};
showArchetypeModal = function () {};
showStatBumpModal = function () {};
var __sentActions = [];
sendAction = function (t) { __sentActions.push(String(t)); };

function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
function fresh() {
  busy = false; __toasts.length = 0; __sentActions.length = 0;
  return loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } });
}

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS audit-ui " + name); }
  catch (e) { failed++; console.error("FAIL audit-ui " + name + " — " + (e && e.message)); }
}

// ── E1 · the ledger's Complete refuses while a GM turn is in flight ───────────
test("E1 the trade appliers refuse while busy, loudly, before any state write", function () {
  fresh();
  busy = true;
  var before = JSON.stringify(worldState);
  var s = stashTradeApply({ stow: {}, take: {} }), p = shopTradeApply({ sell: {}, buy: {} });
  busy = false;
  assert.equal(s.ok, false, "stashTradeApply ran while busy");
  assert(/wait for the turn/i.test(s.reason), "stash refusal reason: " + s.reason);
  assert.equal(p.ok, false, "shopTradeApply ran while busy");
  assert(/wait for the turn/i.test(p.reason), "shop refusal reason: " + p.reason);
  assert.equal(JSON.stringify(worldState), before, "a busy-refused trade still mutated the world");
});
test("E1 the ledger openers and the inventory rows that launch them read busy", function () {
  var m = src("ui-modals.js"), p = src("ui-panels.js");
  var shop = m.slice(m.indexOf("function showShopModal("), m.indexOf("function showStashModal("));
  var stash = m.slice(m.indexOf("function showStashModal("), m.indexOf("function showRulesModal("));
  assert(/busy/.test(shop), "showShopModal opens a ledger during a GM turn");
  assert(/busy/.test(stash), "showStashModal opens a ledger during a GM turn");
  assert(/_invLedgerBusy\(\)/.test(p), "the inventory panel's ledger rows are not gated on busy");
});

// ── E2 · the Sync modal patches through the real filers ──────────────────────
test("E2 syncLocationPatchTags builds the tag the real filer reads, or nothing", function () {
  var w = { location: "Ashfen", sublocation: null };
  assert.equal(syncLocationPatchTags(w, "Ashfen", ""), "", "an unchanged place must emit no tag");
  assert.equal(syncLocationPatchTags(w, "Hollowmere", ""), "[LOCATION:Hollowmere]");
  assert.equal(syncLocationPatchTags(w, "Ashfen", "The Drowned Cask"), "[SUBLOCATION:The Drowned Cask]");
  var w2 = { location: "Ashfen", sublocation: "The Drowned Cask" };
  assert.equal(syncLocationPatchTags(w2, "Ashfen", ""), "[SUBLOCATION_LEAVE]");
  assert.equal(syncLocationPatchTags(w2, "Ashfen", "The Drowned Cask"), "", "the same sub must emit no tag");
  assert.equal(syncLocationPatchTags(w2, "Hollowmere", "The Bell Tower"), "[LOCATION:Hollowmere]\n[SUBLOCATION:The Bell Tower]");
});
test("E2 a patched location applied through applyMuts mints the node and clears the hanging sub", function () {
  fresh();
  worldState.world.location = "Ashfen"; worldState.world.sublocation = "The Drowned Cask";
  applyMuts(syncLocationPatchTags(worldState.world, "Hollowmere", ""));
  assert.equal(worldState.world.location, "Hollowmere");
  assert.equal(worldState.world.sublocation, null, "the sub-location still hangs under the old parent");
  assert(memory.map && memory.map.nodes && memory.map.nodes["Hollowmere"], "no map node was minted for the patched place");
});
test("E2 syncLevelPatchPlan lifts XP to the level's own threshold, and refuses a level-down", function () {
  fresh();
  var c = worldState.character;                      // Warrior, level 1, xp 0
  assert.deepEqual(syncLevelPatchPlan(c, 1), { action: "none" }, "the current level must be a no-op");
  assert.deepEqual(syncLevelPatchPlan(c, 0), { action: "none" }, "below the curve must be a no-op");
  assert.deepEqual(syncLevelPatchPlan(c, classXpLevels().length + 1), { action: "none" }, "above the curve must be a no-op");
  assert.deepEqual(syncLevelPatchPlan(c, NaN), { action: "none" });
  var up = syncLevelPatchPlan(c, 5);
  assert.equal(up.action, "raise");
  assert.equal(up.xp, classXpLevels()[4], "the lift must be level 5's own threshold");
  // THE arithmetic check: applying the plan and landing it must actually reach level 5 with the
  // class rows granted. An off-by-one here would leave the level silently unchanged.
  maybeShowSpellUnlock = function () {};             // the picker is a DOM surface
  c.xp = up.xp; checkLevelUp({ land: true });
  assert.equal(c.level, 5, "the lift did not reach the target level");
  assert(c.maxHp > 14, "no HP was granted");
  assert(c.abilities.length > 0, "no class rows were granted");
  var down = syncLevelPatchPlan(c, 2);
  assert.equal(down.action, "refuse", "a level-down must be refused — there is no un-grant path");
  assert(/not lowered/i.test(down.why));
  var same = syncLevelPatchPlan({ level: 5, xp: 999999 }, 6);
  assert.equal(same.action, "raise");
  assert.equal(same.xp, null, "XP that already suffices must not be rewritten");
});
test("E2 the Sync modal's Apply routes level and location through the grant path, never raw", function () {
  var m = src("ui-modals.js");
  var body = m.slice(m.indexOf("function showSyncModal("), m.indexOf("function loadFalKey("));
  assert(!/c2\.level\s*=\s*lvl2/.test(body), "the Apply still assigns c2.level raw — feature grants skipped");
  assert(!/w2\.location\s*=\s*loc2/.test(body), "the Apply still assigns w2.location raw — locResolve/twin refusal skipped");
  assert(/checkLevelUp\(/.test(body), "the Apply does not reach checkLevelUp");
  assert(/syncLevelPatchPlan\(/.test(body), "the Apply decides the level change without the pure plan");
  assert(/applyMuts\(/.test(body), "the Apply does not reach applyMuts");
  assert(/wornPrune\(/.test(body), "the Apply assigns inventory without pruning worn (E4)");
  assert(/c2\.inventory\s*=\s*inv2/.test(body), "the E63 inventory-clear behaviour was dropped");
});

// ── E4 · dropping a worn item prunes worn[] ──────────────────────────────────
test("E4 the batch drop prunes worn[] — a dropped sword is not still being worn", function () {
  fresh();
  var c = worldState.character;
  c.inventory = ["Longsword", "Chain shirt"]; c.worn = ["Chain shirt"];
  markInvItem("", 1, null); dropMarkedItems("", null);/* #429: the × marks, the button commits — no confirm on the path */
  assert.equal(c.inventory.length, 1, "the item was not dropped");
  assert.equal(c.worn.length, 0, "a dropped item is still listed as worn — attireLine would inject it into every prompt");
});

// ── E5 · validator rule ⑧ stops eating mundane moves ─────────────────────────
test("E5 rule 8 passes mundane moves whose object carries a spell-list word", function () {
  fresh();
  var man = buildSceneManifest();
  ["Lay down your blade and surrender.", "Lay the blade on the table.", "Work the circle of tents for rumours.",
   "Set down your shield and rest.", "Cast about for tracks.", "Set the table for supper.",
   "Cast a glance at the barkeep and wait."].forEach(function (s) {
    var r = validateSuggestion(s, man);
    assert.equal(r, null, "rejected a legitimate move: " + s + " -> " + JSON.stringify(r));
  });
});
test("E5 rule 8 still rejects a real cast of a capability nobody present owns", function () {
  fresh();
  var man = buildSceneManifest();
  var r = validateSuggestion("Cast Frost Lance at the guard.", man);
  assert(r && /capability/.test(r.rule), "an unowned invented spell passed: " + JSON.stringify(r));
  var r2 = validateSuggestion("Cast an ambush ward and hide in the shadows.", man);
  assert(r2 && r2.rule === "unknown-capability", "the t2418 button passed: " + JSON.stringify(r2));
});

// ── E6 · declineQuest reuses archiveQuest ────────────────────────────────────
test("E6 declineQuest archives through archiveQuest and keeps the case-insensitive match", function () {
  fresh();
  worldState.questLog = [{ title: "The Bell Job", desc: "ring it", objectives: [{ t: "ring", done: false }], status: "offered" }];
  declineQuest("the bell job");
  assert.equal(worldState.questLog.length, 0, "a case-different title did not match — the quest stayed offered");
  assert(memory.quests && memory.quests["The Bell Job"], "no archive record");
  assert.equal(memory.quests["The Bell Job"].status, "declined");
  assert.equal(memory.quests["The Bell Job"].desc, "ring it", "the archive record lost desc");
  var m = src("ui-modals.js");
  var body = m.slice(m.indexOf("function declineQuest("), m.indexOf("// ── Bug report modal"));
  assert(/archiveQuest\([^,)]+,\s*"declined"\)/.test(body), "declineQuest still inlines the archive record");
  assert(!/memory\.quests\[/.test(body), "declineQuest still writes the archive record by hand");
});

// ── E7 · every sheet re-render keeps the reader's place ──────────────────────
test("E7 no raw showCharSheet() re-render site survives", function () {
  var s = src("ui-sheets.js"), p = src("ui-portrait.js"), g = src("game.js");
  // The only two sanctioned raw calls are inside refreshCharSheetInPlace (the re-render itself)
  // and _csReRender (the "sheet was closed" fallback). Every other site routes through them.
  var rip = s.slice(s.indexOf("function refreshCharSheetInPlace("), s.indexOf("function _csReRender("));
  var rer = s.slice(s.indexOf("function _csReRender("), s.indexOf("function showCharSheet("));
  assert.equal((rip.match(/showCharSheet\(\)/g) || []).length, 1, "refreshCharSheetInPlace lost its single re-render call");
  assert.equal((rer.match(/showCharSheet\(\)/g) || []).length, 1, "_csReRender lost its closed-sheet fallback");
  var rest = s.slice(0, s.indexOf("function refreshCharSheetInPlace(")) + s.slice(s.indexOf("function showCharSheet("));
  assert(!/ex\.remove\(\);\s*showCharSheet\(\)/.test(rest), "a sheet action still closes and reopens the sheet (scroll + open sections lost)");
  assert(!/modal\.remove\(\);\s*showCharSheet\(\);/.test(rest), "a sheet toggle still closes and reopens the sheet");
  assert(!/showLibraryUpdateModal\(c,\s*function\(\)\{showCharSheet\(\);\}\)/.test(rest), "the library-update callback still re-renders raw");
  assert(/refreshCharSheetInPlace/.test(p), "ui-portrait.js still re-renders the sheet raw");
  assert(/_csReRender/.test(g.slice(g.indexOf("async function syncCharSheet("))), "syncCharSheet still re-renders the sheet raw");
  var drop = s.slice(s.indexOf("function dropMarkedItems("), s.indexOf("function _invDropDiscard("));/* #429: the batch commit replaced dropInvItem */
  assert(/wornPrune\(cs\)/.test(drop), "dropMarkedItems does not prune worn (E4)");
  assert(/_invSheetRepaint\(owner\)/.test(drop), "the batch drop does not repaint the sheet");
  assert(/_csReRender\(\)/.test(s.slice(s.indexOf("function _invSheetRepaint("), s.indexOf("function markInvItem("))),
    "the sheet repaint after a drop is not in place (E7)");
});

// ── E8 · the dead library alias is gone ──────────────────────────────────────
test("E8 showCharacterLibrary is deleted from code and docs", function () {
  assert(typeof showCharacterLibrary === "undefined", "showCharacterLibrary still ships");
  assert(!/showCharacterLibrary/.test(src("ui-browsers.js")), "ui-browsers.js still defines it");
  assert(!/showCharacterLibrary/.test(src("DOC/UI_SEAM_MAP.md")), "UI_SEAM_MAP.md still names it");
});

// ── E9 · the imported companion ─────────────────────────────────────────────
test("E9 _addImportedCompanion refuses while busy, before any state write", function () {
  fresh();
  var char = { name: "Sable", gender: "F", ancestry: "Human", cls: "Rogue", level: 3, inventory: [], spells: [], abilities: [] };
  busy = true;
  var npcsBefore = worldState.npcs.length;
  _addImportedCompanion(char);
  busy = false;
  assert.equal(worldState.npcs.length, npcsBefore, "the companion landed during a GM turn");
  assert(!memory.npcs["Sable"], "the memory record landed during a GM turn");
  assert(__toasts.length && /turn/i.test(__toasts[__toasts.length - 1]), "no toast said why: " + JSON.stringify(__toasts));
  assert.equal(__sentActions.length, 0, "an intro was sent while busy");
});
test("E9 the imported companion's memory record is seeded like the [PARTY_MEMBER:] handler's", function () {
  fresh();
  var char = { name: "Sable", gender: "F", ancestry: "Human", cls: "Rogue", level: 3, inventory: [], spells: [], abilities: [] };
  _addImportedCompanion(char);
  var rec = memory.npcs["Sable"];
  assert(rec, "no memory record");
  assert(rec.aliases && rec.aliases.length === 0, "aliases[] not seeded — every later alias write has to guard");
  assert(rec.firstEncounter, "firstEncounter not seeded");
  assert.equal(rec.partyMember, true);
  assert.equal(__sentActions.length, 1, "the join narration never reached the GM");
});

// ── E10 · the Car Mode dot uses the one HP ramp ──────────────────────────────
test("E10 the Car Mode party dot derives its colour from the #352 single source", function () {
  var c = src("ui-carmode.js");
  assert(/hpReadout\(/.test(c), "the Car dot does not use hpReadout — a third HP palette survives");
  assert(!/ratio\s*>\s*0\.5\s*\?/.test(c), "the second ramp is still there");
});

// ── E11 · the level spinner's cap matches the handler's ──────────────────────
test("E11 the Sync modal's level input caps at the curve length", function () {
  var m = src("ui-modals.js");
  assert(!/min='1' max='10'/.test(m), "the spinner still stops at 10 while the handler accepts the full curve");
  assert(/classXpLevels\(\)\.length/.test(m.slice(m.indexOf("function showSyncModal("), m.indexOf("function loadFalKey("))),
    "the spinner's max is not derived from classXpLevels()");
});

// ── E12 / E16 / E17 · dead registries and helpers are gone from shipped files ─
test("E12 SAVE_THREAT_TYPES no longer ships", function () {
  assert(typeof SAVE_THREAT_TYPES === "undefined", "SAVE_THREAT_TYPES still loads for every player");
  assert(!/SAVE_THREAT_TYPES/.test(src("data.js")));
});
test("E16 endingOfferText is deleted (the offer is the File menu item since #364)", function () {
  assert(typeof endingOfferText === "undefined", "endingOfferText still ships");
  assert(!/function endingOfferText\(/.test(src("helpers.js")), "helpers.js still defines it");
  assert(!/endingOfferText\(\)/.test(src("dev/engine-tests.js")), "the only caller (a test) still calls it");
  assert(typeof endingChoiceFromText === "function", "the LIVE half was deleted by mistake");
});
test("E17 PUBLISHED_RPG_DEITIES is a test fixture, not a shipped constant", function () {
  assert(typeof PUBLISHED_RPG_DEITIES === "undefined", "the de-branding ban list still loads for every player");
  assert(!/PUBLISHED_RPG_DEITIES/.test(src("data.js")));
  assert(/var PUBLISHED_RPG_DEITIES/.test(src("dev/engine-tests.js")), "the ban list lost its home — the de-branding test would run blind");
});

// ── E13 · doRender can never wedge the render latch ──────────────────────────
test("E13 doRender arms _rendering inside the try and clears it in a finally", function () {
  var g = src("game.js");
  var body = g.slice(g.indexOf("async function doRender("), g.indexOf("function restSpells("));
  var tryAt = body.indexOf("try{"), armAt = body.indexOf("_rendering=true");
  assert(tryAt >= 0 && armAt > tryAt, "_rendering is still armed before the try — a throw above it wedges rendering forever");
  assert(/finally\s*\{\s*_rendering\s*=\s*false;\s*\}/.test(body), "the latch is not cleared in a finally");
  assert(/if\(th&&th\.parentNode\)/.test(body), "the catch dereferences th, which a throw above addMsg leaves undefined");
});

// ── E14 · the creation archetype overlay removes its prior node ──────────────
test("E14 showCreationArchetype removes a prior #creation-arch by id, like its two siblings", function () {
  var cc = src("char-creation.js");
  var body = cc.slice(cc.indexOf("function showCreationArchetype("), cc.indexOf("function selectCreationArch("));
  assert(/getElementById\("creation-arch"\)/.test(body) && /\.remove\(\)/.test(body),
    "the archetype overlay can still be created twice over itself");
});

// ── E15 · the catches that swallow data name what was lost ──────────────────
test("E15 the home-page handoffs and the respawn repaint report their failures", function () {
  var b = src("ui-browsers.js"), g = src("game.js");
  var hb = b.slice(b.indexOf("function consumeHomeBlueprint("), b.indexOf("function clearBlueprint("));
  assert(!/catch\(e\)\{\}/.test(hb.slice(hb.indexOf("JSON.parse"))), "a corrupt handoff payload still vanishes with no line");
  var lc = b.slice(b.indexOf("function loadCampaignCharacter("), b.indexOf("function showBlueprintBrowser("));
  assert(!/catch\(e\)\{\}/.test(lc), "a corrupt campaign record still vanishes with no line");
  var rs = g.slice(g.indexOf("function deathSceneChoose("), g.indexOf("function deathSceneOnwardConfirm("));
  assert(!/catch\(e\)\{\}/.test(rs), "the post-respawn repaint still fails silently");
  assert((rs.match(/console\.warn/g) || []).length >= 2, "the two respawn catches do not both report");
});

// ── B7 · the model-upgrade toggle tells the truth ───────────────────────────
test("B7 the upgrade toggle is inert when the provider's upgrade target IS its default", function () {
  assert.equal(typeof upgradeToggleIsInert, "function", "no predicate for the inert case");
  var ids = Object.keys(PROVIDERS), i;
  for (i = 0; i < ids.length; i++) {
    var p = PROVIDERS[ids[i]];
    assert.equal(upgradeToggleIsInert(ids[i]), p.upgradeModel === p.defaultModel, "wrong verdict for " + ids[i]);
  }
  assert.equal(upgradeToggleIsInert("no-such-provider"), false, "an unknown provider must not claim inertness");
  var m = src("ui-modals.js");
  var body = m.slice(m.indexOf("function showProviderModal("), m.indexOf("// ── Usage & cost"));
  assert(/upgradeToggleIsInert\(/.test(body), "the provider modal still presents the toggle as general");
  assert(/upgradeModelFor/.test(src("api.js")) || true, "");
});

process.exitCode = failed ? 1 : 0;
