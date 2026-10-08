// REVIEW PROBE LIBRARY 2 (read-only on the trees): the FULL engine (every file of dev/engine-manifest.js, tts.js included, so the
// real [SAY:] speaker pipeline runs) with the same display stubs dev/engine-tests.js uses for commitGmTurn.
// argv[2] = tree. Exposes the same helpers as lib.js plus turn(text, opts) = one real commitGmTurn.
var WT = process.argv[2];
var l = require(WT + "/dev/load-engine.js");
var _ow = console.warn, _oi = console.info, _od = console.debug, _ol = console.log, _oe = console.error;
console.warn = function () { }; console.info = function () { }; console.debug = function () { };
l.loadEngine();
console.warn = _ow; console.info = _oi; console.debug = _od;
var geval = eval;
geval("var __toasts=[];function __stubEl(){return {appendChild:function(){},style:{},remove:function(){},textContent:'',innerHTML:'',className:''};}" +
  "addMsg=function(){return __stubEl();};showToast=function(m){__toasts.push(String(m));};syncUI=function(){};updateAbPanel=function(){};updateSpPanel=function(){};updateInvPanel=function(){};" +
  "showArchetypeModal=function(){};showStatBumpModal=function(){};saveAll=function(){};saveCore=function(){};saveMem=function(){};saveLocal=function(){};" +
  "generateActions=function(){};processPendingCompanionSheets=function(){};speakNarration=function(){};checkLegacyCharacter=function(){};" +
  "showItemDefConfirmModal=function(){};showRewardClaimModal=function(){};audioScenePublish=function(){};audioFileCandidates=function(){};takeCheckpoint=function(){};updateCampMeta=function(){};bondToast=function(){};" +
  "if(typeof storageAdapter==='undefined')storageAdapter={syncToServer:function(){},syncNow:function(){}};");
global.makeWorld = function () { l.makeTestWorld(); __toasts.length = 0; return worldState; };
global.quiet = function (fn) { var warns = [], oc = console.warn, oi = console.info, od = console.debug, oe = console.error; console.warn = function (m) { warns.push("W " + String(m)); }; console.info = function (m) { warns.push("I " + String(m)); }; console.debug = function () { }; console.error = function (m) { warns.push("E " + String(m)); }; try { return { r: fn(), warns: warns }; } finally { console.warn = oc; console.info = oi; console.debug = od; console.error = oe; } };
global.addComp = function (name, inv, extra) { var cs = { name: name, inventory: inv || [] }; if (extra) Object.keys(extra).forEach(function (k) { cs[k] = extra[k]; }); worldState.npcs.push({ name: name, status: "ally", rel: "companion", partyMember: true, charSheet: cs }); return cs; };

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var _realRandom = Math.random, _realNow = Date.now;
function seed(n) { Math.random = mulberry32(n || 12345); Date.now = function () { return 1790000000000; }; }
function unseed() { Math.random = _realRandom; Date.now = _realNow; }

var WATCH = [];
function watch(label, obj) { if (obj == null || (typeof obj !== "object" && typeof obj !== "function")) return; for (var i = 0; i < WATCH.length; i++) if (WATCH[i].obj === obj) return; var names = Object.getOwnPropertyNames(obj), vals = {}; names.forEach(function (n) { vals[n] = Object.getOwnPropertyDescriptor(obj, n); }); WATCH.push({ label: label, obj: obj, names: names, descs: vals }); }
[["Object", Object], ["Object.prototype", Object.prototype], ["Function.prototype", Function.prototype], ["Array.prototype", Array.prototype], ["String.prototype", String.prototype], ["Number.prototype", Number.prototype], ["Boolean.prototype", Boolean.prototype], ["RegExp.prototype", RegExp.prototype], ["Date.prototype", Date.prototype], ["Error.prototype", Error.prototype], ["Array", Array], ["String", String], ["Function", Function], ["Number", Number], ["JSON", JSON]].forEach(function (p) { watch(p[0], p[1]); });
Object.getOwnPropertyNames(Object.prototype).forEach(function (n) { var d = Object.getOwnPropertyDescriptor(Object.prototype, n); if (d && typeof d.value === "function") watch("Object.prototype." + n + "(fn)", d.value); if (d && typeof d.get === "function") watch("Object.prototype." + n + "(getter)", d.get); if (d && typeof d.set === "function") watch("Object.prototype." + n + "(setter)", d.set); });
function short(v) { var s; try { s = typeof v === "function" ? "function " + (v.name || "") : JSON.stringify(v); } catch (e) { s = String(v); } return String(s).slice(0, 80); }
function poison() {
  var out = [];
  WATCH.forEach(function (w) {
    var now = Object.getOwnPropertyNames(w.obj);
    now.forEach(function (n) {
      if (w.names.indexOf(n) < 0) { var v; try { v = w.obj[n]; } catch (e) { v = "?"; } out.push(w.label + "." + n + "=" + short(v)); try { delete w.obj[n]; } catch (e2) { } return; }
      var d0 = w.descs[n], d1 = Object.getOwnPropertyDescriptor(w.obj, n);
      if (d0 && d1 && ("value" in d0) && ("value" in d1) && !Object.is(d0.value, d1.value)) { out.push(w.label + "." + n + " OVERWRITTEN=" + short(d1.value)); try { Object.defineProperty(w.obj, n, d0); } catch (e3) { } }
    });
    w.names.forEach(function (n) { if (now.indexOf(n) < 0) { out.push(w.label + "." + n + " DELETED"); try { Object.defineProperty(w.obj, n, w.descs[n]); } catch (e4) { } } });
  });
  return out;
}
function world(mode) {
  makeWorld(); delete worldState.kind; worldState.turn = 9;
  worldState.npcs.push({ name: "Bram", status: "", rel: "ally", met: 1, partyMember: false, aliases: [], pronouns: "he/him" });
  memory.npcs.Bram = { attitude: "", knowledge: ["keeps the forge"], events: [{ turn: 3, note: "shod a mare" }], aliases: [] };
  addComp("Kira", ["Dagger", "Rope"], { hp: 10, maxHp: 10, level: 1, xp: 0, cls: "Rogue", gender: "F", stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 }, skills: initSkills(), spells: [{ nm: "Mage Hand (invisible)", lvl: 0, used: false }, { nm: "Charm Person (1 hour)", lvl: 1, used: false }], abilities: [], conditions: [], relationships: [], saveModifiers: [], languages: [{ name: "Common", broken: false }], coreMemories: [], storyBeats: [], alignLaw: 0, alignGood: 0, actualAlignment: "True Neutral", flaw: "reckless", trait: "wry" });
  memory.npcs.Kira = { attitude: "", knowledge: [], events: [], aliases: [], partyMember: true };
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes["Ashfen"] = newMapNode(1, null); memory.map.nodes["Ashfen"].visits = 2;
  if (!memory.locations) memory.locations = {};
  memory.locations["Ashfen"] = { visited: [1], notes: [] };
  worldState.questLog.push({ title: "Find the bell", status: "active", desc: "", objectives: [{ text: "ask the smith", done: false }], started: 1, lastTouch: 1 });
  worldState.character.gold = 50;
  if (mode === "combat") worldState.combat = { round: 1, engaged: null, foes: [{ name: "Goblin", hp: 8, maxHp: 8, ac: 12, atk: 3, dmg: "1d6", morale: "steady" }], node: "Ashfen" };
  if (mode === "refs") { quiet(function () { try { buildSysPrompt(); } catch (e) { } }); if (!worldState.sceneRefs && typeof sceneRefsEnsure === "function") sceneRefsEnsure(); }
  sessionLog = [];
  return worldState;
}
var RES = Object.create(null); Object.getOwnPropertyNames(Object.prototype).forEach(function (n) { RES[n] = 1; });
function scanState() {
  var out = [], seen = new WeakSet();
  function walk(v, path, depth) {
    if (v === null || depth > 30) return;
    if (typeof v === "function") { out.push("FUNCTION value at " + path + " (" + (v.name || "anon") + ")"); return; }
    if (typeof v !== "object") return;
    if (seen.has(v)) return; seen.add(v);
    var pr = Object.getPrototypeOf(v);
    if (Array.isArray(v)) { if (pr !== Array.prototype) out.push("ARRAY with odd prototype at " + path); for (var i = 0; i < v.length; i++) walk(v[i], path + "[" + i + "]", depth + 1); return; }
    if (pr !== Object.prototype && pr !== null) out.push("OBJECT with swapped prototype at " + path);
    Object.getOwnPropertyNames(v).forEach(function (k) { if (RES[k]) out.push("own key '" + k + "' at " + path); if (k === "portrait") return; var d = Object.getOwnPropertyDescriptor(v, k); if (d && "value" in d) walk(d.value, path + "." + k, depth + 1); });
  }
  walk(worldState, "ws", 0); walk(memory, "mem", 0);
  return out;
}
// one real committed GM turn; returns what a reviewer needs
function turn(text, o) {
  o = o || {}; var res = { thrown: "", warns: [], toasts: [], poison: [] };
  __toasts.length = 0;
  try { var q = quiet(function () { return commitGmTurn(text, { userMsg: o.userMsg || "I look around.", playerTxt: o.playerTxt || "I look around.", logPlayer: true }); }); res.warns = q.warns; }
  catch (e) { res.thrown = String(e && e.stack || e).split("\n").slice(0, 3).join(" | "); }
  res.toasts = __toasts.slice(); res.poison = poison();
  res.tag = (worldState.tagLog || [])[(worldState.tagLog || []).length - 1] || null;
  return res;
}
function prompt() { var out = { thrown: "", text: "", poison: [] }; try { var q = quiet(function () { return buildSysPrompt(); }); out.text = typeof q.r === "string" ? q.r : JSON.stringify(q.r); } catch (e) { out.thrown = String(e && e.message || e); } out.poison = poison(); return out; }
function controlOf(w) { var i = Math.max(0, w.length - 4), ch = w.charAt(i), rep = (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) ? "Q" : "q"; if (ch === "_") { i = 3; rep = "q"; } return w.slice(0, i) + rep + w.slice(i + 1); }
function subst(s, w, c) { var re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); return String(s).replace(re, function (m) { var o = "", i; for (i = 0; i < m.length; i++) { var cc = c.charAt(i), mc = m.charAt(i); if (cc.toLowerCase() === w.charAt(i).toLowerCase()) o += mc; else o += (mc === mc.toUpperCase() && mc !== mc.toLowerCase()) ? cc.toUpperCase() : cc.toLowerCase(); } return o; }); }
function firstDiff(a, b) { var i = 0, n = Math.min(a.length, b.length); while (i < n && a.charAt(i) === b.charAt(i)) i++; return (a === b) ? null : { at: i, a: a.slice(Math.max(0, i - 80), i + 160), b: b.slice(Math.max(0, i - 80), i + 160) }; }
module.exports = { TREE: String(WT).replace(/\\/g, "/").split("/").pop(), poison: poison, world: world, scanState: scanState, turn: turn, prompt: prompt, controlOf: controlOf, subst: subst, firstDiff: firstDiff, seed: seed, unseed: unseed, mulberry32: mulberry32, RES: RES, engine: l };
