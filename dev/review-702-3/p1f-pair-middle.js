// p1f-pair-middle.js — the P1 key class through rule (b): a pair of three in a KNOWN building with an unknown middle room,
// [SUBLOCATION:The Old Ram — Scullery — Pantry], then the pantry re-stated by its own name. node ... <ROOT>
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("P1f the pair of three in a KNOWN building with an unknown middle: [SUBLOCATION:<inn> — Scullery — Pantry]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, inn = c.inn.name;
  H.quiet(); H.turn("[SUBLOCATION:" + inn + SEP + "Scullery" + SEP + "Pantry][LOCATION_DESC:F1.] Through the scullery to the pantry.");
  out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("inn rooms gained", atlasDoc(A.at).rooms.filter(function (r) { return r.authored; }).map(function (r) { return r.name; }));
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:F2.] The pantry again."); out("sub", H.sub()); out("nodes", H.nodesWith("Pantry").concat(H.nodesWith("Scullery"))); out("geo mentions F1", buildGeoBlock().indexOf("F1.") >= 0);
  out("resolve 'Pantry' at '" + inn + " — Scullery'", resolvePlaceName("Pantry", T, { sub: inn + SEP + "Scullery" }));
  /* the tap for the re-stated pointer: does it find the room's add? */
  var pv = atlasPlacePreview(); out("preview", pv); out("add under the preview's key?", !!A.adds[T + "|" + pv.name]); out("add keys", Object.keys(A.adds));
})();

hr("P1g a KNOWN building, three subs, the middle one unknown: [SUBLOCATION:<inn>][SUBLOCATION:Scullery][SUBLOCATION:Pantry]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, inn = c.inn.name;
  H.quiet(); H.turn("[SUBLOCATION:" + inn + "][SUBLOCATION:Scullery][SUBLOCATION:Pantry][LOCATION_DESC:G1.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:G2.]"); out("sub", H.sub()); out("nodes", H.nodesWith("Pantry")); out("geo mentions G1", buildGeoBlock().indexOf("G1.") >= 0);
})();

hr("P1h what the HUD/GM see for the 3-seg pointer: the where-line, and the position the map reads for it");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T;
  H.quiet(); H.turn("[SUBLOCATION:The Copper Cup" + SEP + "Kitchen" + SEP + "Pantry][LOCATION_DESC:C1.]");
  out("sub", H.sub()); out("where", atlasWhere().text); var pos = atlasPosition(A, T, H.sub()); out("position chain/spot/used/unknown", [pos.chain.map(function (x) { return x.name; }), pos.spot && pos.spot.name, pos.used, pos.unknown || null]);
  out("ties on where-line", atlasWhere().ties);
})();
