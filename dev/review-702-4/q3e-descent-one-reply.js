// q3e-descent-one-reply.js — the fourth reviewer: the case the by-title lookup was added for ("the crypt from the nave,
// never entered") when the TEMPLE itself is entered in the same reply: [SUBLOCATION:<temple>][SUBLOCATION:<crypt title> —
// Hall of Bones]. The chain zone (the temple) is peeked, not recorded; atlasChildByTitle is called without `know`.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

var S = H.start(), A = S.A, T = S.T, c = S.c, temple = c.temple, tdoc, stair, crypt, title;
tdoc = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, temple.id)); stair = (tdoc.portals || []).filter(function (p) { return p.way === "down"; })[0];
crypt = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromInterior(tdoc, stair.id)); title = crypt.title && crypt.title.name; out("crypt title", title);

hr("Q3e one reply: [SUBLOCATION:" + temple.name + "][SUBLOCATION:" + title + " — Hall of Bones] — the temple NOT entered before");
H.quiet(); H.turn("Down into the crypt. [SUBLOCATION:" + temple.name + "][SUBLOCATION:" + title + SEP + "Hall of Bones][LOCATION_DESC:BONES.]");
out("sub", H.sub()); out("nodes", H.nodesWith("Hall of Bones")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("A.at", A.at);
out("reports", H.reports); out("toasts", H.toasts);
out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }));

hr("Q3f the control: the temple entered in an earlier reply, then the same descent");
(function () {
  var S2 = H.start(), A2 = S2.A;
  H.turn("[SUBLOCATION:" + temple.name + "] In."); H.quiet(); H.turn("[SUBLOCATION:" + title + SEP + "Hall of Bones][LOCATION_DESC:BONES.]");
  out("sub", H.sub()); out("adds", Object.keys(A2.adds)); out("off", A2.off); out("A.at kind", A2.zones[A2.at] && A2.zones[A2.at].kind); out("reports", H.reports); out("toasts", H.toasts);
})();

hr("Q5d a growth with a trade placed AFTER the Spur (the Spur at s1, the site that grows at room 1)");
(function () {
  var S3 = H.start(), A3 = S3.A, c3 = S3.c, sz, fz, ed, i, grewAt = 0, before, after, est, fpB, fpA;
  function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }
  H.turn("[SUBLOCATION:" + c3.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A3.at; ed = edits(A3, c3.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c3.market.name + "] Back."); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); fz = A3.at; est = function () { return atlasDoc(c3.townId).establishments.filter(function (e) { return e.name === "Harl's Forge"; })[0]; };
  before = est(); fpB = atlasFingerprint(atlasDoc(fz)); out("forge before", { b: before.building, x: before.x, y: before.y }); out("spur before", (function () { var e = atlasDoc(c3.townId).establishments.filter(function (x) { return x.name === "The Gilded Spur"; })[0]; return { b: e.building, x: e.x, y: e.y, fp: ed.footprint }; })());
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Gilded Spur] In again.");
  for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
  out("grew at", grewAt); after = est(); fpA = atlasFingerprint(atlasDoc(fz)); out("forge after", { b: after.building, x: after.x, y: after.y }); out("forge moved?", before.building !== after.building || before.x !== after.x || before.y !== after.y); out("forge interior redrawn?", fpB !== fpA);
  try { out("forge zone params seed ok", atlasZoneParams(A3, fz).seed === fz); } catch (e) { out("forge zone params THROWS", e.message); }
  out("spur after", (function () { var e = atlasDoc(c3.townId).establishments.filter(function (x) { return x.name === "The Gilded Spur"; })[0]; return { b: e.building, x: e.x, y: e.y, fp: ed.footprint }; })());
  out("told", H.told(A3)); out("redrawn", { town: !!A3.zones[c3.townId].redrawn, house: !!A3.zones[sz].redrawn, forge: !!A3.zones[fz].redrawn });
})();
