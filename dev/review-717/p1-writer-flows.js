// p1-writer-flows.js — shows what atlasTread records (A.seen) after each REAL turn across the ways a party moves:
// bare sub, pair form, LEAVE, one-reply world+building+room, a world move from inside a room, off the map and back,
// adoption on. Prints the record per sheet after every turn so a stand the party never had / a missing leg can be seen.
// node dev/review-717/p1-writer-flows.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out, SEP = H.SEP;
function names(A, z) {
  var doc = atlasDoc(z), rec = A.seen && A.seen[z]; if (!rec) return null;
  function nm(k) { var t = k.charAt(0) === "t" ? atlasThingById(doc, k.slice(2)) : null; return t ? t.name + "#" + t.id : k; }
  return { at: rec.at.map(nm), legs: rec.legs.map(function (l) { return nm(l[0]) + " <-> " + nm(l[1]); }) };
}
function dump(A, label) {
  say("  -- " + label + "  [loc=" + worldState.world.location + " | sub=" + worldState.world.sublocation + "]  at=" + (A.at ? (A.zones[A.at].name + "(" + A.zones[A.at].kind + ")") : null) + " spot=" + A.spot + " off=" + (A.off ? JSON.stringify({ n: A.off.name, within: A.off.within || null }) : null));
  Object.keys(A.seen || {}).forEach(function (z) { say("       seen[" + (A.zones[z] ? A.zones[z].name + "/" + A.zones[z].kind : "GONE:" + z) + "] " + JSON.stringify(names(A, z))); });
}

hr("F1 adopt OFF: inn by name, a room, the pair form to another floor, LEAVE, market, second inn's room in one reply");
(function () {
  var S = H.start(false), A = S.A, c = S.c, T = S.T, idoc, rooms, i2doc, rooms2;
  dump(A, "start in " + T);
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); dump(A, "into the inn by name");
  idoc = atlasDoc(A.at); rooms = H.onceRooms(idoc);
  H.turn("[SUBLOCATION:" + rooms[0].name + "] A room."); dump(A, "bare room " + rooms[0].name);
  H.turn("[SUBLOCATION:" + c.inn.name + SEP + rooms[1].name + "] Another."); dump(A, "pair form room " + rooms[1].name);
  H.turn("[SUBLOCATION_LEAVE] Out to the street."); dump(A, "SUBLOCATION_LEAVE");
  H.turn("[SUBLOCATION:" + c.market.name + "] The square."); dump(A, "market after a LEAVE (is the inn->market street a leg?)");
  H.turn("[SUBLOCATION:" + c.inn.name + "] Back in."); dump(A, "market -> inn directly");
  if (c.inns[1]) {
    i2doc = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, c.inns[1].id)); rooms2 = H.onceRooms(i2doc);
    H.turn("[SUBLOCATION:" + c.inns[1].name + SEP + rooms2[0].name + "] Across town into a room."); dump(A, "inn1 -> inn2's room in ONE reply (pair)");
  }
  H.turn("Off to the next town. [LOCATION:" + c.p1.name + "]"); dump(A, "world move from inside a room");
  H.turn("[LOCATION:Nowhere The Map Knows]"); dump(A, "off the map (adopt off)");
  H.turn("[LOCATION:" + c.p0.name + "]"); dump(A, "back onto the map: p0 (no leg should bridge)");
  out("toasts", H.toasts); out("reports", H.reports);
})();

hr("F2 adopt ON: an unknown tavern from the market, its invented rooms, an unknown village, world+building+room in one reply");
(function () {
  var S = H.start(true), A = S.A, c = S.c, T = S.T, t1doc, i1, r1;
  H.turn("[SUBLOCATION:" + c.market.name + "] Square."); dump(A, "market");
  H.turn("[SUBLOCATION:The Gilded Spur] A tavern the map lacks."); dump(A, "added tavern");
  H.turn("[SUBLOCATION:Back Room] A room the map lacks."); dump(A, "invented room in it");
  H.turn("[SUBLOCATION:Wine Cellar] Another."); dump(A, "second invented room");
  H.turn("[LOCATION:Thistlewick Hollow] A village the map lacks."); dump(A, "added village (world)");
  t1doc = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, c.p1.id)); i1 = t1doc.establishments.filter(function (e) { return e.kind === "inn"; })[0];
  r1 = H.onceRooms(TnDMaps.generate("interior", TnDMaps.interior.fromTown(t1doc, i1.id)))[0];
  H.turn("On. [LOCATION:" + c.p1.name + "][SUBLOCATION:" + i1.name + SEP + r1.name + "]"); dump(A, "world + building + room in ONE reply");
  out("toasts", H.toasts); out("reports", H.reports);
})();

hr("F3 the sewer: down a grate, a deep chamber, up ANOTHER grate (the walk under the town)");
(function () {
  var S = H.start(false), A = S.A, c = S.c, sdoc, ups, deep, other;
  H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); dump(A, "down grate 0"); sdoc = atlasDoc(A.at);
  ups = sdoc.portals.filter(function (p) { return p.way === "up"; });
  deep = sdoc.rooms.filter(function (r) { return !ups.some(function (u) { return u.id === r.id; }) && sdoc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !atlasFind(c.town, r.name); })[0];
  H.turn("[SUBLOCATION:" + deep.name + "] Deep."); dump(A, "deep chamber " + deep.name);
  other = c.grates[1];
  H.turn("[SUBLOCATION:" + other.name + "] Up another grate?"); dump(A, "naming grate 1 from below");
  H.turn("[SUBLOCATION_LEAVE]"); dump(A, "LEAVE from below");
  out("toasts", H.toasts); out("reports", H.reports);
})();
