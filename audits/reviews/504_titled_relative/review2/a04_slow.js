require("./b.js"); require("./inv.js");
var s = JSON.parse(require("fs").readFileSync(__dirname + "/seqs_big1.json", "utf8"))[parseInt(process.argv[2] || "705", 10)];
setupWorld(s.cfg);
s.steps.forEach(function (st, i) {
  if (st.swap) heroSwap(st.swap);
  var t0 = Date.now(); quiet(function () { buildMergeConfirmNudge(); buildProvisionalNudge(); }); var t1 = Date.now();
  worldState.turn++;
  var pre = snap(); var res = run(st.reply); var t2 = Date.now();
  var v = checkReply(pre, res, st.reply); var t3 = Date.now();
  console.log("t" + worldState.turn + " notes " + (t1 - t0) + "ms apply " + (t2 - t1) + "ms check " + (t3 - t2) + "ms :: " + st.reply + "\n   muts=" + JSON.stringify(res.muts) + "\n   MEM " + mems() + "\n   ROWS " + rows() + "\n   hero=" + worldState.character.name + " heroAliases=" + JSON.stringify(worldState.character.aliases || []));
});
var t4 = Date.now(); var st2 = checkStranded(); console.log("stranded check " + (Date.now() - t4) + "ms " + JSON.stringify(st2));
