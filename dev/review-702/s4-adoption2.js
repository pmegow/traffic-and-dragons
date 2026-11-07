// s4-adoption2.js — part A continued: the shared adds key of a pair with a new building; the tap on that key; a town-level
// addition that bears a room's name poisons rule (a); the 'at' tie's A.adds; a sub-location invented while off the map.
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("A12 the pair with a NEW building and an unknown room: [SUBLOCATION:The Rat-Catcher's Rest — Snug]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, iz, res;
  H.quiet(); H.turn("Into the inn's snug. [SUBLOCATION:The Rat-Catcher's Rest" + SEP + "Snug][LOCATION_DESC:THE SNUG.]");
  out("sub", H.sub()); iz = A.at; out("A.at", A.at + " kind=" + (A.zones[A.at] && A.zones[A.at].kind) + " spot=" + A.spot); out("off", A.off);
  out("adds", JSON.stringify(A.adds)); out("told", H.told(A)); out("inn rooms", A.zones[iz] && A.zones[iz].kind === "interior" ? atlasDoc(iz).rooms.map(function (r) { return r.name; }) : null);
  out("Snug on the inn's sheet?", A.zones[iz] && A.zones[iz].kind === "interior" ? !!atlasFind(atlasDoc(iz), "Snug") : null);
  /* the player taps We are here for the pointer's place (level sub, name 'The Rat-Catcher's Rest — Snug') onto the mapped inn's room: what is removed? */
  var innZ = c.townId + "/" + c.inn.id; H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.inn.name + "]"); var innDoc = atlasDoc(innZ), room = innDoc.rooms.filter(function (r) { return atlasFind(innDoc, r.name) && atlasFind(innDoc, r.name).thing; })[0];
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Rat-Catcher's Rest" + SEP + "Snug] Back to the snug."); out("preview", atlasPlacePreview());
  H.quiet(); res = atlasPlace(innZ, { id: room.id }); out("tap", { ok: res.ok, at: res.at, bound: res.bound, level: res.level, reason: res.reason });
  out("Rest still on the town sheet?", !!atlasFind(atlasDoc(c.townId), "The Rat-Catcher's Rest")); out("zones", Object.keys(A.zones)); out("adds", JSON.stringify(A.adds)); out("names", A.names); out("infos", H.infos.filter(function (i) { return /atlas/.test(i); }));
})();

hr("A13 a town-level addition that bears a ROOM's name poisons rule (a): every building's room of that name files bare");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, r = S.r;
  /* the GM names a room from the street (the accepted limit): it becomes a town-level place */
  H.quiet(); H.turn("Round the back, into a kitchen. [SUBLOCATION:" + r.room + "][LOCATION_DESC:A STREET KITCHEN.]"); out("sub", H.sub()); out("town gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; }));
  /* now two inns' rooms of that name */
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + r.a + "] In a."); H.quiet(); H.turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:A's ROOM.] In."); out("sub in a", H.sub()); out("resolve", resolvePlaceName(r.room, T, { sub: r.a }));
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + r.b + "] In b."); H.quiet(); H.turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:B's ROOM.] In."); out("sub in b", H.sub());
  out("nodes with the room name", H.nodesWith(r.room)); out("geo in b mentions A's ROOM", buildGeoBlock().indexOf("A's ROOM") >= 0); out("geo in b mentions STREET KITCHEN", buildGeoBlock().indexOf("STREET KITCHEN") >= 0);
})();

hr("A14 a sub-location invented while the WORLD is off the map (adoption refused for the world): where does the sub go?");
(function () {
  var real = TnDMaps.wild.fromRegion, S = H.start(), A = S.A, c = S.c;
  TnDMaps.wild.fromRegion = function () { throw new Error("TnDMaps: that point lies in the sea — {}"); };
  try { H.quiet(); H.turn("[LOCATION:The Salt Flats] Out of the realm."); out("off", A.off); H.turn("[SUBLOCATION:Camp] A fire."); out("sub", H.sub()); out("off", A.off); out("adds", Object.keys(A.adds)); out("A.at", A.at); out("where", atlasWhere().text); } finally { TnDMaps.wild.fromRegion = real; }
})();

hr("A15 the 'at' tie made by the GM: A.adds untouched, atlasTiesHere says it; the GM's at on a thing the sheet bears twice");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, r = S.r, innDoc, twice;
  H.turn("[SUBLOCATION:" + r.twice.in + "] In."); innDoc = atlasDoc(A.at); twice = r.twice.room;
  H.quiet(); H.turn("[SUBLOCATION:The Snug][MAP_PLACE:The Snug|at " + twice + "] A snug."); out("sub", H.sub()); out("told", H.told(A)); out("names", A.names); out("adds", Object.keys(A.adds));
  /* the GM's at on a landmark of the TOWN from inside a building: a tie onto the town's sheet for a sub? */
  H.turn("[SUBLOCATION_LEAVE]"); H.quiet(); H.turn("[SUBLOCATION:The Fountain of Kings][MAP_PLACE:The Fountain of Kings|at " + c.market.name + "] By the fountain."); out("sub", H.sub()); out("names", A.names); out("A.at/spot", A.at + "/" + A.spot); out("where", atlasWhere().text); out("told", H.told(A));
})();

hr("A16 performance: a reply that adds a village (region redraw) and one that adds a room");
(function () {
  var S = H.start(), A = S.A, c = S.c, t0, t1;
  t0 = Date.now(); H.turn("[LOCATION:Bleakford] A hamlet."); t1 = Date.now(); out("village add turn ms", t1 - t0);
  t0 = Date.now(); H.turn("[LOCATION:" + c.p0.name + "]"); out("plain move back ms", Date.now() - t0);
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); t0 = Date.now(); H.turn("[SUBLOCATION:The Still Room] Behind."); out("room add turn ms", Date.now() - t0);
  t0 = Date.now(); H.turn("[SUBLOCATION:" + c.inn.name + "] Back out."); out("plain room move ms", Date.now() - t0);
  t0 = Date.now(); H.turn("[LOCATION:Thornwick] A second hamlet."); out("second village add turn ms", Date.now() - t0);
})();
