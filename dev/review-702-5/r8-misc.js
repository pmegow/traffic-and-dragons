// r8-misc.js — the fifth reviewer: (a) the strip's atlasLeads on a PEEKED home sheet — a town entered THIS reply by a
// [LOCATION:] with a spot-first pair in the same reply ("[LOCATION:<p1>][SUBLOCATION:<p1 market> — <p1 inn>]"): no report?
// (b) the tie refusal's words when the player taps the town's OWN place on the region for a sub-location; (c) a two-level
// peek route in atlasKeyFromPosition: the crypt's own ways, if the fixture crypt has one down; (d) the where-line after
// a growth and the party's spot.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("R8a [LOCATION:<p1>][SUBLOCATION:<p1 market> — <p1 inn>] in ONE reply — the home sheet is peeked when the key is read");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, t1doc, m1, i1, pos;
  t1doc = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, c.p1.id)); m1 = t1doc.landmarks.filter(function (l) { return l.kind === "market"; })[0]; i1 = t1doc.establishments.filter(function (e) { return e.kind === "inn"; })[0];
  out("p1 market / inn", [m1 && m1.name, i1 && i1.name]); out("p1 recorded before?", !!A.zones[A.seed + "/" + c.p1.id]);
  pos = atlasPosition(A, c.p1.name, m1.name + SEP + i1.name); out("position (peeked home): home / chain / zone / spot", [pos.home, pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name]);
  out("resolve the pair with the home peeked", resolvePlaceName(m1.name + SEP + i1.name, c.p1.name, { sub: null, fresh: false }));
  out("reports so far", H.reports);
  H.quiet(); H.turn("On to the next town and its inn. [LOCATION:" + c.p1.name + "][SUBLOCATION:" + m1.name + SEP + i1.name + "][LOCATION_DESC:INN.]");
  out("sub", H.sub()); out("A.at kind/via", [A.zones[A.at] && A.zones[A.at].kind, A.zones[A.at] && A.zones[A.at].via]); out("expected via", i1.id); out("reports", H.reports); out("off", A.off);
})();

hr("R8b the sub-location tie onto the party's OWN town's place on the region sheet (the trail lets the player open the region)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r;
  H.turn("[SUBLOCATION:Old Meg's Hut] A hut."); H.quiet(); r = atlasPlace(A.seed, { id: c.p0.id }); out("tap on the capital's own place for the hut", { ok: r.ok, reason: r.reason }); out("names", A.names);
})();

hr("R8c the fixture crypt's portals (is there a way further down for a two-level peek route?)");
(function () {
  var S = H.start(), A = S.A, c = S.c, tdoc, stair, crypt;
  tdoc = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, c.temple.id)); stair = tdoc.portals.filter(function (p) { return p.way === "down"; })[0]; crypt = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromInterior(tdoc, stair.id));
  out("crypt portals", crypt.portals.map(function (p) { return p.name + ":" + p.way + "->" + (p.to && p.to.generator); }));
  var sew = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromTown(c.town, c.grates[0].id)); out("sewer portals", sew.portals.map(function (p) { return p.name + ":" + p.way + "->" + (p.to && p.to.generator); }).slice(0, 12));
  var tower = c.town.landmarks.concat(c.town.establishments).filter(function (l) { return /Tower/.test(l.name); })[0]; if (tower) { var td = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, tower.id)), st2 = td.portals.filter(function (p) { return p.way === "down"; })[0]; var dg = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromInterior(td, st2.id)); out("tower dungeon portals", dg.portals.map(function (p) { return p.name + ":" + p.way + "->" + (p.to && p.to.generator); })); }
})();

hr("R8d two-level peek: [SUBLOCATION:<temple>][SUBLOCATION:<crypt stair> — <a crypt way that leads on> — Pit] in one reply, if the crypt has such a way");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, tdoc, stair, crypt, onward;
  tdoc = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, c.temple.id)); stair = tdoc.portals.filter(function (p) { return p.way === "down"; })[0]; crypt = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromInterior(tdoc, stair.id));
  onward = crypt.portals.filter(function (p) { return p.way !== "up" && p.way !== "out" && p.to && p.to.generator; })[0];
  if (!onward) { out("the fixture crypt has no onward way; the two-level peek route is not reachable here", null); return; }
  H.quiet(); H.turn("[SUBLOCATION:" + c.temple.name + "][SUBLOCATION:" + stair.name + SEP + onward.name + SEP + "Pit][LOCATION_DESC:PIT.]");
  out("sub", H.sub()); out("reports", H.reports); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind);
})();
