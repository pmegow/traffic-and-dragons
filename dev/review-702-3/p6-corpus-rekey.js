// p6-corpus-rekey.js — the real mapped corpus (dev/corpus_spotcheck_684_v1353.json): what does final.snap hold, and at HEAD does
// every saved sub-location node key re-resolve to itself through the map (no re-keying of existing nodes by the new rules)?
var ROOT = process.argv[2], fs = require("fs"), path = require("path");
var H = require("../review-702/h.js")(ROOT), say = H.say;
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var c = JSON.parse(fs.readFileSync(path.join(ROOT, "dev", "corpus_spotcheck_684_v1353.json"), "utf8"));
out("final keys", Object.keys(c.final)); out("snap keys", c.final.snap ? Object.keys(c.final.snap).slice(0, 40) : null);
out("mapNodes", c.final.mapNodes ? (Array.isArray(c.final.mapNodes) ? c.final.mapNodes.slice(0, 30) : Object.keys(c.final.mapNodes).slice(0, 30)) : null);
out("zones", Object.keys(c.final.zones));
var snap = c.final.snap;
if (snap && snap.loc && snap.atlas) {
  H.startBare(); worldState.world.location = snap.loc; worldState.world.sublocation = snap.sub || null; worldState.turn = snap.turn || worldState.turn;
  /* the probe's summary is not the store: rebuild one from the recipes it kept (as s6 did) */
  worldState.atlas = { v: 1, seed: snap.atlas.seed, at: snap.atlas.at, spot: snap.atlas.spot, off: null, ptr: null, zones: JSON.parse(JSON.stringify(c.final.zones)), names: {} };
  out("pointer", snap.loc + " / " + snap.sub); out("atlas store keys", Object.keys(worldState.atlas)); out("at/spot/off before", worldState.atlas.at + " / " + worldState.atlas.spot + " / " + JSON.stringify(worldState.atlas.off));
  if (c.final.mapNodes && !Array.isArray(c.final.mapNodes)) memory.map.nodes = JSON.parse(JSON.stringify(c.final.mapNodes));
  else if (Array.isArray(c.final.mapNodes)) c.final.mapNodes.forEach(function (k) { ensureMapNode(k, 1, k.indexOf("|") > 0 ? k.slice(0, k.indexOf("|")) : undefined); });
  out("heal", atlasHeal()); out("junk", worldState.atlasJunk ? worldState.atlasJunk.why : null); if (!worldState.atlas) { out("stop", "the store was set aside — the snapshot is not the game's store shape; nothing more to read"); process.exit(0); }
  atlasForget(); H.quiet(); var r = atlasFollow(); out("follow", r && { at: r.at, spot: r.spot, off: r.off }); out("where", atlasWhere().text); out("toasts", H.toasts);
  var ks = Object.keys(memory.map.nodes).filter(function (k) { return k.indexOf("|") > 0; }), bad = [];
  ks.forEach(function (k) { var w = k.slice(0, k.indexOf("|")), leaf = k.slice(k.indexOf("|") + 1), rp = resolvePlaceName(leaf, w, { sub: null }); if (!rp || rp.key !== k) bad.push(k + " -> " + (rp ? rp.key + " (" + rp.via + ")" : "null")); });
  out("sub-location nodes", ks.length); out("nodes that do NOT re-resolve to themselves from the street", bad);
} else out("snap", "no worldState-shaped snapshot (world/atlas) — nothing to load");
