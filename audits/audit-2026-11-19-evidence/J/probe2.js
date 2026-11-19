// Lane J probe 2 — the model faucet: generateNpcSheet keeps model alignment / spell lvl verbatim; showNpcSheet paints them raw.
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
var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js", "ui-character-voice.js", "ui-modals.js"].forEach(function (f) {
  geval(fs.readFileSync(path.join(ROOT, f), "utf8"));
});
var toasts = [], shells = {};
showToast = function (m) { toasts.push(String(m)); };
saveAll = function () {}; saveCore = function () {};
showLoadingModal = function () { return function () {}; };
modalShell = function (id, html) { shells[id] = html; var e = stubEl(); e.firstChild = stubEl(); return e; };
if (typeof storageAdapter === "undefined") global.storageAdapter = {};
storageAdapter.isServerMode = function () { return false; };
worldState.npcs = worldState.npcs || [];
worldState.npcs.push({ name: "Mira", status: "alive", rel: "friendly", met: 3, partyMember: true });
var A = "<img src=a onerror=alert(5)>", L = "<svg onload=alert(6)>";
callGM = async function () {
  return JSON.stringify({ gender: "F", age: "30", appear: "x", ancestry: "Human", cls: "Rogue", stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hp: 10, maxHp: 10, gold: 1, level: 1, xp: 0, statedAlignment: "N", actualAlignment: A,
    abilities: [], spells: [{ nm: "Spark", lvl: L, used: false }], inventory: ["Rope"], languages: [{ name: "Common", broken: false }] });
};
(async function () {
  busy = false;
  await generateNpcSheet("Mira");
  var s = wsNpcByName("Mira").charSheet;
  console.log("toasts:", JSON.stringify(toasts));
  console.log("stored actualAlignment:", s && s.actualAlignment);
  console.log("stored spell lvl:", s && s.spells && s.spells[0] && s.spells[0].lvl);
  try { showNpcSheet("Mira"); } catch (e) { console.log("showNpcSheet threw", e.message); }
  var h = shells["npc-modal"] || "";
  console.log("npc sheet raw alignment:", h.indexOf(A) >= 0);
  console.log("npc sheet raw spell lvl:", h.indexOf("[" + L + "]") >= 0);
  // the side panel spells for the same sheet if it held the spotlight
  var c = { spells: [{ nm: "Spark", lvl: L }], name: "x" };
  activePlayer = function () { return c; };
  var spList = stubEl(); document.getElementById = function (id) { return id === "sp-list" ? spList : stubEl(); };
  updateSpPanel();
  console.log("spell panel raw lvl:", spList.innerHTML.indexOf("[" + L + "]") >= 0);
})();
