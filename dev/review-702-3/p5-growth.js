// p5-growth.js — monotonic resources: what the store, the caches and a turn's cost do as additions pile up. node ... <ROOT>
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function size() { return JSON.stringify(worldState.atlas).length; }
say("== P5 growth: 24 villages, then 12 trades in one town, then 12 rooms in one inn");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, i, t0, times = [], s0 = size(), ok = 0;
  for (i = 0; i < 24; i++) { t0 = Date.now(); H.turn("[LOCATION:Hamlet " + i + "] On."); times.push(Date.now() - t0); if (!A.off) ok++; }
  out("villages added", ok + " of 24; store " + s0 + " -> " + size() + " bytes; region edits " + ((A.zones[A.seed].params.edits || []).length) + "; adds " + Object.keys(A.adds).length);
  out("ms per village-add turn (first..last)", times.slice(0, 3).concat(["…"]).concat(times.slice(-3)));
  out("doc cache / peeks / warned", Object.keys(_atlasDocs).length + " / " + Object.keys(_atlasPeeks).length + " / " + Object.keys(_atlasWarned).length);
  H.turn("[LOCATION:" + c.p0.name + "]"); s0 = size(); ok = 0; times = [];
  for (i = 0; i < 12; i++) { H.turn("[SUBLOCATION_LEAVE]"); t0 = Date.now(); H.turn("[SUBLOCATION:Trade " + i + " Smithy] A smithy."); times.push(Date.now() - t0); if (!A.off) ok++; }
  out("trades added", ok + " of 12; store " + s0 + " -> " + size() + " bytes; town edits " + ((A.zones[c.townId].params.edits || []).length) + "; zones " + Object.keys(A.zones).length);
  out("ms per trade-add turn", times.slice(0, 3).concat(["…"]).concat(times.slice(-3)));
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.inn.name + "] In."); s0 = size(); ok = 0; times = [];
  for (i = 0; i < 12; i++) { t0 = Date.now(); H.turn("[SUBLOCATION:Nook " + i + "] A nook."); times.push(Date.now() - t0); if (!A.off) ok++; }
  out("rooms added", ok + " of 12; store " + s0 + " -> " + size() + " bytes; inn edits " + ((A.zones[A.at].params && A.zones[A.at].params.edits || []).length));
  out("ms per room-add turn", times.slice(0, 3).concat(["…"]).concat(times.slice(-3))); out("last refusal", A.off && A.off.why);
  out("doc cache / peeks / warned / told", Object.keys(_atlasDocs).length + " / " + Object.keys(_atlasPeeks).length + " / " + Object.keys(_atlasWarned).length + " / " + A.told.length);
  out("total store", size() + " bytes; adds " + Object.keys(A.adds).length + "; names " + Object.keys(A.names).length);
  /* a plain move after all that: the redraw cost of a region with 24 edits */
  H.turn("[SUBLOCATION_LEAVE]"); atlasForget(); t0 = Date.now(); atlasDoc(A.seed); out("region redraw with 24 edits ms", Date.now() - t0); t0 = Date.now(); atlasDoc(c.townId); out("town redraw with 12 edits ms", Date.now() - t0);
})();
