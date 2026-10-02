// p03 — the shapes a GM's answer can take, scene refs ACTIVE (live play). What lands, what is dropped, what forks.
require("./base.js");
var K = PK("Queen Underbough", 85);
function setup(extra) {
  fresh(); person("Wilhelmina Underbough", "she/her");
  if (extra) extra();
  run("[NPC:Queen Underbough|furious|hostile] [NPC_PRONOUN:Queen Underbough|she/her]"); worldState.turn = 86;
}
function answer(label, text, extra) {
  setup(extra);
  var r = run(text);
  console.log(label + "\n   tags:  " + text + "\n   rows:  " + rows() + "\n   mem:   " + mems() + "\n   muts:  " + JSON.stringify(r.muts) + "\n   hints: " + JSON.stringify(worldState.pendingMergeHints || []) + "\n   warns: " + JSON.stringify(r.warns.filter(function (w) { return /identity|merge/i.test(w); }).map(function (w) { return w.slice(0, 160); })));
  return r;
}
function nextNotes(label) {
  worldState.turn += 1;
  var a = quiet(function () { return buildMergeConfirmNudge(); }).r, b = quiet(function () { return buildProvisionalNudge(); }).r;
  console.log("   next turn — confirm note: " + (a ? a.slice(0, 220) : "(none)") + "\n               collision note: " + (b ? "(fires again)" : "(none)") + "\n               hints left: " + JSON.stringify(worldState.pendingMergeHints || []));
}
hdr("1. the two blessed answers (control)");
answer("1a SAME, exact tag", "[NPC_MERGE:Wilhelmina Underbough|" + K + "]");
answer("1b DIFFERENT, keep the name", "[MERGE:npc|Queen Underbough|" + K + "]");

hdr("2. SAME, but the canonical operand is a short or variant form of the established name");
answer("2a given name only", "[NPC_MERGE:Wilhelmina|" + K + "]");
console.log("   resolve('Wilhelmina') now = " + resolveNpcName("Wilhelmina") + " ; resolve('Queen Underbough') = " + resolveNpcName("Queen Underbough"));
answer("2b case variant", "[NPC_MERGE:wilhelmina underbough|Queen Underbough]");
answer("2c her registered alias", "[NPC_MERGE:Princess Wilhelmina|Queen Underbough]", function () { memory.npcs["Wilhelmina Underbough"].aliases = ["Princess Wilhelmina"]; });
console.log("   resolve('Princess Wilhelmina') now = " + resolveNpcName("Princess Wilhelmina"));
answer("2d generic form for SAME", "[MERGE:npc|Wilhelmina Underbough|Queen Underbough]");

hdr("3. the answer as an ALIAS tag (the other natural way to say 'the same')");
answer("3a NPC_ALIAS", "[NPC_ALIAS:Wilhelmina Underbough|Queen Underbough]");
console.log("   resolve('Queen Underbough') = " + resolveNpcName("Queen Underbough") + " ; provisionalOperand = " + npcProvisionalOperand("Queen Underbough"));
nextNotes();
var r = run("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]");
console.log("   then SAME by the called name -> rows: " + rows() + "\n      mem: " + mems() + "\n      muts: " + JSON.stringify(r.muts) + " hints: " + JSON.stringify(worldState.pendingMergeHints || []));
r = run("[NPC:Queen Underbough|calm|ally]");
console.log("   then a later [NPC:Queen Underbough|calm|ally] -> rows: " + rows());

hdr("4. a provisional into a THIRD established person");
answer("4a by the ° key", "[MERGE:npc|Isolde Marsh|" + K + "]", function () { person("Isolde Marsh", "she/her"); });
nextNotes();
answer("4b by the name she was called", "[MERGE:npc|Isolde Marsh|Queen Underbough]", function () { person("Isolde Marsh", "she/her"); });
nextNotes();
answer("4c into a third person's ALIAS, by the ° key", "[MERGE:npc|The Ferryman|" + K + "]", function () { person("Odo Marsh", "he/him"); memory.npcs["Odo Marsh"].aliases = ["The Ferryman"]; });
nextNotes();
answer("4d into a name that token-resolves to a third person", "[MERGE:npc|Isolde|" + K + "]", function () { person("Isolde Marsh", "she/her"); });
nextNotes();

hdr("5. the player's name, and an alias of the player");
answer("5a player name", "[MERGE:npc|Tess|" + K + "]");
answer("5b player name, other case", "[MERGE:npc|tess|" + K + "]");
answer("5c player epithet", "[MERGE:npc|The Ashen Blade|" + K + "]", function () { worldState.character.aliases = ["The Ashen Blade"]; });
answer("5d a name that CONTAINS the player's", "[MERGE:npc|Queen Tess|" + K + "]");

hdr("6. the generic tag with a domain the gate's regex does not match");
answer("6a [MERGE:NPC|…] two ESTABLISHED people", "[MERGE:NPC|Isolde Marsh|Wilhelmina Underbough]", function () { person("Isolde Marsh", "she/her"); });
answer("6b [MERGE: npc|…] two ESTABLISHED people", "[MERGE: npc|Isolde Marsh|Wilhelmina Underbough]", function () { person("Isolde Marsh", "she/her"); });
answer("6c control [MERGE:npc|…] two ESTABLISHED people", "[MERGE:npc|Isolde Marsh|Wilhelmina Underbough]", function () { person("Isolde Marsh", "she/her"); });
