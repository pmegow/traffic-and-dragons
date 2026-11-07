// q3-peek-throw.js — the fourth reviewer: atlasKeyFromPosition's by-title lookup (and the older way-in lookup beside it)
// call atlasChildByTitle / atlasLeads WITHOUT the position's `know`/`sheet` adapters. When the chain holds a PEEKED zone
// (a building entered in THIS reply, not yet recorded), does the lookup throw on atlasRecipe? What does the resolver then
// do with the name?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function interiorOf(S, portalId) { return TnDMaps.generate("interior", TnDMaps.interior.fromTown(S.c.town, portalId)); }
function downsOf(doc) { return (doc.portals || []).filter(function (p) { return p.way === "down"; }).map(function (p) { return p.name + "#" + p.id; }); }

hr("Q3 which fixture buildings carry a way DOWN (a dungeon beneath an interior)?");
var S0 = H.start(), withDown = [];
S0.c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }).forEach(function (p) { var d = interiorOf(S0, p.id), ds = downsOf(d); if (ds.length) withDown.push(p.name + " -> " + ds.join(", ")); });
out("buildings with a way down", withDown);

hr("Q3a one reply: [SUBLOCATION:<temple>][SUBLOCATION:Scullery — Larder] — the temple NOT entered before (a peeked chain zone), an unknown first segment");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, temple = c.temple;
  H.quiet(); H.turn("Into the temple and through. [SUBLOCATION:" + temple.name + "][SUBLOCATION:Scullery" + SEP + "Larder][LOCATION_DESC:L1.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Larder").concat(H.nodesWith("Scullery"))); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind);
  out("reports (reportError)", H.reports); out("warns", H.warns.filter(function (w) { return /atlas/.test(w); })); out("toasts", H.toasts);
  out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }));
})();

hr("Q3b the same with the temple ENTERED first (a recorded chain zone) — the control");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, temple = c.temple;
  H.turn("[SUBLOCATION:" + temple.name + "] In."); H.quiet(); H.turn("[SUBLOCATION:Scullery" + SEP + "Larder][LOCATION_DESC:L1.]");
  out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("reports", H.reports); out("toasts", H.toasts);
})();

hr("Q3c one reply: [SUBLOCATION:<temple>][SUBLOCATION:<crypt stair> — Hall of Bones] — a FOUND portal segment on a peeked chain zone (the older lookup at the same site)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, temple = c.temple, d = interiorOf(S, temple.id), stair = (d.portals || []).filter(function (p) { return p.way === "down"; })[0];
  out("stair", stair && stair.name);
  H.quiet(); H.turn("Down. [SUBLOCATION:" + temple.name + "][SUBLOCATION:" + stair.name + SEP + "Hall of Bones][LOCATION_DESC:HB.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Hall of Bones")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("reports", H.reports); out("toasts", H.toasts);
})();

hr("Q3d a second failure in the same campaign is said on the console only (atlasOnce) — what does the player see the second time?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, temple = c.temple;
  H.quiet(); H.turn("[SUBLOCATION:" + temple.name + "][SUBLOCATION:Scullery" + SEP + "Larder]"); out("first: reports", H.reports.length + " toasts " + JSON.stringify(H.toasts));
  H.turn("[SUBLOCATION_LEAVE]"); H.quiet(); H.turn("[SUBLOCATION:" + c.inn.name + "][SUBLOCATION:Vestry" + SEP + "Nook]"); out("second (inn, same reply): sub", H.sub()); out("reports", H.reports.length + " toasts " + JSON.stringify(H.toasts)); out("warns", H.warns.filter(function (w) { return /atlas/.test(w); }));
})();
