// p11-straight-ways-indoors.js — room by room, a walked way is SAMPLED for the rooms it crosses. When the library has
// no way along the doors (it answers "straight", or the engine's own fallback draws [[a,b]]), the straight line between
// two rooms is sampled too — across walls, and across the FLOOR SLOTS of a building's sheet (the library's own warning:
// "reveal paths, not points, or the jump between the slots would reveal the floors in between").
//  I1 every pair of rooms of the fixture inn and of each building of the capital: how often is the way "straight", and
//     how many rooms does the fog then show that are neither end?
//  I2 rooms the engine ADDS (adoption) in an added house: are they joined by doors? What does the fog show after a walk
//     between two of them, and between one of them and a generated room?
// node dev/review-717/p11-straight-ways-indoors.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
hr("I1 generated buildings of the capital: room pairs whose way is not along the doors");
(function () {
  var S = H.start(false), c = S.c, tot = 0, straight = 0, why = {}, worst = null;
  c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }).forEach(function (p) {
    var d = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, p.id)), i, j, r, extra;
    for (i = 0; i < d.rooms.length; i++) for (j = i + 1; j < d.rooms.length; j++) {
      tot++; r = TnDMaps.route(d, [d.rooms[i].x, d.rooms[i].y], [d.rooms[j].x, d.rooms[j].y]);
      if (r.via !== "straight") continue;
      straight++; why[r.why] = (why[r.why] || 0) + 1;
      extra = atlasRevealRooms(d, ATLAS_FOG.interior, [{ key: "t:" + d.rooms[i].id, xy: [d.rooms[i].x, d.rooms[i].y] }, { key: "t:" + d.rooms[j].id, xy: [d.rooms[j].x, d.rooms[j].y] }], r.paths).filter(function (id) { return id !== d.rooms[i].id && id !== d.rooms[j].id; });
      if (!worst || extra.length > worst.extra.length) worst = { building: p.name, from: d.rooms[i].name + "@f" + d.rooms[i].floor, to: d.rooms[j].name + "@f" + d.rooms[j].floor, why: r.why, extra: extra };
    }
  });
  out("room pairs", tot); out("straight", straight); out("reasons", why); out("worst case (rooms shown that are neither end)", worst);
})();
hr("I2 rooms the engine adds: an added tavern, three invented rooms, then a generated one");
(function () {
  var S = H.start(true), A = S.A, c = S.c, sz, d, rec, gen, shown, named = [], r;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] A tavern the map lacks."); sz = A.at;
  ["Back Room", "Wine Cellar", "Counting Room"].forEach(function (n) { H.turn("[SUBLOCATION:" + n + "] Invented."); named.push(A.spot); });
  d = atlasDoc(sz); gen = H.onceRooms(d).filter(function (q) { return named.indexOf(q.id) < 0; })[0];
  H.turn("[SUBLOCATION:" + gen.name + "] A room the house has."); named.push(A.spot);
  d = atlasDoc(sz); rec = H.plain(A.seen[sz]); out("rooms of the house", d.rooms.map(function (q) { return q.id + "=" + q.name + "@f" + q.floor; }));
  out("doors", d.doors.map(function (q) { return q.rooms.join("|"); }));
  out("record", rec);
  rec.legs.forEach(function (l) { r = TnDMaps.route(d, atlasSeenXY(A, sz, d, l[0]), atlasSeenXY(A, sz, d, l[1])); out("leg " + l.join(" <-> "), { via: r.via, why: r.why || null, paths: r.paths.length }); });
  shown = atlasReveal(sz); out("the fog shows", shown); out("rooms the party stood in", named);
  out("shown but never stood in", shown.filter(function (id) { return named.indexOf(id) < 0; }).map(function (id) { var q = d.rooms.filter(function (x) { return x.id === id; })[0]; return id + (q ? "=" + q.name + "@f" + q.floor : ""); }));
  out("toasts", H.toasts.filter(function (t) { return /way between/.test(t); })); out("reports", H.reports);
})();
