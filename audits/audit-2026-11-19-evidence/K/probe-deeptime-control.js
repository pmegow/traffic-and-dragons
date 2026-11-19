// Probe: does the one review pass (correctCampaignSkeleton) drop the draft's deepTime age ladder (#227)?
// Drives the REAL generateSkeleton with a stubbed callGM: draft (with deepTime) -> review (one finding) ->
// correction that obeys its prompt exactly (returns the {premise,acts} it was sent, fixed).
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
global.showToast = function (m) { console.log('TOAST', m); };
global.saveCore = function () {};
var draft = {
  premise: "A drowned king stirs beneath the salt marsh.",
  acts: [1, 2, 3].map(function (n) { return { title: "Act " + n + " of tides", goal: "Goal " + n, turningPoint: "Turn " + n, parallel: false, arcs: [{ title: "Arc " + n, objective: "Find the reliquary " + n, type: "exploration" }] }; }),
  deepTime: [{ name: "The Salt Empire", when: "three thousand years ago", note: "built the dikes" }, { name: "The Drowning", when: "a thousand years ago", note: "the sea came" }, { name: "living memory", when: "now", note: "fishing towns" }]
};
var calls = [], sentToCorrection = null;
global.callGM = async function (msg, sys, max, model, o) {
  calls.push((o && o.kind) || '?');
  if (calls.length === 1) return JSON.stringify(draft);
  if (/Review this three-act campaign skeleton/.test(msg)) return JSON.stringify({ findings: [] });
  if (/Apply review fixes/.test(msg)) {
    var j = msg.slice(msg.indexOf("SKELETON:\n") + 10, msg.indexOf("\n\nFINDINGS"));
    sentToCorrection = JSON.parse(j);
    sentToCorrection.acts[1].turningPoint = "The sluice opens.";
    return JSON.stringify(sentToCorrection); // the complete corrected skeleton, in the schema the prompt demands
  }
  throw new Error('unexpected call');
};
(async function () {
  delete worldState.deepTime;
  try { await generateSkeleton(function () {}); } catch (e) { console.log('generateSkeleton THREW', e.message); }
  console.log('calls:', calls.join(','));
  console.log('keys sent to the correction:', sentToCorrection ? Object.keys(sentToCorrection).join(',') : '(none)');
  console.log('worldState.deepTime after start:', JSON.stringify(worldState.deepTime));
  console.log('skeleton act2 turningPoint:', worldState.skeleton && worldState.skeleton.acts[1].turningPoint);
})();
