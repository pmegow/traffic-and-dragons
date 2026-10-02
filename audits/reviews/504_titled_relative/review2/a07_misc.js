// Smaller findings, each run on head and on the tree before the three commits (TREE=before).
require("./b.js");
var D = "°";
function state(label) { console.log("  " + (label || "") + "\n     ROWS " + rows() + "\n     MEM  " + mems()); }

hdr("C1 ALIAS (generic) in the ANSWERING reply runs after NPC_MERGE: the old key comes back as a record");
q(); go("It is her. [NPC_MERGE:Wilhelmina Underbough|" + K + "] [ALIAS:npc|" + K + "|Her Majesty]"); state();
show("  resolve(old key)", resolveNpcName(K));
go("[NPC_NOTE:" + K + "|rules from the Elderwood] [NPC:" + K + "|calm|ally]"); state("a later turn, tags by the old key:");

hdr("C2 NPC_ALIAS by the old key on a LATER turn (after 'another person')");
q(); go("[MERGE:npc|Hilda Underbough|" + K + "]"); worldState.turn++;
go("[NPC_ALIAS:" + K + "|The Dowager]"); state();
show("  resolve(old key)", resolveNpcName(K));

hdr("C3 the 'another person' answer whose NEW NAME is a " + D + " name (a case variant of the key)");
q(); go("[MERGE:npc|queen underbough " + D + "t85|" + K + "]"); state();
worldState.turn += PROVISIONAL_NUDGE_COOLDOWN + 1; show("  note afterwards", quiet(function () { return buildProvisionalNudge(); }).r || "(none: nothing asks about this record again)");

hdr("C4 a stale key as the CANONICAL of an ordinary merge (refs OFF): the established person is filed under a " + D + " name");
q({ refs: false }); person("Isolde Marsh", "she/her");
go("[MERGE:npc|Hilda Underbough|" + K + "]"); worldState.turn++;
go("[NPC_MERGE:" + K + "|Isolde Marsh]"); state();

hdr("D the answer with a mistyped key and NO scene refs: what does the player see?");
q({ refs: false }); var r = go("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough " + D + "t86]"); state();
q({ refs: false }); r = go("[MERGE:npc|Vessa Thorn|queen underbough " + D + "t85]"); state();
hdr("D2 the same with scene refs");
q(); r = go("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough " + D + "t86]"); state(); show("  queued", JSON.stringify(worldState.pendingMergeHints || []));
show("  resolveNpcName reads the same operand as", resolveNpcName("Queen Underbough " + D + "t86"));

hdr("E [NPC_ALIAS:<called name>|<the key>] makes the provisional its own alias; the fold then hands the key to the person as a permanent alias");
q(); go("[NPC_ALIAS:Queen Underbough|" + K + "]"); state();
worldState.turn++; go("[NPC_MERGE:Wilhelmina Underbough|" + K + "]"); state();

hdr("F a CONFIRMED ordinary merge written twice in one reply");
fresh(); person("Wilhelmina Underbough", "she/her"); person("Savah", "she/her"); worldState.turn = 86;
quiet(function () { applyMuts("[NPC_MERGE:Savah|Wilhelmina Underbough]"); buildMergeConfirmNudge(); }); worldState.turn++;
go("[NPC_MERGE:Savah|Wilhelmina Underbough] [NPC_MERGE:Savah|Wilhelmina Underbough]");

hdr("G the word 'constructor' in the other word tables");
console.log("  suggestionNameAlt('Malrik the Constructor') = " + (typeof suggestionNameAlt === "function" ? suggestionNameAlt("Malrik the Constructor") : "n/a") + "   ('Malrik the Builder' = " + (typeof suggestionNameAlt === "function" ? suggestionNameAlt("Malrik the Builder") : "n/a") + ")");
console.log("  ragQueryTerms('ask the constructor about the bridge') = " + JSON.stringify(ragQueryTerms("ask the constructor about the bridge")) + "   ('ask the carpenter about the bridge' = " + JSON.stringify(ragQueryTerms("ask the carpenter about the bridge")) + ")");
console.log("  ragQueryBigrams('the constructor bridge collapsed') = " + JSON.stringify(ragQueryBigrams("the constructor bridge collapsed")) + "   ('the carpenter bridge collapsed' = " + JSON.stringify(ragQueryBigrams("the carpenter bridge collapsed")) + ")");
console.log("  feTokens('meet the constructor at dawn') = " + JSON.stringify(feTokens("meet the constructor at dawn")) + "   ('meet the carpenter at dawn' = " + JSON.stringify(feTokens("meet the carpenter at dawn")) + ")");
