// A companion who has the hero's exact name, made by the engine's own doors (no tag):
//   (1) ui-browsers.js _addImportedCompanion ("+ Add <name> as companion to current campaign") — no check against the hero's name;
//   (2) game.js applyBlueprint — a blueprint NPC named like the hero.
// Then: what the person tags do for that companion. DOM stubs follow dev/tests-audit-ui.js.
var fs = require("fs"), path = require("path");
var ROOT = process.argv[2];
var loader = require(ROOT + "/dev/load-engine.js");
var w0 = console.warn, i0 = console.info, d0 = console.debug; console.warn = function () {}; console.info = function () {}; console.debug = function () {};
loader.loadEngine();
function stubEl() { return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", className: "", classList: { add: function () {}, remove: function () {} }, addEventListener: function () {}, setAttribute: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; } }; }
global.window = global; global.navigator = { userAgent: "node" };
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return stubEl(); }, body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } } };
global.confirm = function () { return true; };
var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js", "ui-browsers.js", "ui-modals.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
var toasts = [], sent = [];
geval("addMsg=function(){return {appendChild:function(){},style:{},remove:function(){},textContent:'',innerHTML:'',className:''};};showToast=function(m){__t.push(String(m));};var __t=[];syncUI=function(){};updateInvPanel=function(){};updateAbPanel=function(){};updateSpPanel=function(){};saveAll=function(){};saveCore=function(){};saveMem=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};sendAction=function(t){__s.push(String(t));};var __s=[];");
console.warn = w0; console.info = i0; console.debug = d0;
function quiet(fn) { var oc = console.warn, oi = console.info, od = console.debug; console.warn = function () {}; console.info = function () {}; console.debug = function () {}; try { return fn(); } finally { console.warn = oc; console.info = oi; console.debug = od; } }
function run(text) { return quiet(function () { return applyMuts(text); }); }
function P(l, v) { console.log(l + " " + (typeof v === "string" ? v : JSON.stringify(v))); }
P("version", APP_VERSION);

P("\n-- (1) the hero's own .char imported as a COMPANION (_addImportedCompanion)", "");
loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } }); busy = false; worldState.turn = 9;
var h = worldState.character.name;
var twin = { name: h, gender: "F", ancestry: "Human", cls: "Rogue", level: 3, hp: 12, maxHp: 12, inventory: [], spells: [], abilities: [], conditions: [], relationships: [] };
quiet(function () { _addImportedCompanion(twin); });
P("   toasts", __t.slice(-1)); P("   rows", worldState.npcs.map(function (n) { return n.name + (n.partyMember ? "[party]" : "") + (n.charSheet ? "[sheet]" : ""); })); P("   memory keys", Object.keys(memory.npcs));
P("   companion found by findCompanionChar", !!findCompanionChar(h));
var r = run("She steps back. [PARTY_MEMBER:" + h + "|false]"); P("   [PARTY_MEMBER:" + h + "|false] ->", r.muts); P("   still in the party", worldState.npcs.filter(function (n) { return n.name === h; }).map(function (n) { return !!n.partyMember; }));
r = run("She nods. [NPC_NOTE:" + h + "|kept the watch] [NPC_PRONOUN:" + h + "|she/her] [COMPANION_HP:" + h + "|-3] [NPC_ALIAS:Old Maren|" + h + "]"); P("   note/pronoun/companion hp/alias ->", r.muts);
P("   twin hp", findCompanionChar(h) ? findCompanionChar(h).hp : null); P("   twin events", (memory.npcs[h].events || []).length);

P("\n-- (2) a blueprint NPC with the hero's name (applyBlueprint)", "");
loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } }); worldState.turn = 0; h = worldState.character.name;
var err = null; try { quiet(function () { applyBlueprint({ name: "Probe", npcs: [{ name: h, role: "rival", notes: "wears your face", pronouns: "she/her" }, { name: "Bram", role: "ally", notes: "a smith" }] }); }); } catch (e) { err = e.message; }
P("   applyBlueprint error", err); P("   rows", worldState.npcs.map(function (n) { return n.name; })); P("   memory keys", Object.keys(memory.npcs)); P("   hero-named", Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }));
r = run("[NPC:" + h + "|sneering|rival] [NPC_NOTE:" + h + "|stole the seal]"); P("   tags for the rival ->", r.muts);
