// p12-bridge-and-inherit.js — two claims the #717 groups assert only vacuously (mutants MU1 and MU2 live), checked here
// on the REAL code:
//  B  "no leg bridges a stretch off the map": p0 -> p1 -> a place off the map -> p2. The suite walks back to p0, whose
//     leg to p1 is on record already, so a bridge could not show. Here the third town is new.
//  N  "the sheet behind an addition is forgotten with it": the suite's added tavern holds NO record when it is put away
//     (the party stood 'somewhere' in it), so the assertion passes with or without the delete. Here the party stands in
//     its rooms first, the tap puts it away, and ANOTHER place is added under the same id: does it inherit the rooms?
// node dev/review-717/p12-bridge-and-inherit.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
hr("B off the map between two towns");
(function () {
  var S = H.start(false), A = S.A, c = S.c, p2 = c.reg.places[2];
  H.turn("[LOCATION:" + c.p1.name + "]"); H.turn("[LOCATION:Nowhere The Map Knows]"); H.turn("[LOCATION:" + p2.name + "]");
  out("realm record", H.seen(A, A.seed)); out("a leg p1<->p2 (a bridge over the unknown stretch)", A.seen[A.seed].legs.some(function (l) { return l.indexOf("t:" + c.p1.id) >= 0 && l.indexOf("t:" + p2.id) >= 0; }));
})();
hr("N an addition with a record of its own, put away, and its id reused");
(function () {
  var S = H.start(true), A = S.A, c = S.c, z1, id1, rooms, r, z2, id2;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] A tavern the map lacks."); z1 = A.at; id1 = A.zones[z1].via;
  rooms = H.onceRooms(atlasDoc(z1)).slice(0, 2); rooms.forEach(function (q) { H.turn("[SUBLOCATION:" + q.name + "]"); });
  out("the tavern's zone / id", [z1, id1]); out("its own record before it is put away", H.seen(A, z1));
  H.turn("[SUBLOCATION:The Gilded Spur]");
  r = atlasPlace(c.townId, { id: c.inn.id }); out("the tap that puts it away", { ok: r.ok, reason: r.reason }); out("zone gone", !A.zones[z1]); out("its record gone", !A.seen[z1]);
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Painted Stag] ANOTHER tavern the map lacks."); z2 = A.at; id2 = A.zones[z2] && A.zones[z2].via;
  out("the next addition's zone / id", [z2, id2]); out("same zone id as the first", z2 === z1); out("its record on arrival", H.seen(A, z2)); out("its fog on arrival", atlasReveal(z2));
})();
