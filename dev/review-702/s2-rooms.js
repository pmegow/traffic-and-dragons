// s2-rooms.js — part B: invented rooms in interiors (displacement), chambers in dungeons with no room, the forge's Back Room.
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function roomNames(doc) { return doc.rooms.map(function (r) { return r.name + "@" + r.floor; }); }

hr("B1 an invented room in the forge of an added village (the A8 case): what happened?");
(function () {
  var S = H.start(), A = S.A, c = S.c, fz, d0;
  H.turn("[LOCATION:Bleakford] A hamlet."); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); fz = A.at; d0 = atlasDoc(fz);
  out("forge interior", fz + " rooms=" + JSON.stringify(roomNames(d0)) + " warnings=" + JSON.stringify(d0.warnings)); out("A.spot at entry", A.spot);
  H.quiet(); H.turn("[SUBLOCATION:Back Room] A store."); out("sub", H.sub()); out("A.at", A.at + " spot=" + A.spot); out("off", A.off); out("told", H.told(A)); out("toasts", H.toasts); out("where", atlasWhere().text);
  out("edits on forge", (A.zones[fz].params && A.zones[fz].params.edits) || null);
  /* try the library directly: an 8 m2 custom room in that smithy */
  var params = atlasZoneParams(A, fz); params.edits = [{ op: "add", id: "r1", kind: "custom", word: "room", name: "Back Room", m2: 8 }];
  try { var d1 = TnDMaps.generate("interior", params); out("direct add rooms", roomNames(d1)); out("direct add warnings", d1.warnings); } catch (e) { out("direct add threw", e.message); }
})();

hr("B2 displacement: add rooms to the fixture inn until a generated room is dropped; is the story told? does the dropped room's name re-resolve?");
(function () {
  var S = H.start(), A = S.A, c = S.c, innZ, d0, names0, i, d, dropped, n = 0;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); innZ = A.at; d0 = atlasDoc(innZ); names0 = d0.rooms.map(function (r) { return r.name; });
  out("inn rooms", roomNames(d0)); out("inn warnings", d0.warnings);
  for (i = 1; i <= 8; i++) {
    H.quiet(); H.turn("[SUBLOCATION:Invented Room " + i + "] Another room."); n++;
    d = atlasDoc(innZ); dropped = names0.filter(function (nm) { return !d.rooms.some(function (r) { return r.name === nm; }); });
    if (A.off && A.off.within) { out("add " + i + " refused", A.off.why); }
    if (dropped.length) { out("after add " + i + " dropped generated rooms", dropped); out("warnings", d.warnings); out("told", H.told(A)); out("toasts", H.toasts); break; }
  }
  if (!dropped || !dropped.length) { out("no generated room dropped after " + n + " adds", roomNames(atlasDoc(innZ))); return; }
  /* the GM names the dropped room (it was on the digest the GM read) */
  H.quiet(); H.turn("[SUBLOCATION:" + dropped[0] + "][LOCATION_DESC:The dropped room, named again.] Through.");
  out("sub", H.sub()); out("off", A.off); out("told", H.told(A)); out("edits", (A.zones[innZ].params.edits || []).map(function (e) { return e.id + ":" + e.name; }));
  d = atlasDoc(innZ); out("rooms now", roomNames(d)); out("warnings", d.warnings);
  out("digest mentions " + dropped[0] + "?", atlasDigestText(innZ).indexOf(dropped[0]) >= 0);
})();

hr("B3 a dungeon chamber the library cannot dig at any offset (TnDMaps.generate refuses every edit draw): what the party sees");
(function () {
  var S = H.start(), A = S.A, c = S.c, sewer, deep, real = TnDMaps.generate;
  H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sewer = A.at; deep = H.deepRoom(atlasDoc(sewer)); H.turn("[SUBLOCATION:" + deep.name + "] Along.");
  TnDMaps.generate = function (kind, params) { if (kind === "dungeon" && params.edits && params.edits.length) throw new Error("TnDMaps: edits[0]: no room for a chamber there — {}"); return real(kind, params); };
  try { H.quiet(); H.turn("[SUBLOCATION:The Bone Niche][LOCATION_DESC:Skulls.] A side cut."); } finally { TnDMaps.generate = real; }
  out("sub", H.sub()); out("A.at/spot", A.at + " / " + A.spot); out("off", A.off); out("where", atlasWhere().text); out("told", H.told(A)); out("toasts", H.toasts); out("reports", H.reports);
  out("edits on sewer", (A.zones[sewer].params && A.zones[sewer].params.edits) || null); out("fp intact", A.zones[sewer].fp === atlasFingerprint(atlasDoc(sewer)));
  out("node", !!H.node(S.T + "|" + A.zones[sewer].name + SEP + "The Bone Niche"));
  /* a real crowded case: dig chambers at the same spot repeatedly */
  var i, k = 0; for (i = 1; i <= 10; i++) { H.quiet(); H.turn("[SUBLOCATION:Niche " + i + "] Another."); if (A.off && A.off.within) { out("dig " + i + " refused", A.off.why); break; } k++; }
  out("chambers dug beside one spot before a refusal", k); out("edits", ((A.zones[sewer].params || {}).edits || []).length);
})();

hr("B4 an invented room's floor: the party on an upper floor, the room added on that floor?");
(function () {
  var S = H.start(), A = S.A, c = S.c, innZ, d, up, e;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); innZ = A.at; d = atlasDoc(innZ);
  up = d.rooms.filter(function (r) { return r.floor === 1 && atlasFind(d, r.name) && atlasFind(d, r.name).thing; })[0];
  if (!up) { out("no upper-floor room with a unique name", roomNames(d)); return; }
  H.turn("[SUBLOCATION:" + up.name + "] Upstairs."); out("spot", A.spot + " floor " + up.floor);
  H.quiet(); H.turn("[SUBLOCATION:The Linen Press] A cupboard room."); e = ((A.zones[innZ].params || {}).edits || [])[0]; out("edit", e); out("drawn floor", (atlasFind(atlasDoc(innZ), "The Linen Press").thing || {}).id && atlasDoc(innZ).rooms.filter(function (r) { return r.name === "The Linen Press"; })[0].floor); out("off", A.off);
})();
