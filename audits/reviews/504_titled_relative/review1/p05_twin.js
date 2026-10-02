// p05 — the SAME answer written with a short or variant form of the established person's name. Scene refs active.
// PROBE_TREE=pre|mid|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
function titleCase(canon) {
  fresh(); person("Wilhelmina Underbough", "she/her");
  run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86;
  var K = Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; })[0];
  if (!K) { console.log("(no provisional on this tree — #504 not present)"); return; }
  var r = run("It is her. [NPC_MERGE:" + canon + "|" + K + "]");
  console.log("#504 provisional, answer [NPC_MERGE:" + canon + "|" + K + "]");
  line("mem", mems()); line("rows", rows()); line("muts", JSON.stringify(r.muts)); line("hints", JSON.stringify(worldState.pendingMergeHints || []));
  worldState.turn = 92; var note = quiet(function () { return buildProvisionalNudge(); }).r; line("collision note 6 turns later", note ? "fires" : "(silent — the engine believes the question is answered)");
  r = run("[NPC:Wilhelmina|smiling|ally] [NPC_NOTE:Wilhelmina|promised the hero a boon]");
  line("then [NPC:Wilhelmina|smiling|ally]+[NPC_NOTE:Wilhelmina|…] -> rows", rows()); line("mem", mems());
  line("resolve: Wilhelmina / Underbough / Queen Underbough", [resolveNpcName("Wilhelmina"), resolveNpcName("Underbough"), resolveNpcName("Queen Underbough")].join(" / "));
}
function introCase(canon) {
  fresh({ turn: 140 }); person("Belor Hemlock", "he/him");
  run("[NPC:Belor Hemlock|counting vials|unknown, not yet met]"); worldState.turn = 141;
  var K = PK("Belor Hemlock", 140);
  var r = run("Same man. [NPC_MERGE:" + canon + "|" + K + "]");
  console.log("#156 provisional, answer [NPC_MERGE:" + canon + "|" + K + "]");
  line("mem", mems()); line("rows", rows()); line("muts", JSON.stringify(r.muts)); line("hints", JSON.stringify(worldState.pendingMergeHints || []));
  line("resolve: Belor / Hemlock / Sheriff Hemlock", [resolveNpcName("Belor"), resolveNpcName("Hemlock"), resolveNpcName("Sheriff Hemlock")].join(" / "));
}
hdr("A. #504 provisional");
["Wilhelmina Underbough", "Wilhelmina", "Underbough", "Princess Underbough", "wilhelmina underbough", "Princess Wilhelmina Underbough"].forEach(titleCase);
hdr("B. #156 provisional");
["Belor Hemlock", "Belor", "Hemlock", "Sheriff Hemlock", "Sheriff Belor Hemlock", "belor hemlock"].forEach(introCase);
