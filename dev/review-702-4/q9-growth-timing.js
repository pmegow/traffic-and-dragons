// q9-growth-timing.js — the fourth reviewer: how long the growth turn takes against an ordinary room turn (monotonic pass).
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }
var S = H.start(), A = S.A, c = S.c, ed, i, t0, grew = null, plain = [];
H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Gilded Spur] In."); ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
for (i = 1; i <= 6; i++) { var was = ed.footprint; t0 = Date.now(); H.turn("[SUBLOCATION:Store Room " + i + "] A store."); var ms = Date.now() - t0; if (was !== ed.footprint) grew = ms; else plain.push(ms); }
out("growth turn ms", grew); out("ordinary room turns ms", plain);
