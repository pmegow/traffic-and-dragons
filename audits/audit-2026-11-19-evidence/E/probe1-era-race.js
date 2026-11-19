// Probe 1: compileEraIfDue is fire-and-forget; does a campaign switch during its await land campaign A's era in campaign B?
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
addMsg = function () { return {}; }; showToast = function () {}; syncUI = function () {};
var saves = [];
saveMem = function () { saves.push({ eras: JSON.stringify(memory.eras || []), camp: worldState.campId }); return true; };
saveCore = function () { return true; }; saveAll = function () { };
L.makeTestWorld({ campId: "A", campName: "Alpha", turn: 300 });
var arch = memArchive();
for (var i = 1; i <= 22; i++) arch.chapters.push({ turn: i * 10, summary: "Alpha chapter " + i + ": Korrag fought in Ashfen." });
var resolveCall;
callGM = function () { return new Promise(function (res) { resolveCall = res; }); };
var p = compileEraIfDue();
// ── the player switches campaign while the era call is in flight (busy is already false: summarize returned) ──
L.makeTestWorld({ campId: "B", campName: "Beta", turn: 7 });
console.log("B eras before resolve:", JSON.stringify(memory.eras || []));
resolveCall('{"summary":"Alpha era: Korrag fought in Ashfen across twenty chapters."}');
p.then(function () {
  console.log("B campId now:", worldState.campId);
  console.log("B eras after resolve:", JSON.stringify(memory.eras));
  console.log("saveMem calls:", JSON.stringify(saves));
});
