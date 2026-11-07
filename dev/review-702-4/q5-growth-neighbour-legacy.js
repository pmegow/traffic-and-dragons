// q5-growth-neighbour-legacy.js — the fourth reviewer: (a) a trade in a neighbouring house across a growth that really
// happens (the Spur at the market, where Q4a grew at room 1); (b) a legacy save's three-segment key (made at v1.1363)
// re-stated at HEAD — the accepted "not migrated" limit, measured; (c) a growth's doc-cache footprint.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }

hr("Q5a a smith placed from the square, then the Spur from the square grows: does the smith stand still?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, fz, ed, i, grewAt = 0, before, after, est, fpB, fpA, town, spur, sp, over = [];
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); fz = A.at; est = function () { return atlasDoc(c.townId).establishments.filter(function (e) { return e.name === "Harl's Forge"; })[0]; };
  before = est(); fpB = atlasFingerprint(atlasDoc(fz)); out("forge before", { b: before.building, x: before.x, y: before.y });
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.market.name + "] Back on the square."); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  out("spur edit", ed); out("buildings before", atlasDoc(c.townId).buildings.length);
  for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
  out("grew at", grewAt); out("buildings after", atlasDoc(c.townId).buildings.length);
  after = est(); fpA = atlasFingerprint(atlasDoc(fz)); out("forge after", { b: after.building, x: after.x, y: after.y }); out("forge moved?", before.building !== after.building || before.x !== after.x || before.y !== after.y); out("forge interior redrawn?", fpB !== fpA);
  try { out("forge zone params seed ok", atlasZoneParams(A, fz).seed === fz); } catch (e) { out("forge zone params THROWS", e.message); }
  town = atlasDoc(c.townId); spur = town.establishments.filter(function (e) { return e.name === "The Gilded Spur"; })[0]; sp = town.buildings[spur.building];
  function inside(p, poly) { var k, j, c2 = false; for (k = 0, j = poly.length - 1; k < poly.length; j = k++) { if (((poly[k][1] > p[1]) !== (poly[j][1] > p[1])) && (p[0] < (poly[j][0] - poly[k][0]) * (p[1] - poly[k][1]) / (poly[j][1] - poly[k][1]) + poly[k][0])) c2 = !c2; } return c2; }
  town.buildings.forEach(function (b, k) { if (k === spur.building || !b || !b.pts) return; if (b.pts.some(function (p) { return inside(p, sp.pts); }) || sp.pts.some(function (p) { return inside(p, b.pts); })) over.push(k + (b.est ? ":" + b.est : "") + (b.authored ? ":authored" : "")); });
  out("spur footprint (large)", sp.pts); out("buildings overlapping the large footprint", over); out("spur building index", spur.building + " of " + town.buildings.length);
  out("things lost on the town vs a clean draw?", (function () { var rec = A.zones[c.townId], eds = rec.params.edits, was; rec.params.edits = eds.filter(function (e) { return e.name !== "The Gilded Spur"; }); rec.fp = null; atlasForget(); was = atlasDoc(c.townId); rec.params.edits = eds; rec.fp = null; atlasForget(); return atlasLost(was, atlasDoc(c.townId)); })());
})();

hr("Q5b a legacy three-segment key (a save made before 288c8e6f): the pointer 'Spur — Kitchen — Pantry' in force, then [SUBLOCATION:Pantry]");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, key;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); H.turn("[SUBLOCATION:Kitchen] The kitchen."); H.turn("[SUBLOCATION:Pantry] The pantry.");
  /* forge the legacy shape by hand: a node keyed with the room in the middle, the pointer on it */
  key = T + "|The Gilded Spur" + SEP + "Kitchen" + SEP + "Pantry"; memory.map.nodes[key] = JSON.parse(JSON.stringify(H.node(T + "|The Gilded Spur" + SEP + "Pantry"))); memory.map.nodes[key].desc = "LEGACY PANTRY."; delete memory.map.nodes[T + "|The Gilded Spur" + SEP + "Pantry"];
  worldState.world.sublocation = "The Gilded Spur" + SEP + "Kitchen" + SEP + "Pantry"; A.ptr = null; atlasFollow(); out("follow with the legacy pointer: at/spot/off", [A.at, A.spot, A.off]);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:PANTRY NOW.] Still here.");
  out("sub", H.sub()); out("nodes with Pantry", H.nodesWith("Pantry")); out("geo has LEGACY", buildGeoBlock().indexOf("LEGACY PANTRY") >= 0); out("toasts", H.toasts);
})();

hr("Q5c the doc cache under repeated growth and redraw (monotonic)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, i, n = 0;
  H.turn("[SUBLOCATION:" + c.market.name + "]");
  for (i = 1; i <= 4; i++) { H.turn("[SUBLOCATION:House " + i + "] In."); H.turn("[SUBLOCATION:Cellar Room] A room."); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.market.name + "] Back."); }
  Object.keys(A.zones).forEach(function (z) { if (A.zones[z].kind === "interior") n++; });
  out("interiors entered", n); out("grown", edits(A, c.townId).filter(function (e) { return e.footprint === "large"; }).map(function (e) { return e.name; })); out("docs cached", Object.keys(_atlasDocs).length + " / drawn " + Object.keys(_atlasDrawn).length + " (cap " + ATLAS_DOC_CAP + ")"); out("peeks", Object.keys(_atlasPeeks).length + " (cap " + ATLAS_PEEK_CAP + ")"); out("told", (A.told || []).length); out("adds", Object.keys(A.adds).length); out("store bytes", JSON.stringify(A).length);
})();
