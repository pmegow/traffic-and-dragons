// s7-purity.js — part E/F: the resolver never adds; a thrown error inside atlasAdopt; the strip; the standing doc's bytes.
var ROOT = process.argv[2], OUTF = process.argv[3], fs = require("fs");
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("E1 purity: resolvePlaceName / atlasPlaceCanon / atlasPosition on pointers naming ABSENT places write nothing");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, before, mapBefore, wsBefore, names = ["Harl's Forge", "The Gilded Spur" + SEP + "Kitchen", "Kitchen", "Nowhere" + SEP + "Nothing", c.inn.name + SEP + "Snug", "The Crossroads", c.grates[0].name + SEP + "Bone Niche"], i, r;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); before = JSON.stringify(A); mapBefore = JSON.stringify(memory.map); wsBefore = JSON.stringify(worldState.world);
  var docs0 = Object.keys(_atlasDocs).length;
  for (i = 0; i < names.length; i++) { r = resolvePlaceName(names[i], T, { sub: c.inn.name }); atlasPlaceCanon(names[i], T, null); atlasPlaceCanon(names[i], T, c.inn.name); atlasPosition(A, T, names[i]); atlasPosition(A, "Nowhere Town", names[i]); }
  resolvePlaceName("Kitchen", "Bleakford", { sub: "Harl's Forge" });
  out("atlas store unchanged", JSON.stringify(A) === before); out("memory.map unchanged", JSON.stringify(memory.map) === mapBefore); out("pointer unchanged", JSON.stringify(worldState.world) === wsBefore);
  out("adds", Object.keys(A.adds)); out("recipes with edits", Object.keys(A.zones).filter(function (z) { return A.zones[z].params && A.zones[z].params.edits; })); out("doc cache grew by", Object.keys(_atlasDocs).length - docs0); out("peeks", Object.keys(_atlasPeeks).length);
  out("reports", H.reports);
})();

hr("E2 a thrown (non-refusal) error inside atlasAdopt: the recipe as it was, the turn committed, one report");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, real = TnDMaps.generate, recBefore, n0;
  recBefore = JSON.stringify(A.zones[c.townId]); n0 = worldState.turn;
  TnDMaps.generate = function (kind, params) { if (params && params.edits && params.edits.length) throw new Error("boom: the fixture's library fault"); return real(kind, params); };
  try { H.quiet(); H.turn("[SUBLOCATION:Harl's Forge][LOCATION_DESC:A smithy.] In."); } finally { TnDMaps.generate = real; }
  out("turn committed", worldState.turn === n0 + 1 + " (" + n0 + " -> " + worldState.turn + ")"); out("sub", H.sub()); out("node", !!H.node(T + "|Harl's Forge"));
  out("recipe as it was", JSON.stringify(A.zones[c.townId]) === recBefore); out("fp intact", A.zones[c.townId].fp === atlasFingerprint(atlasDoc(c.townId)));
  out("off", A.off); out("reports", H.reports); out("toasts", H.toasts); out("adds", Object.keys(A.adds));
  /* the next turn works and re-tries (the add was never recorded) */
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge] Still here."); out("next turn adds", Object.keys(A.adds)); out("reports", H.reports);
})();

hr("E3 a thrown error inside atlasDeclFor / the follow with a malformed placeDecls");
(function () {
  var S = H.start(), A = S.A, c = S.c, n0 = worldState.turn;
  worldState.placeDecls = "not an array"; H.quiet(); H.turn("[LOCATION:Bleakford] A hamlet."); out("turn committed", worldState.turn === n0 + 1); out("off", A.off); out("reports", H.reports); out("adds", Object.keys(A.adds));
  worldState.placeDecls = [{ name: null, where: null }]; H.quiet(); H.turn("[LOCATION:Thornwick] Another."); out("turn committed 2", worldState.turn === n0 + 2); out("off", A.off); out("reports", H.reports); out("adds", Object.keys(A.adds));
})();

hr("F the strip and the standing doc");
(function () {
  H.startBare();
  out("cleanTxt strips MAP_PLACE", JSON.stringify(cleanTxt("A [MAP_PLACE:Bleakford|near Great Brem] B [MAP_PLACE:X|between A and B] C")));
  out("cleanTxt strips a malformed one", JSON.stringify(cleanTxt("A [MAP_PLACE:Bleakford] B")));
  var doc = buildStateTagsDoc(); out("standing doc mentions MAP_PLACE", doc.indexOf("MAP_PLACE") >= 0); out("standing doc length", doc.length);
  fs.writeFileSync(OUTF, doc);
  out("TAG_DOC_ENGINE_ONLY has MAP_PLACE", TAG_DOC_ENGINE_ONLY.indexOf("MAP_PLACE") >= 0);
  out("MAP_PLACE in TAG_STRIP_NAMES", TAG_STRIP_NAMES.indexOf("MAP_PLACE") >= 0);
  /* the receipt in an unmapped campaign */
  var R = H.mutsOf("[LOCATION:Oakhaven][MAP_PLACE:Oakhaven|near Marrowgate]"); out("unmapped receipts", R.muts); out("placeDecls set by the parser", worldState.placeDecls); atlasFollow(); out("after follow", worldState.placeDecls);
})();
