// Compares two p11_fuzz "diff" outputs seed by seed and classifies every difference.
//   node p11_cmp.js before.jsonl after.jsonl
// "slot" differences = a voice slot pin or the resolved voice differs; "setting" = direction / speed only.
var fs = require("fs");
function load(f) { var o = {}; fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(function (l) { if (!l) return; var j = JSON.parse(l); o[j.seed] = j; }); return o; }
var B = load(process.argv[2]), A = load(process.argv[3]);
var SLOTS = ["speechifyVoiceId", "inworldVoiceId", "voiceId"], SETTINGS = ["voiceDirection", "voiceRate"];
var same = 0, slotDiff = [], settingOnly = 0, kinds = {}, examples = {};
function note(kind, seed, text) { kinds[kind] = (kinds[kind] || 0) + 1; if (!examples[kind]) examples[kind] = "seed " + seed + ": " + text; }
Object.keys(A).forEach(function (seed) {
  var b = B[seed], a = A[seed];
  if (JSON.stringify(b.final) === JSON.stringify(a.final) && JSON.stringify(b.speech) === JSON.stringify(a.speech)) { same++; return; }
  var slot = false, names = Object.keys(a.final).concat(Object.keys(b.final)).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
  names.forEach(function (nm) {
    var bf = b.final[nm], af = a.final[nm];
    if (!bf || !af) { slot = true; note("roster differs", seed, nm); return; }
    ["row", "sheet"].forEach(function (side) {
      var x = bf[side] || {}, y = af[side] || {};
      SLOTS.forEach(function (f) {
        if (x[f] === y[f]) return;
        slot = true;
        var k = side + "." + f + ": " + (x[f] ? (y[f] ? "CHANGED" : "LOST in AFTER") : "GAINED in AFTER");
        note(k, seed, nm + " before=" + JSON.stringify(x[f]) + " after=" + JSON.stringify(y[f]) + " | ops: " + a.ops.join(" ; "));
      });
      SETTINGS.forEach(function (f) {
        if (x[f] === y[f]) return;
        var k = side + "." + f + ": " + (x[f] ? (y[f] ? "CHANGED" : "LOST in AFTER") : "GAINED in AFTER");
        note(k, seed, nm + " before=" + JSON.stringify(x[f]) + " after=" + JSON.stringify(y[f]) + " | ops: " + a.ops.join(" ; "));
      });
    });
    var bs = b.speech[nm], as = a.speech[nm];
    if ((bs && bs[0]) !== (as && as[0])) { slot = true; note("speech voice differs", seed, nm + " before=" + JSON.stringify(bs && bs[0]) + " after=" + JSON.stringify(as && as[0]) + " | ops: " + a.ops.join(" ; ")); }
  });
  if (slot) slotDiff.push(seed); else settingOnly++;
});
console.log("seeds: " + Object.keys(A).length + " | identical: " + same + " | direction/speed differences only: " + settingOnly + " | a slot pin or the resolved voice differs: " + slotDiff.length);
Object.keys(kinds).sort().forEach(function (k) { console.log("  " + kinds[k] + " x " + k + "\n      e.g. " + examples[k].slice(0, 520)); });
