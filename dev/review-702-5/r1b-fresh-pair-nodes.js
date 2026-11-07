// r1b-fresh-pair-nodes.js — the fifth reviewer: R1a one level down. The pointer read "The Gilded Spur — The Gilded Spur —
// Kitchen" while memory.map held "…|The Gilded Spur — Kitchen": where did the description go, what is the GM told, and
// what does the pane say? Then the same with the pointer re-resolved on the next reply.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function nodesFull() { var ks = Object.keys(memory.map.nodes).filter(function (k) { return /Spur|Kitchen/.test(k); }); return ks.map(function (k) { var n = memory.map.nodes[k]; return k + " => desc:" + JSON.stringify(n.desc || n.description || null) + " parent:" + n.parent + " visits:" + (n.visits || n.visitCount || "?"); }); }

hr("R1a again, with the nodes' descriptions and the GM's view");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, R;
  H.quiet(); R = H.mutsOf("In, and to its kitchen. [SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:KITCHEN FIRST.]");
  out("muts (parse only, no follow)", R && R.muts); out("pointer after the parse", worldState.world.sublocation); out("nodes", nodesFull());
  out("locResolve(pointer key)", locResolve(T + "|" + worldState.world.sublocation)); out("aliases for Spur", Object.keys(memory.map.aliases || {}).filter(function (k) { return /Spur/.test(k); }).map(function (k) { return k + " -> " + memory.map.aliases[k]; }));
  out("current node (locResolve)", (function () { var n = memory.map.nodes[locResolve(T + "|" + worldState.world.sublocation)]; return n ? JSON.stringify(n).slice(0, 300) : null; })());
})();

hr("R1a as a committed turn: the pointer, the where-line, the geo block, the pane's preview and ties");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.quiet(); H.turn("In, and to its kitchen. [SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:KITCHEN FIRST.]");
  out("pointer", worldState.world.sublocation); out("nodes", nodesFull()); out("where", atlasWhere().text); out("preview", atlasPlacePreview());
  out("geo block lines with Spur", buildGeoBlock().split("\n").filter(function (l) { return /Spur|KITCHEN/.test(l); }).map(function (l) { return l.slice(0, 200); }));
  out("told", H.told(A));
  H.quiet(); H.turn("[SUBLOCATION:Kitchen][LOCATION_DESC:KITCHEN AGAIN.] Still here.");
  out("next pointer", worldState.world.sublocation); out("nodes", nodesFull()); out("geo lines", buildGeoBlock().split("\n").filter(function (l) { return /Spur|KITCHEN/.test(l); }).map(function (l) { return l.slice(0, 200); }));
  H.quiet(); H.turn("[SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:KITCHEN THIRD.] The pair again, next reply.");
  out("third pointer", worldState.world.sublocation); out("nodes", nodesFull());
})();

hr("R1f the reader for the doubled pointer: where does 'The Gilded Spur — The Gilded Spur — Kitchen' put the party once the Spur is on the map?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, pos;
  H.turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:KITCHEN FIRST.]");
  pos = atlasPosition(A, T, "The Gilded Spur" + SEP + "The Gilded Spur" + SEP + "Kitchen"); out("chain/zone/spot/used/unknown", [pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name, pos.used, pos.unknown]);
  out("A.at/spot", A.at + "/" + A.spot); out("interior title", atlasDoc(A.at).title && atlasDoc(A.at).title.name);
})();
