// Probe 6: summarize() when the commit's saveLocal fails (storage full): the extraction is already applied in RAM and the
// log is kept "for the retry" — does the retry file the same window a second time?
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
var msgs = []; addMsg = function (r, m) { msgs.push(m); return {}; }; showToast = function () {}; syncUI = function () {};
console.info = function () {}; console.warn = function () {}; console.error = function () {};
reportError = function () {};
var saveOk = [false, true], saveN = 0;
saveLocal = function () { return saveOk[saveN++]; }; saveCore = function () { return true; }; saveMem = function () { return true; };
compileEraIfDue = function () {};
L.makeTestWorld({ turn: 60 });
memory.npcs["Mara Voss"] = { attitude: "", knowledge: [], events: [], aliases: [] };
var big = new Array(60).join("The harbor bells rang while Mara Voss argued with the dockmaster about the cargo. ");
sessionLog = [];
for (var i = 0; i < 6; i++) { sessionLog.push({ role: "user", content: "I talk to Mara Voss." }); sessionLog.push({ role: "assistant", content: big }); }
var EXTRACT = JSON.stringify({ chapterSummary: "Korrag argued with Mara Voss at the harbor about the cargo.", npcUpdates: [{ name: "Mara Voss", attitude: "wary", knowledgeGained: { fact: "Mara Voss stood on the pier at dusk", kind: "scene" } }], loreDiscovered: [], decisionsMade: ["Korrag refused to pay the harbor toll."], futureEvents: [], resolvedEvents: [] });
callGM = function () { return Promise.resolve(EXTRACT); };
(async function () {
  await summarize();
  console.log("after attempt 1 (saveLocal false): chapters", memory.chapters.length, "decisions", memory.keyDecisions.length, "events", memory.npcs["Mara Voss"].events.length, "sessionLog", sessionLog.length);
  worldState.turn = 61;
  await summarize();
  console.log("after attempt 2 (saveLocal true):  chapters", memory.chapters.length, "decisions", memory.keyDecisions.length, "events", memory.npcs["Mara Voss"].events.length, "sessionLog", sessionLog.length);
  console.log("chapters:", JSON.stringify(memory.chapters));
  console.log("decisions:", JSON.stringify(memory.keyDecisions));
  console.log("eventHistory:", JSON.stringify(worldState.eventHistory));
  console.log("system lines:", JSON.stringify(msgs));
})().catch(function (e) { console.log("probe threw", e && e.stack); });
