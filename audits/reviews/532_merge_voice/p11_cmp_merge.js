// Merge-mode differential: for every surviving character, what speech resolves to (voice, cloud actors, direction, speed)
// in BEFORE vs AFTER after the same seeded op sequence. A REGRESSION here = a value BEFORE served from a PIN on the pin owner
// (sheet, else row) that AFTER no longer serves. A value AFTER serves where BEFORE had none or an auto-cast is the fix working.
//   node p11_cmp_merge.js before.jsonl after.jsonl
var fs = require("fs");
function load(f) { var o = {}; fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(function (l) { if (!l) return; var j = JSON.parse(l); o[j.seed] = j; }); return o; }
var B = load(process.argv[2]), A = load(process.argv[3]);
function flat(sp) { if (!sp) return {}; return { voiceId: sp[0], speechifyVoiceId: sp.providers && sp.providers.speechify ? sp.providers.speechify[0] : undefined, inworldVoiceId: sp.providers && sp.providers.inworld ? sp.providers.inworld[0] : undefined, voiceDirection: sp.directions ? sp.directions[0] : undefined, voiceRate: sp.rates ? sp.rates[0] : undefined }; }
var F = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"];
var same = 0, gained = 0, lostPinned = 0, changedPinned = 0, changedAuto = 0, modelGone = 0, rosterDiff = 0, nullBoth = 0, ex = [];
Object.keys(A).forEach(function (seed) {
  var b = B[seed], a = A[seed];
  if (JSON.stringify(Object.keys(b.final)) !== JSON.stringify(Object.keys(a.final))) { rosterDiff++; return; }
  Object.keys(a.final).forEach(function (nm) {
    var bo = b.final[nm].sheet || b.final[nm].row, fb = flat(b.speech[nm]), fa = flat(a.speech[nm]);
    if (!b.speech[nm] && !a.speech[nm]) nullBoth++;
    F.forEach(function (f) {
      if (fb[f] === fa[f]) { same++; return; }
      if (fb[f] === "MODEL" || fb[f] === 1.25) { modelGone++; return; }   // the fuzz marks model-authored values "MODEL" and 1.25
      var pinned = bo[f] !== undefined && bo[f] === fb[f];
      if (fb[f] === undefined) { gained++; return; }
      if (!pinned) { changedAuto++; return; }      // BEFORE's value was an auto-cast by name, AFTER serves a carried pin
      if (fa[f] === undefined) lostPinned++; else changedPinned++;
      if (ex.length < 3) ex.push("seed " + seed + " " + nm + "." + f + ": before(pinned)=" + JSON.stringify(fb[f]) + " after=" + JSON.stringify(fa[f]) + " | " + a.ops.join(" ; "));
    });
  });
});
console.log("per character x field at speech time: same " + same + " | AFTER serves a value BEFORE lacked " + gained + " | BEFORE auto-cast, AFTER carried pin " + changedAuto + " | model-authored value gone " + modelGone + " | BEFORE's PINNED value lost " + lostPinned + " | BEFORE's PINNED value replaced " + changedPinned + " | rosters differ " + rosterDiff + " | no speaker record in both " + nullBoth);
ex.forEach(function (e) { console.log("  " + e.slice(0, 700)); });
