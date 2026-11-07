// q2-landmark-pair.js — the fourth reviewer: a pair whose FIRST segment is a SPOT of the home sheet (a landmark), not a
// way in: "[SUBLOCATION:<market> — <inn>]". The position reader ends its walk at a spot; the follow walks past it. Does
// the key carry the spot? Where do the rooms named afterwards file?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("Q2a [SUBLOCATION:<market> — <inn>] then [SUBLOCATION:Kitchen] next reply");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, pos;
  H.quiet(); H.turn("The inn off the square. [SUBLOCATION:" + c.market.name + SEP + c.inn.name + "][LOCATION_DESC:INN ONE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith(c.inn.name)); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("A.at/spot", A.at + "/" + A.spot);
  pos = atlasPosition(A, T, H.sub()); out("position chain/zone/spot/used", [pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name, pos.used]);
  H.quiet(); H.turn("Through to the kitchen. [SUBLOCATION:Kitchen][LOCATION_DESC:KITCHEN ONE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Kitchen")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind);
  out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }));
  out("toasts", H.toasts); out("where", atlasWhere().text);
  H.quiet(); H.turn("[SUBLOCATION:" + c.inn.name + "] Back to the common room."); out("sub", H.sub()); out("nodes with inn", H.nodesWith(c.inn.name)); out("geo has INN ONE", buildGeoBlock().indexOf("INN ONE") >= 0);
})();

hr("Q2b [SUBLOCATION:<market> — Fishmonger's Stall] (an invented stall off the square) then [SUBLOCATION:Fishmonger's Stall]");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:" + c.market.name + SEP + "Fishmonger's Stall][LOCATION_DESC:STALL ONE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Stall")); out("adds", Object.keys(A.adds)); out("off", A.off); out("toasts", H.toasts);
  H.quiet(); H.turn("[SUBLOCATION:Fishmonger's Stall][LOCATION_DESC:STALL TWO.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Stall")); out("adds", Object.keys(A.adds)); out("off", A.off); out("geo has STALL ONE", buildGeoBlock().indexOf("STALL ONE") >= 0);
  out("preview", atlasPlacePreview()); out("add under the preview's key?", !!A.adds[T + "|" + H.sub()]);
})();

hr("Q2c control: [SUBLOCATION:<inn> — Kitchen] (the taught pair) then [SUBLOCATION:Pantry]");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:" + c.inn.name + SEP + "Kitchen][LOCATION_DESC:K.]"); out("sub", H.sub());
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:P.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds));
})();
