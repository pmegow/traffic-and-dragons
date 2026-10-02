// Settings-mode differential, the question that matters: did AFTER ever lose or replace a PLAYER-set direction that BEFORE
// still served at speech time? (A fuzz "MODEL" value is the model-authored one the fix is meant to discard.)
//   node p11_cmp_settings.js before.jsonl after.jsonl
var fs = require("fs");
function load(f) { var o = {}; fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(function (l) { if (!l) return; var j = JSON.parse(l); o[j.seed] = j; }); return o; }
var B = load(process.argv[2]), A = load(process.argv[3]);
var worse = 0, better = 0, modelGone = 0, same = 0, ex = null;
Object.keys(A).forEach(function (seed) {
  var b = B[seed], a = A[seed];
  Object.keys(a.speech).forEach(function (nm) {
    var bd = b.speech[nm] && b.speech[nm].directions ? b.speech[nm].directions[0] : undefined;
    var ad = a.speech[nm] && a.speech[nm].directions ? a.speech[nm].directions[0] : undefined;
    if (bd === ad) { same++; return; }
    if (bd === "MODEL") { modelGone++; return; }           // a model-authored direction no longer read
    if (bd === undefined && ad !== "MODEL") { better++; return; }   // a player's direction now read where BEFORE read none
    worse++; if (!ex) ex = "seed " + seed + " " + nm + ": before=" + JSON.stringify(bd) + " after=" + JSON.stringify(ad) + " | " + a.ops.join(" ; ");
  });
});
console.log("direction read at speech time, per character: same " + same + " | model-authored one no longer read " + modelGone + " | player's now read (BEFORE read none) " + better + " | player's lost or replaced in AFTER " + worse);
if (ex) console.log("  first: " + ex);
