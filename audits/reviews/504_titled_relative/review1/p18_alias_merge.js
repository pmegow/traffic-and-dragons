// p18 — the alias tag and the merge tag for the SAME answer in one reply; and every later way out. Scene refs active.
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Queen Underbough", 85);
function open() { fresh(); person("Wilhelmina Underbough", "she/her"); run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86; }
hdr("[NPC_ALIAS:Wilhelmina Underbough|Queen Underbough] [NPC_MERGE:Wilhelmina Underbough|Queen Underbough] in one reply");
open(); var r = run("It is her. [NPC_ALIAS:Wilhelmina Underbough|Queen Underbough] [NPC_MERGE:Wilhelmina Underbough|Queen Underbough]");
line("rows", rows()); line("mem", mems()); line("muts", JSON.stringify(r.muts)); line("hints", JSON.stringify(worldState.pendingMergeHints || []));
var i, fired = 0; for (i = 0; i < 12; i++) { worldState.turn++; if (quiet(function () { return buildProvisionalNudge(); }).r) fired++; }
line("collision note in the next 12 turns", fired + " time(s)");
r = run("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]"); line("SAME again by the called name -> mem", mems()); line("muts", JSON.stringify(r.muts)); line("hints", JSON.stringify(worldState.pendingMergeHints || []));
worldState.turn++; line("confirm note", String(quiet(function () { return buildMergeConfirmNudge(); }).r || "(none)").slice(0, 120));
r = run("[NPC_MERGE:Wilhelmina Underbough|" + K + "]"); line("SAME by the ° key -> mem", mems()); line("muts", JSON.stringify(r.muts));
