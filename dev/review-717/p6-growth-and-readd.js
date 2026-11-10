// p6-growth-and-readd.js — does the visit record keep a key that no longer MEANS the same thing?
//  G1 a house the engine added grows (atlasGrowHouse) after the party stood in its generated rooms: what do the recorded
//     ids name before and after, and what does the fog show of the grown house (rooms the party never entered)?
//  G2 an addition put away by the tap and another place added under the SAME id (atlasAddId reuses the lowest free one).
//  G3 a village added to the realm: do the roads between OLD towns re-route, so an old leg now reveals other ground?
// node dev/review-717/p6-growth-and-readd.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
function nameOf(doc, k) { var t = atlasThingById(doc, k.slice(2)); return t ? t.name : "(gone)"; }
function shown(z) { var ids = atlasReveal(z), doc = atlasDoc(z); return (ids || []).map(function (id) { var r = (doc.rooms || []).filter(function (q) { return q.id === id; })[0]; return id + "=" + (r ? r.name : "(passage)"); }); }

hr("G1 growth under a record");
(function () {
  var S = H.start(true), A = S.A, c = S.c, sz, before, after, i, grew = 0, ed, gens, visited = [], docB, docA, rec;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; docB = atlasDoc(sz);
  ed = A.zones[c.townId].params.edits.filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  out("the medium house's rooms", docB.rooms.map(function (r) { return r.id + "=" + r.name + "@f" + r.floor; }));
  gens = H.onceRooms(docB).slice(0, 3);
  gens.forEach(function (g) { H.turn("[SUBLOCATION:" + g.name + "] A room of the house."); visited.push(A.spot + "=" + g.name); });
  out("visited (spot=name)", visited); rec = H.plain(A.seen[sz]); out("record before growth", rec);
  before = rec.at.map(function (k) { return k + " -> " + nameOf(docB, k); }); out("fog shows before", shown(sz));
  for (i = 1; i <= 10 && !grew; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grew = i; }
  out("grew at invented room", grew); out("toast", H.toasts.filter(function (t) { return /larger/.test(t); }));
  docA = atlasDoc(sz); out("the large house's rooms", docA.rooms.map(function (r) { return r.id + "=" + r.name + "@f" + r.floor; }));
  after = H.plain(A.seen[sz]).at.map(function (k) { return k + " -> " + nameOf(docA, k); });
  out("record keys before growth", before); out("the SAME keys after growth", after);
  out("fog shows after (rooms listed here that the party never named = shown unvisited)", shown(sz));
  out("a recorded key now names ANOTHER room", before.filter(function (b, j) { return after[j] !== undefined && after[j] !== b; }));
})();

hr("G2 an addition removed by the tap, another added under the same id");
(function () {
  var S = H.start(true), A = S.A, c = S.c, id1, id2, r, town;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Old Shrine of Vael] A shrine the map lacks."); id1 = A.spot || (A.zones[A.at].via);
  out("after the first addition: at/spot", [A.zones[A.at].kind, A.spot, id1]); out("town record", H.seen(A, c.townId));
  H.turn("[SUBLOCATION:" + c.inn.name + "] To the inn (a leg from the addition).");
  out("town record", H.seen(A, c.townId));
  worldState.world.sublocation = "Old Shrine of Vael"; atlasFollow();
  r = atlasPlace(c.townId, { id: c.temple ? c.temple.id : c.market.id }); out("the tap that puts the addition away", { ok: r.ok, reason: r.reason });
  out("town record after the removal", H.seen(A, c.townId)); out("edits left", (A.zones[c.townId].params.edits || []).map(function (e) { return e.id + "=" + e.name; }));
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Well of Tears] ANOTHER place the map lacks."); id2 = A.spot || A.zones[A.at].via;
  town = atlasDoc(c.townId);
  out("the second addition's id", id2 + " (first was " + id1 + ")"); out("town record", H.seen(A, c.townId));
  out("stale keys naming the reused id", (A.seen[c.townId].legs || []).filter(function (l) { return l.indexOf("t:" + id2) >= 0; }).map(function (l) { return l.map(function (k) { return nameOf(town, k); }).join(" <-> "); }));
})();

hr("G3 a village added to the realm: the old road between two old towns, before and after");
(function () {
  var S = H.start(true), A = S.A, c = S.c, r0, r1, reg0 = c.reg, reg1, same;
  H.turn("[LOCATION:" + c.p1.name + "]"); r0 = atlasReveal(A.seed);
  H.turn("[LOCATION:Thistlewick Hollow] A village the map lacks."); reg1 = atlasDoc(A.seed);
  H.turn("[LOCATION:" + c.p1.name + "]");
  r1 = atlasReveal(A.seed);
  out("legs on the realm", H.seen(A, A.seed).legs);
  same = JSON.stringify(TnDMaps.route(reg0, [c.p0.x, c.p0.y], [c.p1.x, c.p1.y]).paths) === JSON.stringify(TnDMaps.route(reg1, [c.p0.x, c.p0.y], [c.p1.x, c.p1.y]).paths);
  out("the p0-p1 road is routed the same after the addition", same);
  out("roads before / after", [reg0.roads.length, reg1.roads.length]);
  out("old places moved?", reg0.places.filter(function (p) { var q = reg1.places.filter(function (x) { return x.id === p.id; })[0]; return !q || q.x !== p.x || q.y !== p.y; }).map(function (p) { return p.name; }));
})();
