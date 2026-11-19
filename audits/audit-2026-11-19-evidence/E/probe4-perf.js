// Probe 4: per-turn cost of the memory read paths on a 150-NPC / 1,500-entry synthetic campaign.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
addMsg = function () { return {}; }; showToast = function () {};
var _i = console.info; console.info = function () {}; console.warn = function () {};
function out(l, v) { _i.call(console, l, v); }
var FIRST = ["Mara","Tolan","Brin","Esk","Ilsa","Corvin","Dagna","Fenn","Garet","Holle","Ivo","Jessa","Kell","Lio","Moro"];
var LAST = ["Voss","Thorne","Ashby","Crane","Dunmore","Ember","Falk","Grey","Holt","Irons"];
L.makeTestWorld({ turn: 1500 }); delete worldState.ragMemory;
var names = [];
for (var i = 0; i < 150; i++) { var nm = FIRST[i % 15] + " " + LAST[Math.floor(i / 15)]; names.push(nm);
  memory.npcs[nm] = { attitude: "wary", knowledge: ["fact one about " + nm, "fact two"], events: [], aliases: [FIRST[i % 15] + " of " + LAST[Math.floor(i / 15)] + "ford"], lastSeenAt: "Town" + (i % 30) }; }
var filler = "The rain fell over the cobbles as the lanterns guttered and the crowd pressed close to hear the news. ";
for (var t = 1; t <= 750; t++) {
  worldState.transcript.push({ t: t, r: "player", x: "I ask " + names[t % 150] + " about the stolen relic and the harbor." });
  var x = names[t % 150] + " and " + names[(t * 7) % 150] + " argue. " + new Array(18).join(filler);
  worldState.transcript.push({ t: t, r: "gm", x: x });
}
var arch = memArchive();
for (var c = 0; c < 400; c++) arch.chapters.push({ turn: c * 3 + 1, summary: names[c % 150] + " met " + names[(c * 3) % 150] + " in Town" + (c % 30) + ". " + filler + filler });
for (var c2 = 0; c2 < 10; c2++) memory.chapters.push({ turn: 1300 + c2, summary: "Recent chapter " + c2 });
for (var n = 0; n < 30; n++) { var w = "Town" + n; memory.map.nodes[w] = newMapNode(n, null); memory.map.nodes[w].visits = 3; memory.locations[w] = { visited: [n], notes: [] };
  for (var s = 0; s < 8; s++) { var sk = w + "|Shop " + s; memory.map.nodes[sk] = newMapNode(n, w); memory.map.nodes[sk].visits = 1; } }
for (var b = 0; b < 40; b++) { var bk = "Faraway Keep " + b; memory.map.nodes[bk] = newMapNode(0, null, { blueprintSeeded: true }); }
worldState.world.location = "Town3";
sessionLog = []; for (var sl = 0; sl < 12; sl++) sessionLog.push({ role: sl % 2 ? "assistant" : "user", content: "Mara Voss speaks. " + filler });
function time(label, fn, reps) { reps = reps || 1; var t0 = process.hrtime.bigint(), r; for (var k = 0; k < reps; k++) r = fn(k); var ms = Number(process.hrtime.bigint() - t0) / 1e6; out(label, (ms / reps).toFixed(2) + " ms/call" + (typeof r === "string" ? " (" + r.length + " chars)" : "")); return r; }
time("resolveNpcName (new name, consolidation path)", function (k) { return resolveNpcName("Captain Zed" + k); }, 200);
time("resolveNpcName (variant of existing)", function (k) { return resolveNpcName("Sheriff " + names[k % 150]); }, 200);
time("ragKnownNames (rebuild)", function () { ragKnownNames._memo = null; return ragKnownNames().length + ""; }, 5);
time("memoryTOC(opts) GM turn", function () { return memoryTOC({ npcFilter: function () { return false; } }); }, 3);
time("memoryTOC() Table Talk", function () { return memoryTOC(); }, 3);
time("blueprintKnownPlaces alone", function () { return Object.keys(blueprintKnownPlaces()).length + ""; }, 3);
time("ragRetrieve (memo miss)", function (k) { ragRetrieve._memo = null; return ragRetrieve("Ask Mara Voss about the stolen relic " + k); }, 3);
time("ragChapterRetrieve (memo miss)", function (k) { ragChapterRetrieve._memo = null; ragChapterRetrieve._entMemo = null; return ragChapterRetrieve("Ask Mara Voss about the relic " + k); }, 3);
time("scanNpcNameVariants", function () { worldState.pendingMergeHints = []; worldState.mergeHintNudged = {}; return scanNpcNameVariants() + ""; }, 2);
time("ragEntitiesFromRaw (one GM reply)", function () { return JSON.stringify(ragEntitiesFromRaw("[NPC:Mara Voss|calm|ally] Mara Voss and Tolan Thorne talk. " + filler)); }, 20);
time("buildRecordedFactsBlock", function () { return buildRecordedFactsBlock(sessionLog.map(function (e) { return e.content; }).join("\n")); }, 10);
out("KNOWN OF line length", (memoryTOC({ npcFilter: function () { return false; } }).match(/KNOWN OF[^\n]*/) || [""])[0].length);
