// p23 — is the twin ever healed? The #128 name-variant scan (summarize cadence) and the confirm note.
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Queen Underbough", 85);
function twin(canon) {
  fresh(); person("Wilhelmina Underbough", "she/her"); run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86;
  run("It is her. [NPC_MERGE:" + canon + "|" + K + "]"); worldState.turn = 87;
  var q = quiet(function () { return scanNpcNameVariants(); });
  hdr("twin '" + canon + "'"); line("mem", mems()); line("variant scan queued", q.r + " " + JSON.stringify(worldState.pendingMergeHints || []));
  worldState.turn = 88; var c = quiet(function () { return buildMergeConfirmNudge(); }).r; line("confirm note", c ? c.slice(46, 260) : "(none)");
}
twin("Wilhelmina"); twin("Underbough"); twin("wilhelmina underbough"); twin("Princess Underbough");
