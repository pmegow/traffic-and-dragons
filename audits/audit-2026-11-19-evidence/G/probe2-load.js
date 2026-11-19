// Probe: (a) memory "{}" through healMemory; (b) corrupt core key at loadState; (c) migrate throw at loadState;
// (d) importSaveData with a null spell entry.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
var toasts = [], errs = [];
showToast = function (m) { toasts.push(String(m)); };
var oe = console.error, ow = console.warn;
console.error = function () { errs.push([].slice.call(arguments).join(" ")); };
console.warn = function () { errs.push("W " + [].slice.call(arguments).join(" ")); };
function report(label, v) { oe.call(console, label, v); }

// (a)
L.makeTestWorld({ campId: "campA" });
memory = {};
try { healMemory(); } catch (e) { report("(a) healMemory threw", e.message); }
report("(a) after heal of {}: typeof memory.npcs =", typeof memory.npcs + ", locations=" + typeof memory.locations + ", quests=" + typeof memory.quests + ", lore=" + typeof memory.lore);
try { Object.keys(memory.npcs); report("(a) Object.keys(memory.npcs) ok", ""); } catch (e) { report("(a) Object.keys(memory.npcs) THREW:", e.message); }
report("(a) _pulledMemory-shaped check accepts {}:", (function (m) { return !!(m && typeof m === "object" && !Array.isArray(m)); })({}));

// (b) corrupt core
toasts.length = 0; errs.length = 0;
L.makeTestWorld({ campId: "campA" }); setActiveCampId("campA");
store.set(WSK, '{"campId":"campA","character":{"name":"T"'); // truncated
store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(blankMemory()));
var ok = loadState();
var rescueKeys = Object.keys(_m).filter(function (k) { return /rescue/.test(k); });
report("(b) truncated core: loadState =", ok + " | worldState=" + worldState + " | toasts=" + JSON.stringify(toasts) + " | console=" + JSON.stringify(errs) + " | rescue keys=" + JSON.stringify(rescueKeys) + " | versionRefusedLoad=" + versionRefusedLoad());

// (c) migrate throw on valid JSON: a null spell
toasts.length = 0; errs.length = 0;
var ws = L.makeTestWorld({ campId: "campA" }); ws.character.spells = [null];
store.set(WSK, JSON.stringify(ws));
ok = loadState();
report("(c) null spell: loadState =", ok + " | worldState=" + worldState + " | toasts=" + JSON.stringify(toasts) + " | console=" + JSON.stringify(errs.slice(0, 3)));

// (d) importSaveData with a null spell
toasts.length = 0; errs.length = 0;
var live = L.makeTestWorld({ campId: "campLive", campName: "Live" }); setActiveCampId("campLive"); memory.campId = "campLive"; memory.lore.push("LIVE-LORE");
store.set(WSK, serializeWorldState(live)); store.set(MEM_KEY, JSON.stringify(memory));
var imp = JSON.parse(JSON.stringify(live)); imp.campId = "campForeign"; imp.campName = "Imported"; imp.character.name = "Imp"; imp.character.spells = [null];
var threw = null;
try { importSaveData({ worldState: imp, sessionLog: [], memory: { lore: ["IMPORTED-LORE"] } }); } catch (e) { threw = e.message; }
report("(d) import threw:", threw);
report("(d) after the throw: active id=" + getActiveCampId() + " worldState.campName=" + (worldState && worldState.campName) + " memory.lore=" + JSON.stringify(memory.lore) + " memory.campId=" + memory.campId, "");
process.exit(0);
