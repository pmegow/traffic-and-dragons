// p07 — a stale ° key re-emitted after the answer: #156 shape vs #504 shape; and what can still merge the leftover. PROBE_TREE=pre|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
hdr("#156 shape: Savah Thorn °t140 folded back, then [NPC:Savah Thorn °t140|…] again");
fresh({ turn: 140 }); person("Savah Thorn", "she/her");
run("[NPC:Savah Thorn|counting vials|unknown, not yet met]"); worldState.turn = 141;
run("[NPC_MERGE:Savah Thorn|" + PK("Savah Thorn", 140) + "]"); worldState.turn = 142;
var r = run("[NPC:" + PK("Savah Thorn", 140) + "|pacing|hostile]");
line("mem", mems()); line("rows", rows());

if (typeof npcTitleAsk === "function") {
  hdr("#504 shape: Queen Underbough °t85 folded back, then the ° key again; then every channel that could clean it up");
  fresh(); person("Wilhelmina Underbough", "she/her");
  run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86;
  run("[NPC_MERGE:Wilhelmina Underbough|" + PK("Queen Underbough", 85) + "]"); worldState.turn = 87;
  r = run("[NPC:" + PK("Queen Underbough", 85) + "|pacing|hostile] [NPC_NOTE:" + PK("Queen Underbough", 85) + "|a note]");
  line("mem", mems()); line("rows", rows());
  var q = quiet(function () { return scanNpcNameVariants(); });
  line("#128 variant scan queued", q.r + " " + JSON.stringify(worldState.pendingMergeHints || []));
  var i, fired = 0; for (i = 0; i < 12; i++) { worldState.turn++; if (quiet(function () { return buildProvisionalNudge(); }).r) fired++; }
  line("collision note fired in 12 turns", fired);
  r = run("[NPC_MERGE:Wilhelmina Underbough|" + PK("Queen Underbough", 85) + "]");
  line("an unprompted [NPC_MERGE:Wilhelmina Underbough|°key] -> mem", mems()); line("hints", JSON.stringify(worldState.pendingMergeHints || []));
  worldState.turn++; var c = quiet(function () { return buildMergeConfirmNudge(); }).r; line("confirm note", c ? c.slice(0, 200) : "(none)");
}
