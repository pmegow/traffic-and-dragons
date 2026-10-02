// p04 — differential: run with PROBE_TREE=pre|mid|head. Which behaviours predate the two commits?
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }

hdr("1. #156 provisional (intro-shaped tag into a rich record): do shorter names of the ESTABLISHED person fork while it is open?");
fresh({ turn: 140 }); person("Belor Hemlock", "he/him");
var r = run("[NPC:Belor Hemlock|counting vials|unknown, not yet met]");
line("after the intro-shaped tag", mems());
worldState.turn = 141; r = run("[NPC:Sheriff Hemlock|grim|ally] [NPC_NOTE:Hemlock|owes the hero a favour]");
line("after [NPC:Sheriff Hemlock] + [NPC_NOTE:Hemlock]", mems());
line("rows", rows());

hdr("2. the title case: [NPC:Queen Underbough] then the princess by surname");
fresh(); person("Wilhelmina Underbough", "she/her");
r = run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86;
r = run("[NPC:Underbough|smiling|ally] [NPC_NOTE:Princess Underbough|owes the hero a favour]");
line("mem", mems()); line("rows", rows());

hdr("3. SAME answer with a short canonical, #156 provisional: [NPC_MERGE:Belor|Belor Hemlock °t140]");
fresh({ turn: 140 }); person("Belor Hemlock", "he/him");
run("[NPC:Belor Hemlock|counting vials|unknown, not yet met]"); worldState.turn = 141;
r = run("[NPC_MERGE:Belor|" + PK("Belor Hemlock", 140) + "]");
line("mem", mems()); line("rows", rows()); line("muts", JSON.stringify(r.muts)); line("resolve('Belor')", resolveNpcName("Belor"));

hdr("4. [MERGE:NPC|a|b] (upper-case domain) on two ESTABLISHED people, scene refs active");
fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her");
r = run("[MERGE:NPC|Isolde Marsh|Wilhelmina Underbough]");
line("mem", mems()); line("muts", JSON.stringify(r.muts)); line("hints", JSON.stringify(worldState.pendingMergeHints || []));

hdr("5. the DIFFERENT answer for a #156 provisional, scene refs active (the #530 repro)");
fresh({ turn: 140 }); person("Savah", "she/her");
run("[NPC:Savah|counting vials|unknown, not yet met]"); worldState.turn = 141;
r = run("[MERGE:npc|Vessa Thorn|" + PK("Savah", 140) + "]");
line("mem", mems()); line("muts", JSON.stringify(r.muts)); line("hints", JSON.stringify(worldState.pendingMergeHints || []));
