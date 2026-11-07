// p7a3 — the inside-tap's consequence: a room the story added INSIDE the added building, then the player taps another room of it
// for the pointer naming the building. Does the re-made interior still carry the added room?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var S = H.start(), A = S.A, c = S.c, T = S.T, hz, room, res;
H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Harl's Forge][LOCATION_DESC:A smithy.] In."); hz = A.at;
H.turn("[SUBLOCATION:The Nook][LOCATION_DESC:A NOOK WITH A STOOL.][LOCATION_ITEM:Stool|placed] A nook."); out("nook added", !!atlasFind(atlasDoc(hz), "The Nook")); out("adds", Object.keys(A.adds)); out("interior edits", JSON.stringify(A.zones[hz].params && A.zones[hz].params.edits));
H.turn("[SUBLOCATION:Harl's Forge] Back at the door."); out("pointer", H.sub()); out("preview", atlasPlacePreview());
room = atlasDoc(hz).rooms.filter(function (r) { return r.name !== "The Nook" && atlasFind(atlasDoc(hz), r.name) && atlasFind(atlasDoc(hz), r.name).thing; })[0]; H.quiet();
res = atlasPlace(hz, { id: room.id }); out("tap on " + room.name, { ok: res.ok, bound: res.bound, level: res.level, reason: res.reason });
out("nook still on the forge's sheet?", !!(A.zones[hz] && atlasFind(atlasDoc(hz), "The Nook"))); out("adds", Object.keys(A.adds)); out("interior edits", JSON.stringify(A.zones[hz] && A.zones[hz].params && A.zones[hz].params.edits)); out("told this turn", atlasToldLines(A)); out("toasts", H.toasts);
out("nook node still in memory.map?", !!H.node(T + "|Harl's Forge" + SEP + "The Nook"));
H.quiet(); H.turn("[SUBLOCATION:The Nook] Back to the nook."); out("sub", H.sub()); out("nook re-added?", !!atlasFind(atlasDoc(A.at), "The Nook") + " adds=" + JSON.stringify(Object.keys(A.adds))); out("toasts", H.toasts); out("geo has STOOL", buildGeoBlock().indexOf("A NOOK WITH A STOOL") >= 0);
