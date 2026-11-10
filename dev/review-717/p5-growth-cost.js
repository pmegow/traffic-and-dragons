// p5-growth-cost.js — the monotonic-resources pass on A.seen: walks the party between random named things of ONE
// town (the fixture capital), then between the realm's places, by the pointer (atlasFollow — the writer's own door),
// and at 25/50/100/200/400/800 moves prints: stands, legs, bytes of the record, the cost of ONE atlasReveal (it routes
// every leg at every read), the size of the spec handed to view.setReveal and the cost of the fogged scene.build.
// The pane runs atlasReveal + (when it differs) a scene build on every show and after every turn under an open pane.
// node dev/review-717/p5-growth-cost.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
var s = 7; function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; } function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function once(list) { return list.filter(function (x) { return list.filter(function (y) { return atlasNameKey(y.name) === atlasNameKey(x.name); }).length === 1; }); }
function ms(f, n) { var t = process.hrtime.bigint(), i; for (i = 0; i < (n || 1); i++) f(); return Number(process.hrtime.bigint() - t) / 1e6 / (n || 1); }
function row(A, z, moves) {
  var rec = A.seen[z] || { at: [], legs: [] }, spec, tR, tB, pts = 0;
  tR = ms(function () { spec = atlasReveal(z); }, 3);
  (spec.paths || []).forEach(function (p) { pts += p.length; });
  tB = ms(function () { TnDMaps.scene.build(atlasDoc(z), "ink", { reveal: spec }); }, 1);
  say("  moves=" + moves + " stands=" + rec.at.length + " legs=" + rec.legs.length + " recordBytes=" + JSON.stringify(rec).length + " | atlasReveal=" + tR.toFixed(1) + "ms specBytes=" + JSON.stringify(spec).length + " pathPoints=" + pts + " | fogged scene.build=" + tB.toFixed(0) + "ms");
}
hr("T the capital: random walks between its named things (establishments, landmarks, grates — a building is entered, so the stand is its door)");
(function () {
  var S = H.start(false), A = S.A, c = S.c, T = S.T, things = once(atlasThings(c.town)).filter(function (t) { return !t.portal || !t.portal.to || t.portal.to.generator !== "region"; }), marks = [25, 50, 100, 200, 400, 800], i, m = 0;
  out("named things on the sheet", things.length + " (pairs: " + things.length * (things.length - 1) / 2 + ")");
  out("unfogged scene.build", ms(function () { TnDMaps.scene.build(c.town, "ink", {}); }).toFixed(0) + "ms");
  out("one TnDMaps.route on this sheet", ms(function () { TnDMaps.route(c.town, [c.inn.x, c.inn.y], [c.market.x, c.market.y]); }, 5).toFixed(2) + "ms");
  for (i = 1; i <= 800; i++) { H.point(T, pick(things).name); atlasFollow(); if (i === marks[m]) { row(A, c.townId, i); m++; } }
  out("zones opened on the way", Object.keys(A.zones).length); out("whole atlas bytes", JSON.stringify(A).length); out("of which seen", JSON.stringify(A.seen).length);
})();
hr("R the realm: random journeys between its settlements and caves");
(function () {
  var S = H.start(false), A = S.A, c = S.c, places = once([].concat(c.reg.places, c.reg.caves || [])), marks = [25, 50, 100, 200, 400], i, m = 0;
  out("named places", places.length + " (pairs: " + places.length * (places.length - 1) / 2 + ")");
  out("unfogged scene.build", ms(function () { TnDMaps.scene.build(c.reg, "ink", {}); }).toFixed(0) + "ms");
  out("one TnDMaps.route on this sheet", ms(function () { TnDMaps.route(c.reg, [c.p0.x, c.p0.y], [c.p1.x, c.p1.y]); }, 5).toFixed(2) + "ms");
  for (i = 1; i <= 400; i++) { H.point(pick(places).name, null); atlasFollow(); if (i === marks[m]) { row(A, A.seed, i); m++; } }
  out("zones opened on the way", Object.keys(A.zones).length); out("whole atlas bytes", JSON.stringify(A).length); out("of which seen", JSON.stringify(A.seen).length);
})();
