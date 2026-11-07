// p7-tap-inside.js — the tap finding 4's refusal does not cover: the pointer names the added building ("Harl's Forge"), the pane
// shows the party inside it, and the player taps a ROOM of that house for We are here. What becomes of the addition and the tie?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("P7a pointer 'Harl's Forge' (the added building); the player taps a room inside the forge's own sheet");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, hz, room, res, s1;
  H.turn("[SUBLOCATION:Harl's Forge][LOCATION_DESC:A smithy.] In."); hz = A.at; s1 = A.zones[hz].via; room = atlasDoc(hz).rooms.filter(function (r) { return atlasFind(atlasDoc(hz), r.name) && atlasFind(atlasDoc(hz), r.name).thing; })[0];
  out("preview", atlasPlacePreview()); out("card of the room", atlasCard(hz, { id: room.id })); H.quiet();
  res = atlasPlace(hz, { id: room.id }); out("tap", { ok: res.ok, at: res.at, spot: res.spot, off: res.off, bound: res.bound, level: res.level, reason: res.reason });
  out("names", A.names); out("adds", JSON.stringify(A.adds)); out("zones", Object.keys(A.zones)); out("forge on the town sheet?", atlasDoc(c.townId).establishments.filter(function (e) { return e.name === "Harl's Forge"; }).map(function (e) { return e.id; }));
  out("A.at/spot/off", A.at + " / " + A.spot + " / " + JSON.stringify(A.off)); out("infos", H.infos.filter(function (i) { return /atlas/.test(i); })); out("toasts", H.toasts); out("told", H.told(A)); out("where", atlasWhere().text);
  out("heal", atlasHeal() + " names=" + JSON.stringify(A.names));
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge] Still here."); out("next turn A.at/off", A.at + " / " + JSON.stringify(A.off)); out("adds", JSON.stringify(A.adds)); out("toasts", H.toasts);
})();

hr("P7b the same, pointer a ROOM of the added building ('Harl's Forge — Forge'); the player taps the forge's door on the town sheet");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, s1, res;
  H.turn("[SUBLOCATION:Harl's Forge] In."); s1 = A.zones[A.at].via; H.turn("[SUBLOCATION:Forge] At the anvil."); out("sub", H.sub()); out("preview", atlasPlacePreview()); H.quiet();
  res = atlasPlace(c.townId, { id: s1 }); out("tap", { ok: res.ok, at: res.at, spot: res.spot, bound: res.bound, level: res.level, reason: res.reason });
  out("names", A.names); out("adds", JSON.stringify(A.adds)); out("A.at/spot/off", A.at + " / " + A.spot + " / " + JSON.stringify(A.off)); out("where", atlasWhere().text);
})();

hr("P7c a twice-borne chain name over an added street thing: 'Passage' added from the street, then 'Passage' inside an inn with four passages");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, inn = c.inn.name, innDoc, twice;
  H.turn("[SUBLOCATION:" + inn + "] In."); innDoc = atlasDoc(A.at); twice = innDoc.rooms.filter(function (r) { return innDoc.rooms.filter(function (q) { return q.name === r.name; }).length > 1; })[0]; H.turn("[SUBLOCATION_LEAVE]");
  H.quiet(); H.turn("[SUBLOCATION:" + twice.name + "][LOCATION_DESC:A STREET THING.] A covered way off the square."); out("street sub", H.sub()); out("added at town level?", !!atlasFind(atlasDoc(c.townId), twice.name));
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + inn + "] In."); H.quiet(); H.turn("[SUBLOCATION:" + twice.name + "][LOCATION_DESC:THE INN'S.] Along it."); out("inside sub", H.sub()); out("nodes", H.nodesWith(twice.name)); out("geo mentions STREET THING", buildGeoBlock().indexOf("A STREET THING") >= 0);
})();
