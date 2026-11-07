// q4-growth.js — the fourth reviewer: atlasGrowHouse (6671e60a). (a) the baseline the second lay() compares against:
// does it already carry the room being added (the stale edit left by the failed first pass), blinding atlasLost? (b) a
// trade in a neighbouring house: index, position and interior seed across the growth; (c) a generated room the story
// visited in the medium house, after the growth; (d) the party's spot right after the growth; (e) a growth the library
// refuses: is its reason surfaced? (f) the town's and the house's fingerprints: re-stamped silently, or "redrawn"?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }
function roomNames(doc) { return (doc.rooms || []).map(function (r) { return r.name; }); }
var realLost = atlasLost;

hr("Q4a the baseline of the second lay(): wrap atlasLost during the growth turn");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, ed, i, log = [], grewAt = 0, before, clean, final, rec, name;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; rec = A.zones[sz]; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  out("medium rooms", roomNames(atlasDoc(sz)));
  atlasLost = function (was, now) { log.push({ wasRooms: roomNames(was).length, wasHasNew: roomNames(was).indexOf(name) >= 0, nowRooms: roomNames(now).length, nowHasNew: roomNames(now).indexOf(name) >= 0, footprint: ed.footprint }); return realLost(was, now); };
  try {
    for (i = 1; i <= 8 && !grewAt; i++) { name = "Store Room " + i; log.length = 0; before = edits(A, sz).slice(); H.quiet(); H.turn("[SUBLOCATION:" + name + "] A store."); if (ed.footprint === "large") grewAt = i; }
  } finally { atlasLost = realLost; }
  out("grew at room", grewAt); out("atlasLost calls on the growth turn (interior ones have rooms)", log.filter(function (x) { return x.wasRooms > 0; }));
  out("the second pass's baseline already held the new room?", log.filter(function (x) { return x.footprint === "large" && x.wasRooms > 0; }).map(function (x) { return x.wasHasNew; }));
  /* was anything of the clean large house displaced by the final drawing? (the check the second pass could not make) */
  rec.params.edits = before; rec.fp = null; atlasForget(); clean = atlasDoc(sz); rec.params.edits = before.concat([edits(A, sz).length ? null : null].filter(Boolean));
  rec.params.edits = before.concat([{ op: "add", id: "r" + grewAt, kind: "custom", word: "room", name: name }]); rec.fp = null; atlasForget();
  final = atlasDoc(sz); out("clean large rooms", roomNames(clean).length); out("final rooms", roomNames(final).length); out("lost vs the clean large house", realLost(clean, final));
  /* restore the real edits */
  rec.params.edits = before.concat([edits(A, sz)[edits(A, sz).length - 1]]); rec.fp = null; atlasForget();
})();

hr("Q4b a trade in a neighbouring house across the growth: Harl's Forge (a smith into the roomiest house), then the Spur grows");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, fz, ed, i, grewAt = 0, forgeBefore, forgeAfter, est, fpBefore, fpAfter, zp;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); fz = A.at; est = function () { return atlasDoc(c.townId).establishments.filter(function (e) { return e.name === "Harl's Forge"; })[0]; };
  forgeBefore = est(); fpBefore = atlasFingerprint(atlasDoc(fz)); out("forge before", { b: forgeBefore.building, x: forgeBefore.x, y: forgeBefore.y, fp: fpBefore });
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  out("spur edit", ed); out("buildings count before growth", atlasDoc(c.townId).buildings.length);
  for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
  out("grew at", grewAt); out("buildings count after growth", atlasDoc(c.townId).buildings.length);
  forgeAfter = est(); fpAfter = atlasFingerprint(atlasDoc(fz)); out("forge after", { b: forgeAfter.building, x: forgeAfter.x, y: forgeAfter.y, fp: fpAfter });
  out("forge moved?", forgeBefore.building !== forgeAfter.building || forgeBefore.x !== forgeAfter.x); out("forge interior redrawn?", fpBefore !== fpAfter);
  try { zp = atlasZoneParams(A, fz); out("forge zone params seed ok", zp.seed === fz); } catch (e) { out("forge zone params THROWS", e.message); }
  /* does the large footprint overlap another building's polygon? */
  var town = atlasDoc(c.townId), spur = town.establishments.filter(function (e) { return e.name === "The Gilded Spur"; })[0], sp = town.buildings[spur.building], over = [];
  function inside(p, poly) { var k, j, c2 = false; for (k = 0, j = poly.length - 1; k < poly.length; j = k++) { if (((poly[k][1] > p[1]) !== (poly[j][1] > p[1])) && (p[0] < (poly[j][0] - poly[k][0]) * (p[1] - poly[k][1]) / (poly[j][1] - poly[k][1]) + poly[k][0])) c2 = !c2; } return c2; }
  town.buildings.forEach(function (b, k) { if (k === spur.building || !b || !b.pts) return; if (b.pts.some(function (p) { return inside(p, sp.pts); })) over.push(k + (b.est ? ":" + b.est : "")); });
  out("spur footprint", sp.pts); out("buildings with a corner inside the large footprint", over);
  out("warnings on the town doc", town.warnings);
})();

hr("Q4c a generated room the story visited in the MEDIUM house, after the growth");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, ed, i, grewAt = 0, gen, spotBefore;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  gen = H.deepRoom(atlasDoc(sz)); out("medium house rooms", roomNames(atlasDoc(sz))); out("visiting generated room", gen.name + "#" + gen.id);
  H.turn("[SUBLOCATION:" + gen.name + "][LOCATION_DESC:GEN ONE.]"); out("sub", H.sub()); out("A.spot", A.spot); spotBefore = A.spot;
  for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
  out("grew at", grewAt); out("large house rooms", roomNames(atlasDoc(sz))); out("the visited room still drawn by name?", !!(atlasFind(atlasDoc(sz), gen.name) && atlasFind(atlasDoc(sz), gen.name).thing)); out("by id?", !!atlasThingById(atlasDoc(sz), gen.id));
  out("told on the growth turn", H.told(A)); out("warns", H.warns.filter(function (w) { return /redrawn|atlas/.test(w); })); out("redrawn stamps", { town: !!A.zones[c.townId].redrawn, house: !!A.zones[sz].redrawn });
  H.quiet(); H.turn("[SUBLOCATION:" + gen.name + "][LOCATION_DESC:GEN TWO.] Back."); out("sub", H.sub()); out("nodes", H.nodesWith(gen.name)); out("geo has GEN ONE", buildGeoBlock().indexOf("GEN ONE") >= 0); out("adds", Object.keys(A.adds)); out("off", A.off); out("toasts", H.toasts);
})();

hr("Q4d the party's spot right after the growth turn (A.spot is a medium-house room id)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, ed, i, grewAt = 0, gen;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  gen = H.deepRoom(atlasDoc(sz)); H.turn("[SUBLOCATION:" + gen.name + "] In the room.");
  for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
  out("grew at", grewAt); out("A.at/spot", A.at + "/" + A.spot); out("spot thing", atlasThingById(atlasDoc(sz), A.spot) && atlasThingById(atlasDoc(sz), A.spot).name); out("partyIn", atlasPartyIn(sz)); out("where", atlasWhere().text);
})();

hr("Q4e a growth the library refuses during a REAL turn: is the growth's reason said anywhere?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, ed, i, real = TnDMaps.generate, refusedAt = 0;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  TnDMaps.generate = function (kind, params) { if (params && params.edits && params.edits.some(function (e) { return e.footprint === "large"; })) throw new Error("TnDMaps: edits[0]: at lies on another place"); return real.apply(this, arguments); };
  try { for (i = 1; i <= 8 && !refusedAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (A.off) refusedAt = i; } } finally { TnDMaps.generate = real; }
  out("refused at room", refusedAt); out("off", A.off); out("toasts", H.toasts); out("told", H.told(A)); out("footprint", ed.footprint); out("town fp as settled?", !!A.zones[c.townId].fp); out("sub", H.sub()); out("nodes", H.nodesWith("Store Room " + refusedAt));
})();

hr("Q4f fingerprints after a growth: settled silently (no 'redrawn'), the doc cache size");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, ed, i, grewAt = 0;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
  for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
  out("grew at", grewAt); out("redrawn stamps", { town: A.zones[c.townId].redrawn || null, house: A.zones[sz].redrawn || null }); out("warns", H.warns.filter(function (w) { return /redrawn/.test(w); }));
  out("docs cached", Object.keys(_atlasDocs).length + " of cap " + ATLAS_DOC_CAP); out("peeks", Object.keys(_atlasPeeks).length);
  /* the save round trip redraws the same */
  var snap = JSON.parse(JSON.stringify(worldState.atlas)), fpH = A.zones[sz].fp, fpT = A.zones[c.townId].fp; atlasForget(); worldState.atlas = snap; A = worldState.atlas; atlasHeal();
  H.quiet(); H.turn("[SUBLOCATION:Store Room 1] Back."); out("after reload: redrawn?", { town: A.zones[c.townId].redrawn || null, house: A.zones[sz].redrawn || null }); out("fps equal", A.zones[sz].fp === fpH && A.zones[c.townId].fp === fpT); out("warns", H.warns.filter(function (w) { return /redrawn/.test(w); }));
})();
