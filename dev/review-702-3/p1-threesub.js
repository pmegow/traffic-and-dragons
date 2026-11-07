// p1-threesub.js — the third reviewer: a reply that names an invented building, a room and a second room — the taught
// "a room's own name is enough" flow with three [SUBLOCATION:] tags — and the next reply re-stating the last room.
// Question: does the room get ONE node, or a path key with a room in the middle and then a twin on re-statement?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("P1 three subs in one reply through an INVENTED building: [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Pantry]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T;
  H.quiet(); H.turn("You push into the Gilded Spur, through its kitchen and into the pantry. [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, FIRST.]");
  out("sub", H.sub()); out("A.at/spot", A.at + "/" + A.spot); out("off", A.off); out("adds", Object.keys(A.adds)); out("nodes", H.nodesWith("Spur")); out("told", H.told(A)); out("toasts", H.toasts);
  out("spur rooms", A.zones[A.at] && A.zones[A.at].kind === "interior" ? atlasDoc(A.at).rooms.map(function (r) { return r.name; }) : null);
  /* the next reply: the pantry re-stated by its own name, as the rule teaches */
  H.quiet(); H.turn("You look around the pantry. [SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, AGAIN.]");
  out("sub after re-statement", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("geo mentions FIRST", buildGeoBlock().indexOf("THE PANTRY, FIRST") >= 0); out("geo mentions AGAIN", buildGeoBlock().indexOf("THE PANTRY, AGAIN") >= 0);
  out("resolve Pantry at Spur—Kitchen", resolvePlaceName("Pantry", T, { sub: "The Gilded Spur" + SEP + "Kitchen" }));
  out("resolve Pantry at Spur", resolvePlaceName("Pantry", T, { sub: "The Gilded Spur" }));
  out("resolve the 3-seg key from the street", resolvePlaceName("The Gilded Spur" + SEP + "Kitchen" + SEP + "Pantry", T, { sub: null }));
  out("where", atlasWhere().text); out("spur rooms now", atlasDoc(A.at).rooms.map(function (r) { return r.name; }));
  /* the third reply: back to the kitchen, then the pantry once more */
  H.quiet(); H.turn("[SUBLOCATION:Kitchen] Back."); out("sub", H.sub()); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, THRICE.]"); out("sub", H.sub()); out("nodes", H.nodesWith("Spur"));
})();

hr("P1b the same with a KNOWN building: [SUBLOCATION:<inn>][SUBLOCATION:<room>][SUBLOCATION:Pantry]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, r = S.r;
  H.quiet(); H.turn("[SUBLOCATION:" + r.a + "][SUBLOCATION:" + r.room + "][SUBLOCATION:Pantry][LOCATION_DESC:P1.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:P2.]"); out("sub", H.sub()); out("nodes", H.nodesWith("Pantry"));
})();

hr("P1c a pair of three with an unknown building: [SUBLOCATION:The Copper Cup — Kitchen — Pantry]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T;
  H.quiet(); H.turn("[SUBLOCATION:The Copper Cup" + SEP + "Kitchen" + SEP + "Pantry][LOCATION_DESC:C1.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("cup rooms", A.zones[A.at] && A.zones[A.at].kind === "interior" ? atlasDoc(A.at).rooms.map(function (r) { return r.name; }) : null);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:C2.]"); out("sub", H.sub()); out("nodes", H.nodesWith("Copper")); out("adds", Object.keys(A.adds)); out("geo mentions C1", buildGeoBlock().indexOf("C1.") >= 0);
})();

hr("P1d an invented building whose house DOES have the named room, then an unknown room: [SUBLOCATION:The Gilded Spur][SUBLOCATION:Hall][SUBLOCATION:Pantry] (the Spur's house has a Hall)");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T;
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Hall][SUBLOCATION:Pantry][LOCATION_DESC:D1.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("spur rooms", A.zones[A.at] && A.zones[A.at].kind === "interior" ? atlasDoc(A.at).rooms.map(function (r) { return r.name; }) : null);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:D2.]"); out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("geo mentions D1", buildGeoBlock().indexOf("D1.") >= 0);
})();

hr("P1e the re-statement of an invented building inside the SAME reply: [SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T;
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur] In and in."); out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off);
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:the gilded spur] Case."); out("sub", H.sub()); out("nodes", H.nodesWith("Spur").concat(H.nodesWith("spur"))); out("adds", Object.keys(A.adds));
})();
