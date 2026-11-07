// p7a2 — does the tap on a room inside the added building MOVE the building (remove + re-add at the party's new centre)?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var S = H.start(), A = S.A, c = S.c, T = S.T, hz, room, res, before, after, e;
/* the party at the market, so the forge lands beside the market, not at the town's centre */
H.turn("[SUBLOCATION:" + c.market.name + "] In the square."); H.turn("[SUBLOCATION:Harl's Forge][LOCATION_DESC:A smithy.] In."); hz = A.at;
e = atlasDoc(c.townId).establishments.filter(function (x) { return x.name === "Harl's Forge"; })[0]; before = { id: e.id, building: e.building, x: Math.round(e.x), y: Math.round(e.y), edits: JSON.stringify(A.zones[c.townId].params.edits), interiorFp: A.zones[hz].fp, rooms: atlasDoc(hz).rooms.map(function (r) { return r.name; }).join("/") };
out("before", before); out("market", Math.round(c.market.x) + "," + Math.round(c.market.y));
room = atlasDoc(hz).rooms.filter(function (r) { return atlasFind(atlasDoc(hz), r.name) && atlasFind(atlasDoc(hz), r.name).thing; })[0]; H.quiet();
res = atlasPlace(hz, { id: room.id }); out("tap", { ok: res.ok, bound: res.bound, level: res.level, reason: res.reason });
e = atlasDoc(c.townId).establishments.filter(function (x) { return x.name === "Harl's Forge"; })[0]; after = { id: e.id, building: e.building, x: Math.round(e.x), y: Math.round(e.y), edits: JSON.stringify(A.zones[c.townId].params.edits), interiorFp: A.zones[A.zones[hz] ? hz : A.at].fp, rooms: A.zones[hz] ? atlasDoc(hz).rooms.map(function (r) { return r.name; }).join("/") : "zone gone" };
out("after", after); out("moved?", before.x !== after.x || before.y !== after.y || before.building !== after.building); out("same interior drawing?", before.rooms === after.rooms && before.interiorFp === after.interiorFp);
out("told this turn", atlasToldLines(A)); out("infos", H.infos.filter(function (i) { return /added|drew/.test(i); })); out("names", A.names); out("tie's thing exists?", !!atlasThingById(atlasDoc(A.names[T + "|Harl's Forge"].zone), A.names[T + "|Harl's Forge"].id));
out("where", atlasWhere().text); out("pane card for the forge door", atlasCard(c.townId, { id: e.id }).partyHere);
