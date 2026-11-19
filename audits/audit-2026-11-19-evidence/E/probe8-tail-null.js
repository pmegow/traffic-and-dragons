// Probe 8: a null-content entry in the newest pair — sessionTokens/buildExtractWindow guard it, retainSessionTail does not.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
var msgs = []; addMsg = function (r, m) { msgs.push(m); return {}; }; showToast = function () {};
console.info = function () {}; console.warn = function () {}; console.error = function () {}; reportError = function () {};
var saved = 0; saveLocal = function () { saved++; return true; }; saveCore = function () { return true; }; saveMem = function () { return true; };
compileEraIfDue = function () {};
L.makeTestWorld({ turn: 60 });
var big = new Array(60).join("The harbor bells rang while the dockmaster argued about the cargo. ");
sessionLog = [];
for (var i = 0; i < 6; i++) { sessionLog.push({ role: "user", content: "I look around." }); sessionLog.push({ role: "assistant", content: big }); }
sessionLog[sessionLog.length - 1] = { role: "assistant", content: null };
callGM = function () { return Promise.resolve(JSON.stringify({ chapterSummary: "Korrag watched the harbor.", decisionsMade: ["Korrag stayed."] })); };
(async function () {
  await summarize();
  console.log("saveLocal calls", saved, "chapters", memory.chapters.length, "decisions", memory.keyDecisions.length, "sessionLog", sessionLog.length, "sessKept", worldState.sessKept, "strike", JSON.stringify(worldState.summaryFailure && worldState.summaryFailure.count));
  console.log("system lines", JSON.stringify(msgs));
})().catch(function (e) { console.log("probe threw", e && e.message); });
