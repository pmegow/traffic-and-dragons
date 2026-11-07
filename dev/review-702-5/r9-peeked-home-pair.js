// r9-peeked-home-pair.js — the fifth reviewer: the TAUGHT pair on a town entered THIS reply ("[LOCATION:<p1>][SUBLOCATION:
// <p1 inn> — Kitchen]"): the home sheet is peeked when the key is read, and the strip's atlasLeads routes from it. At HEAD
// the adapters answer; under mutant #8 (the adapters dropped from the strip) the store is asked. Run against both trees.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var S = H.start(), A = S.A, c = S.c, t1doc, i1;
t1doc = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, c.p1.id)); i1 = t1doc.establishments.filter(function (e) { return e.kind === "inn"; })[0];
out("p1 inn", i1.name); out("p1 recorded before?", !!A.zones[A.seed + "/" + c.p1.id]);
H.quiet(); H.turn("On to the next town, straight into its inn's kitchen. [LOCATION:" + c.p1.name + "][SUBLOCATION:" + i1.name + SEP + "Kitchen][LOCATION_DESC:K.]");
out("sub", H.sub()); out("A.at kind/via", [A.zones[A.at] && A.zones[A.at].kind, A.zones[A.at] && A.zones[A.at].via]); out("reports", H.reports); out("warns", H.warns.filter(function (w) { return /atlas/.test(w); })); out("toasts", H.toasts); out("off", A.off);
