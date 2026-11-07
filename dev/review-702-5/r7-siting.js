// r7-siting.js — the fifth reviewer: where a thing invented OFF a home-sheet spot is drawn, HEAD vs the parent. The strip
// re-keys "[SUBLOCATION:<landmark> — <new stall>]" to the bare stall; the follow then re-stands the party from the world
// (A.spot null) and "beside the party" is the town's centre. Before the strip the walk stood at the landmark first. Use a
// landmark that is NOT at the centre.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

var S = H.start(), A = S.A, T = S.T, c = S.c, centre = atlasCentre(c.town), lms, lm, st, st2;
lms = c.town.landmarks.filter(function (l) { var f = atlasFind(c.town, l.name); return f && f.thing && !atlasLeads(A, c.townId, f.thing); }).map(function (l) { return { name: l.name, kind: l.kind, d: H.dist(l, { x: centre[0], y: centre[1] }) }; }).sort(function (a, b) { return b.d - a.d; });
out("spot landmarks by distance from the centre", lms.slice(0, 6));
lm = c.town.landmarks.filter(function (l) { return l.name === lms[0].name; })[0];

hr("R7a [SUBLOCATION:" + lm.name + "] then [SUBLOCATION:" + lm.name + " — Fishmonger's Stall]");
H.turn("[SUBLOCATION:" + lm.name + "] Here."); out("A.spot", A.spot); H.quiet();
H.turn("[SUBLOCATION:" + lm.name + SEP + "Fishmonger's Stall][LOCATION_DESC:STALL.]");
st = atlasDoc(c.townId).establishments.filter(function (e) { return e.name === "Fishmonger's Stall"; })[0];
out("sub", H.sub()); out("stall drawn", !!st); if (st) out("stall dist to the landmark / to the town centre", H.dist(st, lm).toFixed(1) + " / " + H.dist(st, { x: centre[0], y: centre[1] }).toFixed(1));
out("told", H.told(A)); out("toasts", H.toasts);

hr("R7b the same in ONE reply from the street: [SUBLOCATION:" + lm.name + "][SUBLOCATION:Cheese Stall]");
(function () {
  var S2 = H.start(), A2 = S2.A, c2 = S2.c, st2;
  H.quiet(); H.turn("[SUBLOCATION:" + lm.name + "][SUBLOCATION:Cheese Stall][LOCATION_DESC:CHEESE.]");
  st2 = atlasDoc(c2.townId).establishments.filter(function (e) { return e.name === "Cheese Stall"; })[0];
  out("sub", H.sub()); out("stall drawn", !!st2); if (st2) out("stall dist to the landmark / to the town centre", H.dist(st2, lm).toFixed(1) + " / " + H.dist(st2, { x: centre[0], y: centre[1] }).toFixed(1));
})();
