// s10-tap-self.js — the player confirms "We are here" ON the very thing the engine added; a tie inside an addition; where
// 'between' really lands; the 'at' tie's wording to the player and the GM.
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("T1 the player taps We are here on the added forge's own door (the card the pane shows for the party's place)");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, e, card, res;
  H.turn("[SUBLOCATION:Harl's Forge][LOCATION_DESC:A smithy.] In."); e = atlasDoc(c.townId).establishments.filter(function (x) { return x.name === "Harl's Forge"; })[0];
  card = atlasCard(c.townId, { id: e.id }); out("card offers a place to tie", card.place); out("partyHere", card.partyHere);
  H.quiet(); res = atlasPlace(c.townId, { id: e.id }); out("tap", { ok: res.ok, at: res.at, spot: res.spot, off: res.off, bound: res.bound, level: res.level, reason: res.reason });
  out("names", A.names); out("adds", JSON.stringify(A.adds)); out("forge still on the sheet?", !!atlasFind(atlasDoc(c.townId), "Harl's Forge")); out("zones", Object.keys(A.zones));
  out("A.at/spot/off", A.at + " / " + A.spot + " / " + JSON.stringify(A.off)); out("toasts", H.toasts); out("reports", H.reports); out("where", atlasWhere().text);
  /* the next turns: the story stays in the forge, then names a room */
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge] Still in the smithy."); out("next turn off", A.off); out("reports", H.reports); out("heal", atlasHeal() + " names=" + JSON.stringify(A.names));
  H.quiet(); H.turn("[SUBLOCATION:Forge] At the anvil."); out("sub", H.sub()); out("off", A.off); out("reports", H.reports); out("map block where", atlasMapBlock().split("\n")[1].slice(0, 300));
  /* a second tap, this time on a mapped inn, as the correction */
  H.quiet(); res = atlasPlace(c.townId, { id: c.inn.id }); out("second tap", { ok: res.ok, at: res.at, reason: res.reason, bound: res.bound, level: res.level }); out("off", A.off);
})();

hr("T2 a tie INSIDE an added house keeps the house when the house is placed elsewhere");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, hz, room, res;
  H.turn("[SUBLOCATION:The Bear's Lodge] A big inn."); hz = A.at; room = atlasDoc(hz).rooms.filter(function (r) { return atlasFind(atlasDoc(hz), r.name) && atlasFind(atlasDoc(hz), r.name).thing; })[0];
  H.turn("[SUBLOCATION:The Red Room] A room."); res = atlasPlace(hz, { id: room.id }); out("tie the invented room to a drawn room", { ok: res.ok, level: res.level, bound: res.bound, reason: res.reason }); out("names", A.names);
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Bear's Lodge] Back at the door."); H.quiet(); res = atlasPlace(c.townId, { id: c.inn.id }); out("tap the lodge onto the mapped inn", { ok: res.ok, at: res.at, level: res.level, bound: res.bound });
  out("lodge still on the sheet", !!atlasFind(atlasDoc(c.townId), "The Bear's Lodge")); out("infos", H.infos.filter(function (i) { return /stays on the map/.test(i); })); out("names", A.names); out("adds", Object.keys(A.adds));
})();

hr("T3 where 'between' really lands: the midpoint vs the point chosen (atlasRegionPoints around the midpoint)");
(function () {
  var S = H.start(), A = S.A, c = S.c, reg = c.reg, p2 = reg.places[2], p3 = reg.places[3], mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 }, added;
  H.quiet(); H.turn("[LOCATION:Ashford][MAP_PLACE:Ashford|between " + p2.name + " and " + p3.name + "]");
  added = atlasDoc(A.seed).places.filter(function (p) { return p.name === "Ashford"; })[0];
  out("p2-p3 distance", Math.round(H.dist(p2, p3))); out("added to midpoint", added ? Math.round(H.dist(added, mid)) : null); out("added to capital", added ? Math.round(H.dist(added, c.p0)) : null); out("midpoint to capital", Math.round(H.dist(mid, c.p0)));
  out("told", H.told(A));
})();

hr("T4 the GM's 'at' tie: what the player reads in the pane and the GM on the where-line afterwards");
(function () {
  var S = H.start(), A = S.A, c = S.c;
  H.quiet(); H.turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + c.p1.name + "]");
  out("told (this turn)", H.told(A)); out("where-line (every turn after)", atlasWhere().text); out("ties", atlasWhere().ties);
  H.turn("You rest."); out("told next turn", atlasToldLines(A)); H.turn("You rest again."); out("told two turns on", atlasToldLines(A)); out("where-line still", atlasWhere().text);
})();
