// p4b-margin-centre.js — the frame margin, made observable: around a centre whose candidate ring crosses the margin on LAND,
// what does atlasRegionPoints offer with the filter (shipped) and what would it offer without it? And does the game's own
// addition then land there? node dev/review-702-3/p4b-margin-centre.js <ROOT>
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function withoutFilter(doc, centre) {
  var out = [], radii = [50, 80, 120, 170], bear = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]], i, j, x, y;
  for (i = 0; i < radii.length; i++) for (j = 0; j < bear.length; j++) { x = Math.round(centre[0] + bear[j][0] * radii[i]); y = Math.round(centre[1] + bear[j][1] * radii[i]); try { TnDMaps.wild.fromRegion(doc, [x, y]); } catch (e) { continue; } out.push([x, y]); }
  return out;
}
var A = H.fresh("campaign-1"), rd = atlasDoc(A.seed), centre = [317, 70];
var shipped = atlasRegionPoints(rd, centre), bare = withoutFilter(rd, centre);
out("centre", centre); out("with the filter", shipped.length + " points, first " + JSON.stringify(shipped[0]) + ", any in the margin: " + shipped.some(function (p) { return p[0] < 40 || p[1] < 40; }));
out("without the filter", bare.length + " points, first " + JSON.stringify(bare[0]) + ", in the margin: " + JSON.stringify(bare.filter(function (p) { return p[0] < 40 || p[1] < 40; })));
/* the first unfiltered point: would the region's add take a settlement there? */
(function () { var p = bare.filter(function (q) { return q[1] < 40; })[0]; if (!p) { out("no margin land point", "skip"); return; }
  try { var d2 = TnDMaps.generate("region", Object.assign({}, rd.params, { edits: [{ op: "add", id: "a1", name: "Edgeford", kind: "village", at: p }] })); var q = d2.places.filter(function (z) { return z.name === "Edgeford"; })[0]; out("region add at " + JSON.stringify(p), q ? "ACCEPTED, drawn at " + q.x + "," + q.y + " (" + q.kind + ")" : "dropped"); }
  catch (e) { out("region add at " + JSON.stringify(p), "refused: " + e.message.slice(0, 120)); } })();
/* through the game: a party at a map place whose doorstep ring crosses the top margin — is there a fixture settlement within 90 px of an edge on land? */
var near = rd.places.filter(function (p) { return Math.min(p.x, p.y, rd.frame.width - p.x, rd.frame.height - p.y) < 90; }).map(function (p) { return p.name + "@" + p.x + "," + p.y; });
out("fixture settlements within 90 px of the frame", near);
