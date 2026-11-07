// p7a4 — the inside-tap in a ROOMY invented tavern: a room added inside, the player ties the tavern's name to another room of it,
// then the story names the added room again and a new room. node ... <ROOT>
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var S = H.start(), A = S.A, c = S.c, T = S.T, tz, room, res, pos;
H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Pot and Kettle][LOCATION_DESC:A tavern.] In."); tz = A.at;
H.turn("[SUBLOCATION:The Snug][LOCATION_DESC:A SNUG WITH A FIRE.] A snug."); out("snug added", !!atlasFind(atlasDoc(tz), "The Snug")); out("adds", Object.keys(A.adds)); out("interior edits", JSON.stringify(A.zones[tz].params && A.zones[tz].params.edits));
H.turn("[SUBLOCATION:The Pot and Kettle] Back at the door."); out("pointer", H.sub()); out("preview", atlasPlacePreview());
room = atlasDoc(tz).rooms.filter(function (r) { return r.name === "Taproom"; })[0] || atlasDoc(tz).rooms.filter(function (r) { return r.name !== "The Snug" && atlasFind(atlasDoc(tz), r.name) && atlasFind(atlasDoc(tz), r.name).thing; })[0]; H.quiet();
out("card offers", atlasCard(tz, { id: room.id }).place);
res = atlasPlace(tz, { id: room.id }); out("tap on " + room.name, { ok: res.ok, bound: res.bound, level: res.level, reason: res.reason });
out("snug still on the tavern's sheet?", !!(A.zones[tz] && atlasFind(atlasDoc(tz), "The Snug"))); out("adds", Object.keys(A.adds)); out("interior edits", JSON.stringify(A.zones[tz] && A.zones[tz].params && A.zones[tz].params.edits)); out("told this turn", atlasToldLines(A)); out("names", A.names);
pos = atlasPosition(A, T, "The Pot and Kettle"); out("position for the tied building: chain / zone / spot", [pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name]);
H.quiet(); H.turn("[SUBLOCATION:The Snug] Back to the snug."); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("toasts", H.toasts); out("geo has FIRE", buildGeoBlock().indexOf("A SNUG WITH A FIRE") >= 0); out("where", atlasWhere().text);
H.quiet(); H.turn("[SUBLOCATION:Cold Store][LOCATION_DESC:COLD.] A cold store."); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; })); out("toasts", H.toasts);
