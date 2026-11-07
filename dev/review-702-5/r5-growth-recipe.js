// r5-growth-recipe.js — the fifth reviewer: the growth after the restore. (a) a refused growth ("Never Fits" stubbed out
// of every interior) leaves BOTH recipes byte-identical (edits, fp, params null-ness, the town's edits object); (b) the
// cache keys the baseline and the variants were drawn under; (c) a growth on a house whose interior recipe has NO params
// (paramsWas null) keeps params null after a refusal; (d) the reason reaches the GM's where-line.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }
var real = TnDMaps.generate;

hr("R5a a growth the large house still cannot hold: both recipes exactly as before?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, recBefore, townBefore, keysBefore;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at;
  out("interior params before any room", A.zones[sz].params); out("interior fp before", A.zones[sz].fp);
  recBefore = JSON.stringify(A.zones[sz]); townBefore = JSON.stringify(A.zones[c.townId]); keysBefore = Object.keys(A.zones).sort();
  TnDMaps.generate = function (k, p) { var d = real.apply(this, arguments); if (k === "interior" && d.rooms) d.rooms = d.rooms.filter(function (r) { return r.name !== "Never Fits"; }); return d; };
  try { H.quiet(); H.turn("[SUBLOCATION:Never Fits] A store."); } finally { TnDMaps.generate = real; }
  out("sub", H.sub()); out("off.why", A.off && A.off.why); out("toasts", H.toasts);
  out("interior recipe identical", JSON.stringify(A.zones[sz]) === recBefore); if (JSON.stringify(A.zones[sz]) !== recBefore) { out("  before", recBefore); out("  after ", JSON.stringify(A.zones[sz])); }
  out("town recipe identical", JSON.stringify(A.zones[c.townId]) === townBefore); if (JSON.stringify(A.zones[c.townId]) !== townBefore) { out("  before", townBefore.slice(0, 600)); out("  after ", JSON.stringify(A.zones[c.townId]).slice(0, 600)); }
  out("zones identical", JSON.stringify(Object.keys(A.zones).sort()) === JSON.stringify(keysBefore));
  out("where-line carries the reason", atlasWhere().text);
  out("MAP block carries the reason", atlasMapBlock().split("\n")[1]);
})();

hr("R5b the SAME with a room already added (paramsWas non-null): the recipe identical after a refused growth?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, recBefore, townBefore;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at;
  H.turn("[SUBLOCATION:Store Room 1] A store."); out("edits after room 1", edits(A, sz).map(function (e) { return e.id + ":" + e.name; })); out("footprint after room 1", edits(A, c.townId)[0].footprint);
  recBefore = JSON.stringify(A.zones[sz]); townBefore = JSON.stringify(A.zones[c.townId]);
  TnDMaps.generate = function (k, p) { var d = real.apply(this, arguments); if (k === "interior" && d.rooms) d.rooms = d.rooms.filter(function (r) { return r.name !== "Never Fits"; }); return d; };
  try { H.quiet(); H.turn("[SUBLOCATION:Never Fits] A store."); } finally { TnDMaps.generate = real; }
  out("off.why", A.off && A.off.why);
  out("interior recipe identical", JSON.stringify(A.zones[sz]) === recBefore); if (JSON.stringify(A.zones[sz]) !== recBefore) { out("  before", recBefore); out("  after ", JSON.stringify(A.zones[sz])); }
  out("town recipe identical", JSON.stringify(A.zones[c.townId]) === townBefore);
})();

hr("R5c the cache keys the growth drew under (atlasChainKey of the interior during the growth turn)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, sz, keys = [], realDoc = atlasDoc, i, ed, grewAt = 0;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId)[0];
  global.atlasDoc = function (z) { var k = atlasChainKey(A, z); if (z === sz) keys.push(k.split("\n")[0] + " | town: " + (/"footprint":"(\w+)"/.exec(k) || [])[1]); return realDoc.apply(this, arguments); };
  try { for (i = 1; i <= 8 && !grewAt; i++) { keys.length = 0; H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; } } finally { global.atlasDoc = realDoc; }
  out("grew at", grewAt); out("interior draws on the growth turn (distinct)", keys.filter(function (k, j) { return keys.indexOf(k) === j; }));
})();

hr("R5d is a growth ever tried on a house that is not the engine's custom place — a TRADE's house, and a native building?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, fz;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); fz = A.at; out("forge rec via / town edits", [A.zones[fz].via, edits(A, c.townId).map(function (e) { return e.id + ":" + e.kind + ":" + (e.footprint || ""); })]);
  out("growHouse(forge)", atlasGrowHouse(A, fz)); out("growHouse(inn)", (function () { H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.inn.name + "] In."); return atlasGrowHouse(A, A.at); })());
})();
