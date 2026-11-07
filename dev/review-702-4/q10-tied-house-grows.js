// q10-tied-house-grows.js — the fourth reviewer: a custom place the PLAYER tied another story name to (a GM 'at' or a tap
// onto its door) — does it still grow, and does the tie survive the redraw (same door id)?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }
var S = H.start(), A = S.A, T = S.T, c = S.c, sz, door, ed, i, grewAt = 0, r;
H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; door = A.zones[sz].via; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:Widow Hale's House] A house."); H.quiet();
r = atlasPlace(c.townId, { id: door }); out("tap: Widow Hale's House is at the Spur's door", { ok: r.ok, reason: r.reason }); out("names", A.names); out("adds", Object.keys(A.adds));
for (i = 1; i <= 8 && !grewAt; i++) { H.quiet(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); if (ed.footprint === "large") grewAt = i; }
out("grew at", grewAt); out("sub", H.sub()); out("names after", A.names); out("tie's thing still there", !!atlasThingById(atlasDoc(c.townId), door)); out("where", atlasWhere().text); out("A.at", A.at + " = spur zone? " + (A.at === sz));
