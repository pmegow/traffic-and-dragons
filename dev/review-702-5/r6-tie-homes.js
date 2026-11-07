// r6-tie-homes.js — the fifth reviewer: the sub-location tie refusal (review 4, finding 7) and what `home` is for the
// odd world places: a world tied to OPEN COUNTRY (a wild zone), a village the engine ADDED, a world that is a cave on the
// region. Legit ties must still pass: a room of the town's own inn, a thing on the town's sheet, the sewer under the town,
// the crypt under the temple under the town; a cave on the region for a sub must be refused.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function openLand(A, c, minDist) { var reg = atlasDoc(A.seed), x, y; for (y = 100; y < reg.frame.height - 100; y += 40) for (x = 100; x < reg.frame.width - 100; x += 40) { try { TnDMaps.wild.fromRegion(reg, [x, y]); if (H.dist({ x: x, y: y }, c.p0) > minDist) return [x, y]; } catch (e) { } } return null; }

hr("R6a legit ties from the town: the inn's deep room, the market, the sewer's landing, the crypt's hall");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, iz, sz, tz, cz, tdoc;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); iz = A.at; H.turn("[SUBLOCATION_LEAVE]");
  H.turn("[SUBLOCATION:Widow Hale's House] A house."); H.quiet();
  r = atlasPlace(iz, { id: H.deepRoom(atlasDoc(iz)).id }); out("tie onto the inn's room", { ok: r.ok, reason: r.reason });
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Gate] A gate."); r = atlasPlace(c.townId, { id: c.market.id }); out("tie onto the market", { ok: r.ok, reason: r.reason });
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sz = A.at; out("sewer zone kind", A.zones[sz].kind); H.turn("[SUBLOCATION_LEAVE]");
  H.turn("[SUBLOCATION:The Drain] A drain."); r = atlasPlace(sz, { id: H.deepRoom(atlasDoc(sz)).id }); out("tie onto a sewer chamber", { ok: r.ok, reason: r.reason });
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.temple.name + "] In."); tz = A.at; tdoc = atlasDoc(tz); var stair = tdoc.portals.filter(function (p) { return p.way === "down"; })[0];
  H.turn("[SUBLOCATION:" + stair.name + "] Down."); cz = A.at; out("crypt zone kind", A.zones[cz].kind); H.turn("[SUBLOCATION_LEAVE]");
  H.turn("[SUBLOCATION:The Ossuary] Bones."); r = atlasPlace(cz, { id: H.deepRoom(atlasDoc(cz)).id }); out("tie onto a crypt chamber (two levels down)", { ok: r.ok, reason: r.reason });
})();

hr("R6b a WORLD tied to open country, then a sub tied to the same wild zone (a second xy tap in it) and to a neighbouring one");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, pt, wz, reg, z, pt2;
  pt = openLand(A, c, 200); H.turn("[LOCATION:The Crossroads] Open road."); H.quiet(); r = atlasPlace(A.seed, { x: pt[0], y: pt[1] }); out("world tie onto open country", { ok: r.ok, reason: r.reason, at: A.at, kind: A.zones[A.at] && A.zones[A.at].kind }); wz = A.at;
  H.turn("[SUBLOCATION:The Wayside Shrine] A shrine."); out("sub pointer / off", [H.sub(), A.off && A.off.why]); out("preview", atlasPlacePreview());
  reg = atlasDoc(A.seed); z = TnDMaps.wild.zoneAt(reg, pt); pt2 = [Math.round(z.cx), Math.round(z.cy)]; out("same-zone point", pt2);
  r = atlasPlace(A.seed, { x: pt2[0], y: pt2[1] }); out("sub tie onto the SAME wild zone", { ok: r.ok, reason: r.reason, at: A.at });
  var far = openLand(A, c, 200); var i, pts = []; for (i = 0; i < 20 && pts.length < 1; i++) { var cand = [pt[0] + 150 + i * 40, pt[1]]; try { TnDMaps.wild.fromRegion(reg, cand); if (TnDMaps.wild.zoneAt(reg, cand).id !== z.id) pts.push(cand); } catch (e) { } }
  if (pts.length) { r = atlasPlace(A.seed, { x: pts[0][0], y: pts[0][1] }); out("sub tie onto ANOTHER wild zone", { ok: r.ok, reason: r.reason }); } else out("no neighbouring land found", null);
  out("home for the world (atlasPosition)", (function () { var p = atlasPosition(A, "The Crossroads", null); return p && p.home; })());
})();

hr("R6c a VILLAGE the engine added as the world: home = its town; a tie onto its inn's room passes; the capital's inn is refused");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, vz, inn, iz, capInn = c.townId + "/" + c.inn.id;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); H.turn("[SUBLOCATION_LEAVE]");
  H.turn("[LOCATION:Thornwick] A village."); vz = A.at; out("village zone", [vz, A.zones[vz] && A.zones[vz].kind, A.off]);
  inn = atlasDoc(vz).establishments.filter(function (e) { return e.kind === "inn"; })[0] || atlasDoc(vz).establishments[0]; out("village inn", inn && inn.name);
  if (inn) { H.turn("[SUBLOCATION:" + inn.name + "] In."); iz = A.at; H.turn("[SUBLOCATION_LEAVE]"); }
  H.turn("[SUBLOCATION:Old Meg's Hut] A hut."); H.quiet(); out("home for Thornwick", atlasPosition(A, "Thornwick", null).home);
  if (iz) { r = atlasPlace(iz, { id: H.deepRoom(atlasDoc(iz)).id }); out("tie onto the village inn's room", { ok: r.ok, reason: r.reason }); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:Old Meg's Hut] Again."); }
  r = atlasPlace(capInn, { id: H.deepRoom(atlasDoc(capInn)).id }); out("tie onto the CAPITAL's inn room", { ok: r.ok, reason: r.reason });
  r = atlasPlace(A.seed, { id: c.p0.id }); out("tie onto the capital's place on the region", { ok: r.ok, reason: r.reason });
})();

hr("R6d a world that is a CAVE on the region (home = the dungeon): a sub tied to a chamber of it passes; a region tap refused");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, cave = c.reg.caves && c.reg.caves[0], cz, pt;
  if (!cave) { out("fixture has no cave", null); return; }
  H.turn("[LOCATION:" + cave.name + "] The cave."); cz = A.at; out("cave zone", [cz, A.zones[cz] && A.zones[cz].kind]);
  H.turn("[SUBLOCATION:The Glittering Vault] A vault."); H.quiet(); out("home", atlasPosition(A, cave.name, null).home);
  r = atlasPlace(cz, { id: H.deepRoom(atlasDoc(cz)).id }); out("tie onto a cave chamber", { ok: r.ok, reason: r.reason });
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Glittering Vault] Again."); pt = openLand(A, c, 200); r = atlasPlace(A.seed, { x: pt[0], y: pt[1] }); out("tie onto open country", { ok: r.ok, reason: r.reason });
})();
