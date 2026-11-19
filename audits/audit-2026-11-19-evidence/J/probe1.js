// Lane J probe 1 — read-only; loads the engine + sheet/panel/modal UI files with DOM stubs (tests-429 pattern).
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons";
var loader = require(ROOT + "/dev/load-engine.js");
loader.loadEngine();
loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } });
function stubEl() {
  return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", firstChild: null,
    className: "", classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    addEventListener: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
}
global.window = global; global.navigator = { userAgent: "node" };
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, createElement: function () { return stubEl(); }, head: stubEl(),
  body: { appendChild: function () {}, contains: function () { return true; }, classList: { add: function () {}, remove: function () {}, toggle: function () {} } } };
global.confirm = function () { return true; };
var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js", "ui-character-voice.js", "ui-modals.js"].forEach(function (f) {
  geval(fs.readFileSync(path.join(ROOT, f), "utf8"));
});
var toasts = [], saves = 0, shells = {};
showToast = function (m) { toasts.push(String(m)); };
saveAll = function () { saves++; }; saveCore = function () {};
updateInvPanel = function () {};
modalShell = function (id, html) { shells[id] = html; var e = stubEl(); e.firstChild = stubEl(); return e; };
if (typeof storageAdapter === "undefined") global.storageAdapter = {};
storageAdapter.isServerMode = function () { return false; };
var out = [];
function say(k, v) { out.push(k + ": " + v); }

// ── 1. showReadOnlyCharSheet (the library/import preview) ───────────────────
var hero = worldState.character;
hero.inventory = invRows ? hero.inventory : hero.inventory;
var X = "<img src=x onerror=alert(1)>";
var snap = JSON.parse(JSON.stringify(hero));
snap.name = "Snapshot Hero"; snap.age = X; snap.deity = X + "d"; snap.actualAlignment = X + "a";
snap.stats = { STR: X + "s", DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
snap.aliases = ["The Bold"];
showReadOnlyCharSheet(snap, {});
var h = shells["ro-cs-modal"] || "";
say("ro-sheet raw age img", h.indexOf(X) >= 0);
say("ro-sheet raw deity", h.indexOf(X + "d") >= 0);
say("ro-sheet raw alignment", h.indexOf(X + "a") >= 0);
say("ro-sheet raw stat", h.indexOf(X + "s") >= 0);
say("ro-sheet inv-x buttons (should be 0 for read-only)", (h.match(/class="inv-x"/g) || []).length);
say("ro-sheet inv-x data-own values", JSON.stringify((h.match(/class="inv-x" data-own="[^"]*"/g) || []).slice(0, 2)));
say("ro-sheet epithet x buttons", (h.match(/class="epi-x"/g) || []).length);
say("csSheetSections(c,undefined) inv-x", (csSheetSections(snap, undefined, true).match(/class="inv-x"/g) || []).length);

// ── 2. that × acts on the LIVE hero ──────────────────────────────────────────
var heroFirst = invEntryName(hero.inventory, 0);
_invDropMarks.camp = null; _invDropMarks.by = {};
_csReRender = function () { return true; };
markInvItem("", 0, null, heroFirst);  // what the snapshot's first × sends when the snapshot carries the same item
say("hero first item", heroFirst);
say("hero marks after a click in the read-only preview", JSON.stringify(_invDropMarks.by[""]));
var aliasesBefore = (hero.aliases || []).slice(); hero.aliases = ["Hero's Own Epithet"];
rejectEpithet("", "0", null);
say("hero aliases after the preview's epithet ×", JSON.stringify(hero.aliases));

// ── 3. NPC sheet: the hero's name as an unescaped csKv key ─────────────────
worldState.npcs = worldState.npcs || [];
worldState.npcs.push({ name: "Mira", status: "alive", rel: "friendly", met: 3, partyMember: false });
var npc = worldState.npcs[worldState.npcs.length - 1];
say("npc", npc && npc.name);
hero.name = "<img src=y onerror=alert(2)>";
if (typeof relationshipSet === "function") { try { relationshipSet(hero, npc.name, { bond: "sworn friend" }); } catch (e) { say("relSet err", e.message); } }
if (!relationshipFind(hero, npc.name, null)) { hero.relationships = hero.relationships || []; hero.relationships.push({ name: npc.name, entity: npc.name, bond: "sworn friend" }); }
say("relationshipFind bond", JSON.stringify(relationshipFind(hero, npc.name, null)));
try { showNpcSheet(npc.name); } catch (e) { say("showNpcSheet threw", e.message); }
var nh = shells["npc-modal"] || "";
say("npc sheet raw hero-name key", nh.indexOf("Bond from <img src=y") >= 0);

// ── 4. usage modal: imported usage.byKind key/value ─────────────────────────
worldState.usage = blankUsage();
worldState.usage.byKind["<svg onload=alert(3)>"] = { calls: "<b>9</b>", in: 1, out: 1, cacheRead: 0, cacheWrite: 0, costUSD: 0 };
closeAllMenus = function () {};
try { showUsageModal(); } catch (e) { say("usage threw", e.message); }
var uh = shells["usage-modal"] || "";
say("usage raw kind label", uh.indexOf("<svg onload=alert(3)>") >= 0);
say("usage raw calls string", uh.indexOf("<b>9</b>") >= 0);

// ── 5. the custom rules list ────────────────────────────────────────────────
customRules = ["<img src=z onerror=alert(4)>"];
saveRules = function () {};
var rulesInner = stubEl(); var rulesModal = stubEl(); rulesModal.firstChild = rulesInner;
modalShell = function (id, html) { shells[id] = html; return rulesModal; };
document.getElementById = function (id) { return stubEl(); };
try { showRulesModal(); } catch (e) { say("rules threw", e.message); }
say("rules raw custom rule", rulesInner.innerHTML.indexOf("<img src=z onerror=alert(4)>") >= 0);
console.log(out.join("\n"));
