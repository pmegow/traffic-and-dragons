// Probe 21: campaignDenouement called twice at once, then again after it landed; and a retry after a no-prose reply.
var m = require("./p5_e2e.js");
(async function () {
  var calls = 0;
  m.seed({ comps: [{ name: "Morwen" }] });
  callGM = function () { calls++; return new Promise(function (res) { setTimeout(function () { res("You walk out. Morwen follows.\nRECORD: Ammut learned to stay."); }, 20); }); };
  var p1 = campaignDenouement(), p2 = campaignDenouement(); await p1; await p2; await campaignDenouement();
  console.log("twice at once + once after: model calls " + calls + ", transcript entries " + worldState.transcript.length + ", chapters " + memory.chapters.length + ", ending moments on hero " + worldState.character.coreMemories.filter(function (x) { return x.kind === "ending"; }).length + ", owed " + worldState.denouementOwed);
  // a no-prose reply, then a good one at the "next boot"
  calls = 0; m.seed({ comps: [{ name: "Morwen" }] });
  callGM = function () { calls++; return Promise.resolve(calls === 1 ? "RECORD: Ammut learned to stay." : "You walk out. Morwen follows.\nRECORD: Ammut learned to stay."); };
  await campaignDenouement(); var owed1 = worldState.denouementOwed, tr1 = worldState.transcript.length, mo1 = worldState.character.coreMemories.length, fate1 = !!worldState.character.fate;
  await campaignDenouement();
  console.log("no-prose then retry: after 1st owed=" + owed1 + " transcript=" + tr1 + " moments=" + mo1 + " fate=" + fate1 + " | after 2nd owed=" + worldState.denouementOwed + " transcript=" + worldState.transcript.length + " moments=" + worldState.character.coreMemories.length + " calls=" + calls);
  // a throw AFTER the transcript was written (fileCoreMemory's toast throws): what does the retry do?
  calls = 0; m.seed({ comps: [{ name: "Morwen" }] });
  callGM = function () { calls++; return Promise.resolve("You walk out. Morwen follows.\nRECORD: Ammut learned to stay."); };
  var keepToast = showToast, n = 0; showToast = function (x) { n++; if (n === 1) throw new Error("toast host gone"); };
  await campaignDenouement(); var owedA = worldState.denouementOwed, trA = worldState.transcript.length;
  showToast = keepToast; await campaignDenouement();
  console.log("throw after the transcript write, then retry: after 1st owed=" + owedA + " transcript=" + trA + " | after retry owed=" + worldState.denouementOwed + " transcript entries=" + worldState.transcript.length + " chapters=" + memory.chapters.length + " ending moments=" + worldState.character.coreMemories.filter(function (x) { return x.kind === "ending"; }).length);
  process.exit(0);
})();
