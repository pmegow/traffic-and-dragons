// p13-wild-keys.js — the "p:<kind>:<via>" stand (a wild zone on the realm) is written and read by code no #717 group
// runs (mutants MU4, MU5 and MU13 live). On the REAL code: an open-country start (#708: the story's start is "open"),
// a walk to a town, then through a wild zone's edge into the next zone — is the wild stand kept, read back after the
// party has left, joined by a leg, and is the wild sheet itself fogged?
// node dev/review-717/p13-wild-keys.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
(function () {
  H.stubs(); var A = H.fresh("campaign-1", true), c = H.cast(A), wz, w, edge, r, key, xy, wz2;
  worldState.world.location = "The Wreck of the Gull"; A.kinds[atlasLocKey("The Wreck of the Gull")] = { kind: "open", ground: "coast", by: "story", turn: 0 };
  atlasFollow(); wz = A.at;
  out("start", { at: wz, kind: wz && A.zones[wz].kind, spot: A.spot, off: A.off && A.off.why, tie: A.names[atlasLocKey("The Wreck of the Gull")] });
  if (!wz || A.zones[wz].kind !== "wild") { out("stopped", "the open start did not land in a wild zone here: " + JSON.stringify(H.toasts.slice(-2))); return; }
  out("realm record", H.seen(A, A.seed)); key = A.seen[A.seed].at[0]; xy = atlasSeenXY(A, A.seed, atlasDoc(A.seed), key); out("the key reads back as", xy);
  out("the wild sheet's fog while the party is 'somewhere here'", atlasReveal(wz));
  H.turn("[LOCATION:" + c.p0.name + "] Inland to the capital.");
  out("realm record after the walk", H.seen(A, A.seed)); r = atlasReveal(A.seed);
  out("the realm still shows the shore the party left", r.points.some(function (p) { return p[0] === xy[0] && p[1] === xy[1]; })); out("ways on the realm", r.paths.length);
  out("the wild sheet after the party left (nothing was ever a known stand there)", atlasReveal(wz));
  H.turn("[LOCATION:The Wreck of the Gull] Back to the wreck."); w = atlasDoc(A.at); edge = w.portals.filter(function (p) { return p.kind === "edge" && p.to; })[0];
  out("back in the wild zone", { at: A.at, spot: A.spot }); out("edges", w.portals.map(function (p) { return p.name + "#" + p.id + " -> " + (p.to ? p.to.generator + ":" + p.to.id : "nowhere"); }));
  if (edge) { H.turn("[SUBLOCATION:" + edge.name + "] Through the " + edge.name + " edge."); wz2 = A.at; out("after naming the edge", { at: A.at, kind: A.zones[A.at].kind, spot: A.spot, off: A.off && A.off.why }); out("realm record", H.seen(A, A.seed)); out("first wild sheet's record", H.seen(A, wz)); out("second wild sheet's record", H.seen(A, wz2)); out("second wild sheet's fog", atlasReveal(wz2)); }
  out("toasts", H.toasts.slice(-4)); out("reports", H.reports);
})();
