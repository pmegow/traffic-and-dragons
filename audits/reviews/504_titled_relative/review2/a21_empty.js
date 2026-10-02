require("./b.js");
["[NPC_MERGE: |" + K + "]", "[MERGE:npc| |" + K + "]", "[NPC_MERGE:?|" + K + "]", "[NPC_MERGE:...|" + K + "]", "[NPC_MERGE:the|" + K + "]", "[NPC_MERGE:Queen|" + K + "]", "[NPC_MERGE:Her|" + K + "]", "[NPC_MERGE:her mother|" + K + "]", "[NPC_MERGE:<Their Proper Name>|" + K + "]", "[MERGE:npc|Their Proper Name|" + K + "]", "[NPC_MERGE:unknown|" + K + "]", "[NPC_MERGE:Wilhelmina Underbough °t85|" + K + "]"].forEach(function (t) {
  q(); var r = run(t); console.log("  " + t + "  muts=" + JSON.stringify(r.muts) + " | records: " + JSON.stringify(Object.keys(memory.npcs)) + " rows: " + JSON.stringify(worldState.npcs.map(function (n) { return n.name; })));
});
