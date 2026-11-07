// q1-restate.js — the fourth reviewer: the fresh path's re-statement guard after finding 1's fix. The guard compares X
// with the LAST unknown segment; the container is now the FIRST. Two questions: (a) the invented building re-stated as a
// third tag ("back to the door") — is it keyed "Spur — Spur"? (b) the room re-stated as a third tag — does it fall to a
// bare town-wide name and get ADDED at the town's level?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("Q1a [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:The Gilded Spur] — back to the door of the invented building, same reply");
(function () {
  var S = H.start(), A = S.A, T = S.T;
  H.quiet(); H.turn("In, to the kitchen, and back to the door. [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:The Gilded Spur][LOCATION_DESC:THE DOOR, AGAIN.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("resolve 'The Gilded Spur' at sub 'The Gilded Spur — Kitchen' fresh", resolvePlaceName("The Gilded Spur", T, { sub: "The Gilded Spur" + SEP + "Kitchen", fresh: true }));
  out("told", H.told(A)); out("toasts", H.toasts);
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][LOCATION_DESC:THE DOOR, THRICE.] Still at the door.");
  out("sub next reply", H.sub()); out("nodes", H.nodesWith("Spur")); out("geo has AGAIN", buildGeoBlock().indexOf("THE DOOR, AGAIN") >= 0);
})();

hr("Q1b [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Kitchen] — the room re-stated as a third tag, same reply");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("In, to the kitchen, and the kitchen once more. [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Kitchen][LOCATION_DESC:THE KITCHEN, TWICE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Kitchen").concat(H.nodesWith("Spur"))); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("resolve 'Kitchen' at sub 'The Gilded Spur — Kitchen' fresh", resolvePlaceName("Kitchen", T, { sub: "The Gilded Spur" + SEP + "Kitchen", fresh: true }));
  out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }));
  out("told", H.told(A)); out("toasts", H.toasts); out("where", atlasWhere().text);
})();

hr("Q1c [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Pantry][SUBLOCATION:Pantry] — the LAST room re-stated");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Pantry][SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, TWICE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur").concat(H.nodesWith("Pantry"))); out("adds", Object.keys(A.adds)); out("off", A.off);
  out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }));
  out("toasts", H.toasts);
})();

hr("Q1d control: a KNOWN inn, [SUBLOCATION:<inn>][SUBLOCATION:Scullery][SUBLOCATION:Scullery] — the unknown room re-stated inside a known building");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:" + c.inn.name + "][SUBLOCATION:Scullery][SUBLOCATION:Scullery][LOCATION_DESC:S2.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Scullery")); out("adds", Object.keys(A.adds)); out("off", A.off);
})();
