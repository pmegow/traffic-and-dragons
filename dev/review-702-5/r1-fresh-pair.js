// r1-fresh-pair.js — the fifth reviewer: the fresh path one step further. The guard now compares X with the CONTAINER
// (pos.unknown[0]); but X may itself be a PATH that opens with the container — the taught pair form written in the same
// reply as the building ("[SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur — Kitchen]"). Is the key then
// "Spur — Spur — Kitchen"? And does the room re-stated bare in the NEXT reply land on a twin node?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function authored(c) { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }); }

hr("R1a one reply: [SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur — Kitchen] — the building, then the taught pair");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("In, and to its kitchen. [SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:KITCHEN FIRST.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at/spot", A.at + "/" + A.spot);
  out("resolve 'The Gilded Spur — Kitchen' at sub 'The Gilded Spur' fresh", resolvePlaceName("The Gilded Spur" + SEP + "Kitchen", T, { sub: "The Gilded Spur", fresh: true }));
  out("town sheet gained", authored(c)); out("toasts", H.toasts);
  H.quiet(); H.turn("[SUBLOCATION:Kitchen][LOCATION_DESC:KITCHEN AGAIN.] Still here.");
  out("next reply sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("geo has KITCHEN FIRST", buildGeoBlock().indexOf("KITCHEN FIRST") >= 0);
  out("house rooms named Kitchen", (atlasDoc(A.at).rooms || []).filter(function (r) { return /kitchen/i.test(r.name); }).map(function (r) { return r.name + "#" + r.id; }));
})();

hr("R1b one reply: [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:The Gilded Spur — Kitchen] — the room, then the pair re-stating it");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:K2.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off); out("town sheet gained", authored(c)); out("toasts", H.toasts);
})();

hr("R1c control, two replies: [SUBLOCATION:The Gilded Spur] then [SUBLOCATION:The Gilded Spur — Kitchen]");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.turn("[SUBLOCATION:The Gilded Spur] In."); H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:K3.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off);
})();

hr("R1d one reply with a KNOWN inn: [SUBLOCATION:<inn>][SUBLOCATION:<inn> — Scullery] — the control for the fresh path (the chain answers)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:" + c.inn.name + "][SUBLOCATION:" + c.inn.name + SEP + "Scullery][LOCATION_DESC:S.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Scullery")); out("adds", Object.keys(A.adds)); out("off", A.off);
})();

hr("R1g one reply: [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen — Pantry] — a pair of two rooms inside the invented building (a key with a room in the middle?)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen" + SEP + "Pantry][LOCATION_DESC:PANTRY FIRST.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off); out("town sheet gained", authored(c)); out("toasts", H.toasts);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:PANTRY AGAIN.]"); out("next: sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("geo has PANTRY FIRST", buildGeoBlock().indexOf("PANTRY FIRST") >= 0);
})();

hr("R1e one reply: [SUBLOCATION:The Gilded Spur][SUBLOCATION:the gilded spur — kitchen] — case and article differ");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:the gilded spur - kitchen][LOCATION_DESC:K5.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("ilded")); out("adds", Object.keys(A.adds)); out("off", A.off); out("town sheet gained", authored(c));
})();
