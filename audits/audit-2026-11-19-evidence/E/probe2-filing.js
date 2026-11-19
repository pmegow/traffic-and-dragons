// Probe 2: filing edge inputs in applySummaryExtract / file* helpers.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
addMsg = function () { return {}; }; showToast = function () {}; syncUI = function () {};
saveMem = function () { return true; }; saveCore = function () { return true; }; saveAll = function () {};
var _w = console.warn, _i = console.info; var logs = [];
console.warn = function (m) { logs.push("W " + m); }; console.info = function (m) { logs.push("I " + m); };
function out(label, v) { _i.call(console, label, typeof v === "string" ? v : JSON.stringify(v)); }

// 2a: supersededFacts with a whitespace / one-letter "old"
L.makeTestWorld({ turn: 40 });
memory.npcs["Mara Voss"] = { attitude: "", knowledge: ["Mara Voss commands the harbor watch.", "Mara Voss owes the Guild nothing."], events: [], aliases: [] };
try { applySummaryExtract({ supersededFacts: [{ name: "Mara Voss", old: " ", "new": "Mara Voss sails at dawn." }] }); } catch (e) { out("2a threw", e.message); }
out("2a knowledge after old=' '", memory.npcs["Mara Voss"].knowledge);
out("2a archive.superseded", memArchive().superseded);

// 2b: resolvedEvents needle of one letter
L.makeTestWorld({ turn: 40 });
memory.futureEvents = [{ when: "soon", who: "", what: "Rescue Ameiko from the Glassworks", setTurn: 39, resolved: false }, { when: "soon", who: "", what: "Meet the Sheriff", setTurn: 39, resolved: false }];
applySummaryExtract({ resolvedEvents: ["a"] });
out("2b futureEvents after needle 'a'", memory.futureEvents.map(function (f) { return f.what; }));

// 2c: reserved names as NPC / place / lore keys
L.makeTestWorld({ turn: 40 });
try {
  fileNpcEvent("__proto__", "ate an apple", 40); fileNpcEvent("constructor", "built a wall", 40);
  fileNpcKnowledge("toString", "knows things", 40);
  out("2c npcs keys", Object.keys(memory.npcs));
  out("2c proto polluted?", ({}).note === undefined && ({}).events === undefined ? "no" : "YES");
  fileLocation("__proto__", null, 40); fileLocation("hasOwnProperty", null, 41);
  out("2c locations", Object.keys(memory.locations)); out("2c nodes", Object.keys(memory.map.nodes));
  var toc = memoryTOC(); out("2c TOC ok", toc.length);
} catch (e) { out("2c threw", e.stack); }

// 2d: a deferred scene-kind knowledge line comes back as durable Knows?
L.makeTestWorld({ turn: 40 });
worldState.recordDeferred = [];
recordDeferPush({ kind: "knowledge", name: "Mara Voss", text: "Mara Voss stood at the gate holding a lantern" }, 40);
out("2d deferred row", worldState.recordDeferred);

// 2e: fileLocation edges when the live pointer is an alias of the canonical world
L.makeTestWorld({ turn: 40 });
worldState.world.location = "Ashfen";
fileLocation("Ashfen", null, 1);
fileLocation("Brindle", null, 2);
if (typeof locAliasRegister === "function") { try { locAliasRegister("Ashfen", "Ashfen Town", null); } catch (e) { out("alias threw", e.message); } }
worldState.world.location = "Ashfen Town"; // an older pointer naming the alias
fileLocation("Brindle", null, 3);
out("2e locResolve('Ashfen Town')", typeof locResolve === "function" ? locResolve("Ashfen Town") : "n/a");
out("2e edges", memory.map.edges);
out("2e lastArrivalFrom", memory.map.lastArrivalFrom);

console.warn = _w; console.info = _i;
_i.call(console, "--- logs ---\n" + logs.filter(function (l) { return /supersed|SUBSTRING|resolved/.test(l); }).join("\n"));
