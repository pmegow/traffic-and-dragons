// p4-margin.js — the "frame margin is an equivalent mutant" claim: does TnDMaps.wild.fromRegion refuse every point within
// 40 px of the frame by itself, on the fixture realm and on other seeds? And would the region's `add` accept one there?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
say("== P4 the frame margin");
["campaign-1", "campaign-2", "seed-xyz", "abcd1234", "realm-9", "lirn-two"].forEach(function (seed) {
  var doc = TnDMaps.generate("region", { seed: seed }), W = doc.frame.width, Hh = doc.frame.height, acc = [], ref = 0, tot = 0, x, y, pts = [];
  for (x = 2; x < W; x += 7) { pts.push([x, 5]); pts.push([x, 20]); pts.push([x, 39]); pts.push([x, Hh - 5]); pts.push([x, Hh - 20]); pts.push([x, Hh - 39]); }
  for (y = 2; y < Hh; y += 7) { pts.push([5, y]); pts.push([20, y]); pts.push([39, y]); pts.push([W - 5, y]); pts.push([W - 20, y]); pts.push([W - 39, y]); }
  pts.forEach(function (p) { tot++; try { TnDMaps.wild.fromRegion(doc, p); acc.push(p); } catch (e) { ref++; } });
  out(seed + " frame " + W + "x" + Hh, "margin points tried " + tot + ", refused by wild.fromRegion " + ref + ", ACCEPTED " + acc.length + (acc.length ? " e.g. " + JSON.stringify(acc.slice(0, 4)) : ""));
  if (acc.length) {
    var p = acc[0];
    try { var d2 = TnDMaps.generate("region", Object.assign({}, doc.params, { edits: [{ op: "add", id: "a1", name: "Edgeford", kind: "village", at: p }] })); out("  region add at " + JSON.stringify(p), d2.places.some(function (q) { return q.name === "Edgeford"; }) ? "ACCEPTED by the region's add" : "silently dropped"); }
    catch (e) { out("  region add at " + JSON.stringify(p), "refused: " + e.message.slice(0, 140)); }
  }
});
/* what atlasRegionPoints offers around a settlement near the edge, with the filter as shipped */
(function () {
  var A = H.fresh("campaign-1"), rd = atlasDoc(A.seed), edge = rd.places.slice().sort(function (a, b) { return Math.min(a.x, a.y, rd.frame.width - a.x, rd.frame.height - a.y) - Math.min(b.x, b.y, rd.frame.width - b.x, rd.frame.height - b.y); })[0];
  out("nearest-to-edge settlement", edge.name + " @" + edge.x + "," + edge.y + " frame " + rd.frame.width + "x" + rd.frame.height);
  out("points offered", atlasRegionPoints(rd, [edge.x, edge.y]).length);
})();
