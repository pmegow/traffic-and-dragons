// s6-settle.js — the saved atlases of the two spot-check corpora under this build: which zones are said redrawn, and why.
var ROOT = process.argv[2], fs = require("fs"), path = require("path");
var H = require("./h.js")(ROOT), say = H.say;
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function settleStore(label, zones, names) {
  say("\n== " + label);
  H.startBare(); var seed = Object.keys(zones).filter(function (z) { return !zones[z].parent; })[0];
  worldState.atlas = { v: 1, seed: seed, at: null, spot: null, off: null, ptr: null, zones: JSON.parse(JSON.stringify(zones)), names: names || {} };
  var healed = atlasHeal(); out("heal changed", healed + (worldState.atlasJunk ? " JUNK: " + worldState.atlasJunk.why : ""));
  if (!worldState.atlas) return;
  var A = worldState.atlas; atlasForget(); H.quiet();
  Object.keys(A.zones).forEach(function (z) {
    var rec = A.zones[z], was = { fp: rec.fp, lib: rec.lib, fpv: rec.fpv }, d, f1, f2;
    try { d = atlasDoc(z); } catch (e) { out(z, "DRAW FAILED: " + e.message); return; }
    f1 = atlasFingerprint(d, rec.lib, 1, rec.params || undefined); f2 = atlasFingerprint(d, rec.lib, 1);
    atlasSettleChain(A, z);
    out(z, rec.kind + " " + (rec.name || "") + " | record " + JSON.stringify(was) + " | scheme1(recipe params)=" + f1 + " scheme1(today's echo)=" + f2 + " | now " + JSON.stringify({ fp: rec.fp, lib: rec.lib, fpv: rec.fpv }) + (rec.redrawn ? " | REDRAWN " + JSON.stringify(rec.redrawn) : " | settled silently"));
  });
  out("toasts", H.toasts); out("warns", H.warns.filter(function (w) { return /atlas/.test(w); }));
}
var c684 = JSON.parse(fs.readFileSync(path.join(ROOT, "dev", "corpus_spotcheck_684_v1353.json"), "utf8"));
settleStore("corpus_spotcheck_684_v1353.json final.zones (library 0.12.0 records, scheme 1)", c684.final.zones, {});
var c693 = JSON.parse(fs.readFileSync(path.join(ROOT, "dev", "corpus_spotcheck_693_v1361.json"), "utf8"));
say("\n== corpus_spotcheck_693_v1361.json atlas.zones"); out("shape", JSON.stringify(c693.atlas.zones)); out("verdict", Array.isArray(c693.atlas.zones) ? "an ARRAY of zone ids — no recipes, no fingerprints: nothing to settle from this file" : "records");
/* the suite's own 0.12.0 records of the fixture realm, as a control */
say("\n== the fixture realm's 0.12.0 records (ATLAS_RECORDS_0_12 of the suite) as scheme-1 records");
(function () {
  var A = H.fresh("campaign-1"), c = H.cast(A), REC = { "campaign-1": "89d812b3-5vq5", "campaign-1/p0": "ad9ad4eb-2y0f", "campaign-1/p0/inn-1": "dafa5fef-al3", "campaign-1/p0/sewer": "244e0f70-tpf", "campaign-1/c0": "a7204fce-60w", "campaign-1/z202_178": "e02a63d6-efp" };
  H.point(c.p0.name); atlasFollow(); H.townCast(A, c); H.point(c.p0.name, c.inn.name); atlasFollow(); H.point(c.p0.name, c.grates[0].name); atlasFollow(); H.point(c.reg.caves[0].name); atlasFollow(); H.point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
  Object.keys(REC).forEach(function (z) { A.zones[z].fp = REC[z]; A.zones[z].lib = "0.12.0"; delete A.zones[z].fpv; delete A.zones[z].redrawn; });
  /* the root recipe's params as 0.12.0 echoed them: no `edits` */
  delete A.zones["campaign-1"].params.edits;
  atlasForget(); H.quiet(); Object.keys(REC).forEach(function (z) { atlasDoc(z); atlasSettleChain(A, z); });
  out("redrawn", Object.keys(REC).filter(function (z) { return A.zones[z].redrawn; })); out("toasts", H.toasts);
})();
