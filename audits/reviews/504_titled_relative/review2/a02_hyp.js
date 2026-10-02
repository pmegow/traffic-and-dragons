require("./b.js");
function keys() { return Object.keys(memory.npcs).join(", "); }

hdr("H0 does [NPC:] create a memory record for a brand-new person?");
fresh(); go("[NPC:Hilda Thorn|calm|ally]"); dump();

hdr("H1 hero swap -> same-person answer written with a SHORT FORM of the hero's name (refs on)");
q(); worldState.character.name = "Wilhelmina Underbough";
// the swap removes the new hero's roster row and keeps her memory record (swapPlayerCharacter)
worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== "Wilhelmina Underbough"; });
dump("before");
if (typeof npcMergeTarget === "function") show("target(Wilhelmina Underbough)", npcMergeTarget("Wilhelmina Underbough", K));
if (typeof npcMergeTarget === "function") show("target(Wilhelmina)", npcMergeTarget("Wilhelmina", K));
if (typeof npcMergeTarget === "function") show("target(Underbough)", npcMergeTarget("Underbough", K));
go("[NPC_MERGE:Wilhelmina|" + K + "]"); dump("after ");
show("hero roster row?", !!wsNpcByName("Wilhelmina Underbough"));

hdr("H1b same, refs off");
q({ refs: false }); worldState.character.name = "Wilhelmina Underbough";
worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== "Wilhelmina Underbough"; });
go("[NPC_MERGE:Underbough|" + K + "]"); dump("after ");
show("hero roster row?", !!wsNpcByName("Wilhelmina Underbough"));

hdr("H1c the #156 note after the established person became the hero");
fresh(); person("Savah", "she/her"); worldState.turn = 140;
go("[NPC:Savah|counting vials|unknown, not yet met]"); dump();
worldState.character.name = "Savah"; worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== "Savah"; });
worldState.turn = 141 + PROVISIONAL_NUDGE_COOLDOWN;
var note = quiet(function () { return buildProvisionalNudge(); }).r; show("note", note);
go("[NPC_MERGE:Savah|Savah °t140]"); dump("after the note's own tag");

hdr("H3 the same-person answer repeated in one reply, by the CALLED name");
q(); go("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough] [NPC_MERGE:Wilhelmina Underbough|Queen Underbough]"); dump();
hdr("H3b the different-person answer repeated, by the called name, proper name");
q(); go("[MERGE:npc|Hilda Underbough|Queen Underbough] [MERGE:npc|Hilda Underbough|Queen Underbough]"); dump();
hdr("H3c refs off");
q({ refs: false }); go("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough] [NPC_MERGE:Wilhelmina Underbough|Queen Underbough]"); dump();
