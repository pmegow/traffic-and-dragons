// REVIEW PROBE LIBRARY (read-only on the trees). Loads the real engine of the tree in argv[2] through the shared harness and
// gives: a built-in poison detector/cleaner, a deterministic world, a state scanner, and a case runner.
// Usage in a probe:  var L = require("./lib.js");   (argv[2] = tree)
process.env.ENGINE_ROOT = process.argv[2];
require("../../thu/vtags/harness.js");
var TREE = String(process.argv[2]).replace(/\\/g, "/").split("/").pop();

// ---- deterministic randomness and time (mulberry32) ----
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var _realRandom = Math.random, _realNow = Date.now;
function seed(n) { Math.random = mulberry32(n || 12345); Date.now = function () { return 1790000000000; }; }
function unseed() { Math.random = _realRandom; Date.now = _realNow; }

// ---- built-in poison detection ----
var WATCH = [];
function watch(label, obj) { if (obj == null || (typeof obj !== "object" && typeof obj !== "function")) return; for (var i = 0; i < WATCH.length; i++) if (WATCH[i].obj === obj) return; var names = Object.getOwnPropertyNames(obj), vals = {}; names.forEach(function (n) { var d = Object.getOwnPropertyDescriptor(obj, n); vals[n] = d; }); WATCH.push({ label: label, obj: obj, names: names, descs: vals }); }
[["Object", Object], ["Object.prototype", Object.prototype], ["Function.prototype", Function.prototype], ["Array.prototype", Array.prototype], ["String.prototype", String.prototype], ["Number.prototype", Number.prototype], ["Boolean.prototype", Boolean.prototype], ["RegExp.prototype", RegExp.prototype], ["Date.prototype", Date.prototype], ["Error.prototype", Error.prototype], ["Array", Array], ["String", String], ["Function", Function], ["Number", Number], ["JSON", JSON], ["Math", Math]].forEach(function (p) { watch(p[0], p[1]); });
Object.getOwnPropertyNames(Object.prototype).forEach(function (n) { var d = Object.getOwnPropertyDescriptor(Object.prototype, n); if (d && typeof d.value === "function") watch("Object.prototype." + n + "(fn)", d.value); if (d && typeof d.get === "function") watch("Object.prototype." + n + "(getter)", d.get); if (d && typeof d.set === "function") watch("Object.prototype." + n + "(setter)", d.set); });
function poison() {
  var out = [];
  WATCH.forEach(function (w) {
    if (w.obj === Math || w.obj === Date) { /* Math.random / Date.now are ours */ }
    var now = Object.getOwnPropertyNames(w.obj);
    now.forEach(function (n) {
      if (w.names.indexOf(n) < 0) { var v; try { v = w.obj[n]; } catch (e) { v = "?"; } out.push(w.label + "." + n + "=" + short(v)); try { delete w.obj[n]; } catch (e2) { } return; }
      if (w.obj === Math && n === "random") return;
      var d0 = w.descs[n], d1 = Object.getOwnPropertyDescriptor(w.obj, n);
      if (d0 && d1 && ("value" in d0) && ("value" in d1) && !Object.is(d0.value, d1.value)) { out.push(w.label + "." + n + " OVERWRITTEN=" + short(d1.value)); try { Object.defineProperty(w.obj, n, d0); } catch (e3) { } }
    });
    w.names.forEach(function (n) { if (now.indexOf(n) < 0) { out.push(w.label + "." + n + " DELETED"); try { Object.defineProperty(w.obj, n, w.descs[n]); } catch (e4) { } } });
  });
  // prototype swaps on the built-ins themselves
  if (Object.getPrototypeOf(Object.prototype) !== null) out.push("Object.prototype has a prototype now");
  return out;
}
function short(v) { var s; try { s = typeof v === "function" ? "function " + (v.name || "") : JSON.stringify(v); } catch (e) { s = String(v); } return String(s).slice(0, 80); }

// ---- the world ----
function world(mode) {
  makeWorld(); delete worldState.kind; worldState.turn = 9;
  worldState.npcs.push({ name: "Bram", status: "", rel: "ally", met: 1, partyMember: false, aliases: [], pronouns: "he/him" });
  memory.npcs.Bram = { attitude: "", knowledge: ["keeps the forge"], events: [{ turn: 3, note: "shod a mare" }], aliases: [] };
  var cs = addComp("Kira", ["Dagger", "Rope"], { hp: 10, maxHp: 10, level: 1, xp: 0, cls: "Rogue", gender: "F", stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 }, skills: (typeof initSkills === "function" ? initSkills() : {}), spells: [{ nm: "Mage Hand (invisible)", lvl: 0, used: false }, { nm: "Charm Person (1 hour)", lvl: 1, used: false }], abilities: [], conditions: [], relationships: [], saveModifiers: [], languages: [{ name: "Common", broken: false }], coreMemories: [], storyBeats: [], alignLaw: 0, alignGood: 0, actualAlignment: "True Neutral", flaw: "reckless", trait: "wry" });
  memory.npcs.Kira = { attitude: "", knowledge: [], events: [], aliases: [], partyMember: true };
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes["Ashfen"] = (typeof newMapNode === "function") ? newMapNode(1, null) : { firstVisit: 1, visits: 1, description: null, parent: null, npcs: [], items: [], size: null, travelMins: null };
  memory.map.nodes["Ashfen"].visits = 2;
  if (!memory.locations) memory.locations = {};
  memory.locations["Ashfen"] = { visited: [1], notes: [] };
  worldState.questLog.push({ title: "Find the bell", status: "active", desc: "", objectives: [{ text: "ask the smith", done: false }], started: 1, lastTouch: 1 });
  worldState.character.gold = 50;
  if (mode === "combat") worldState.combat = { round: 1, engaged: null, foes: [{ name: "Goblin", hp: 8, maxHp: 8, ac: 12, atk: 3, dmg: "1d6", morale: "steady" }], node: "Ashfen" };
  if (mode === "refs") { quiet(function () { try { buildSysPrompt(); } catch (e) { } }); if (!worldState.sceneRefs && typeof sceneRefsEnsure === "function") sceneRefsEnsure(); }
  if (mode === "village") { villageEF(); worldState.turn = 9; worldState.npcs.push({ name: "Bram", status: "", rel: "ally", met: 1, partyMember: false, aliases: [] }); memory.npcs.Bram = { attitude: "", knowledge: [], events: [], aliases: [] }; }
  return worldState;
}

// ---- state scan: own reserved keys, odd prototypes, function values ----
var RES = Object.create(null); Object.getOwnPropertyNames(Object.prototype).forEach(function (n) { RES[n] = 1; });
function scanState() {
  var out = [], seen = (typeof WeakSet !== "undefined") ? new WeakSet() : null;
  function walk(v, path, depth) {
    if (v === null || depth > 30) return;
    if (typeof v === "function") { out.push("FUNCTION value at " + path + " (" + (v.name || "anon") + ")"); return; }
    if (typeof v !== "object") return;
    if (seen) { if (seen.has(v)) return; seen.add(v); }
    var pr = Object.getPrototypeOf(v);
    if (Array.isArray(v)) { if (pr !== Array.prototype) out.push("ARRAY with odd prototype at " + path); for (var i = 0; i < v.length; i++) walk(v[i], path + "[" + i + "]", depth + 1); return; }
    if (pr !== Object.prototype && pr !== null) out.push("OBJECT with swapped prototype at " + path);
    Object.getOwnPropertyNames(v).forEach(function (k) { if (RES[k]) out.push("own key '" + k + "' at " + path); if (/^(portrait)$/.test(k)) return; var d = Object.getOwnPropertyDescriptor(v, k); if (d && "value" in d) walk(d.value, path + "." + k, depth + 1); });
  }
  walk(worldState, "ws", 0); walk(memory, "mem", 0);
  return out;
}

// ---- one case ----
function runCase(text, mode, opts) {
  opts = opts || {};
  world(mode); seed(777);
  if (opts.before) opts.before();
  var res = { thrown: "", errors: [], muts: [], warns: [], refused: false, poison: [], poison2: [], promptThrow: "", serThrow: "", scan: [], state: "", prompt: "" };
  try { var r = run(text, opts.applyOpts); res.muts = r.muts; res.errors = (r.r && r.r.errors) || []; res.warns = r.warns; }
  catch (e) { res.thrown = String(e && e.message || e); }
  res.poison = poison();
  res.refused = res.muts.some(function (m) { return /refused \(reserved word/.test(m); });
  try { res.scan = scanState(); } catch (e0) { res.scan = ["scan threw " + e0.message]; }
  try { res.state = JSON.stringify({ ws: worldState, mem: memory }); } catch (e1) { res.serThrow = String(e1 && e1.message || e1); }
  if (!opts.noPrompt) {
    try { var q = quiet(function () { return buildSysPrompt(); }); res.prompt = typeof q.r === "string" ? q.r : JSON.stringify(q.r); }
    catch (e2) { res.promptThrow = String(e2 && e2.message || e2); }
    res.poison2 = poison();
  }
  unseed();
  return res;
}
function controlOf(w) { // one letter changed, same case class: the 4th-from-last letter becomes q/Q (never a letter that changes the shape)
  var i = Math.max(0, w.length - 4), ch = w.charAt(i), rep = (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) ? "Q" : "q";
  if (ch === "_") { i = 3; ch = w.charAt(i); rep = "q"; }
  return w.slice(0, i) + rep + w.slice(i + 1);
}
function subst(s, w, c) { // case-insensitive replace of w by c, preserving each matched letter's case
  var re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return String(s).replace(re, function (m) { var o = "", i; for (i = 0; i < m.length; i++) { var cc = c.charAt(i), mc = m.charAt(i); if (cc.toLowerCase() === w.charAt(i).toLowerCase()) o += mc; else o += (mc === mc.toUpperCase() && mc !== mc.toLowerCase()) ? cc.toUpperCase() : cc.toLowerCase(); } return o; });
}
module.exports = { TREE: TREE, poison: poison, world: world, scanState: scanState, runCase: runCase, controlOf: controlOf, subst: subst, seed: seed, unseed: unseed, mulberry32: mulberry32, RES: RES };
