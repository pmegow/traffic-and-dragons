// Replays the shortest sequences found by f01_fuzz.js on THIS tree and says whether each violation reproduces.
// usage: TREE=before node f02_replay.js <label> [verbose-sig-substring]
require("./b.js"); require("./inv.js");
var fs = require("fs"), label = process.argv[2] || "run", verbose = process.argv[3] || "";
var list = JSON.parse(fs.readFileSync(__dirname + "/out_" + label + ".json", "utf8"));
function provKeys() { return Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }); }
global.replaySeq = function (seq, trace) {
  setupWorld(seq.cfg);
  var sigs = {}, renamed = {}, confirmedInto = {}, t;
  for (t = 0; t < seq.steps.length; t++) {
    var st = seq.steps[t];
    if (st.swap) heroSwap(st.swap);
    quiet(function () { buildMergeConfirmNudge(); buildProvisionalNudge(); });
    worldState.turn++;
    var pre = snap(), before = {}; provKeys().forEach(function (k) { before[k] = memory.npcs[k].provisional.of; });
    var res; try { res = run(st.reply); } catch (e) { sigs["THROW " + e.message] = 1; break; }
    (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (!mm) return;
      if (before[mm[1]] && !memory.npcs[mm[1]] && resolveNpcName(mm[2]) !== resolveNpcName(before[mm[1]])) renamed[mm[1]] = mm[2];
      if (pre.armed === mm[2] + "|" + mm[1] || !pre.refs) confirmedInto[mm[2]] = 1; });
    var vs = checkReply(pre, res, st.reply).concat(checkNotes(renamed, confirmedInto));
    vs.forEach(function (x) { sigs[x] = 1; });
    if (trace) { console.log("   t" + worldState.turn + (st.swap ? " (hero swap -> " + st.swap + ")" : "") + (pre.armed ? " (armed " + pre.armed + ")" : "") + ": " + st.reply + "\n      muts=" + JSON.stringify(res.muts) + (res.warns.length ? "\n      warns=" + JSON.stringify(res.warns.map(function (w) { return w.slice(0, 200); })) : "") + "\n      ROWS " + rows() + "\n      MEM  " + mems() + (vs.length ? "\n      !! " + vs.join(" | ") : "")); }
  }
  checkStranded().forEach(function (x) { sigs[x] = 1; });
  return sigs;
};
if (require.main === module) {
  list.forEach(function (o) {
    var sigs = replaySeq(o.seq, false), same = !!sigs[o.sig];
    console.log((same ? "REPRODUCES  " : "does not    ") + o.sig + "   [" + o.count + "]" + (same ? "" : "   (this tree shows: " + (Object.keys(sigs).join(" | ") || "nothing") + ")"));
    if (verbose && o.sig.indexOf(verbose) >= 0) { console.log("  cfg " + JSON.stringify(o.seq.cfg)); replaySeq(o.seq, true); }
  });
}
