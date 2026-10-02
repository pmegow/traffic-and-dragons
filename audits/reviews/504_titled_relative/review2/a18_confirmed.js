require("./b.js");
["[MERGE:NPC|Isolde Marsh|Wilhelmina Underbough]", "[MERGE: npc |Isolde Marsh|Wilhelmina Underbough]", "[MERGE:Npc| Isolde Marsh | Wilhelmina Underbough ]", "[merge:npc|Isolde Marsh|Wilhelmina Underbough]", "[MERGE:location|Ashfen|Ashfen Gate]", "[MERGE:npcs|Isolde Marsh|Wilhelmina Underbough]"].forEach(function (tag) {
  fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her"); worldState.turn = 86;
  var r1 = run(tag); var q1 = JSON.stringify(worldState.pendingMergeHints || []);
  var note = quiet(function () { return buildMergeConfirmNudge(); }).r; worldState.turn++;
  var r2 = run(tag);
  console.log("  " + tag + "\n     first: muts=" + JSON.stringify(r1.muts) + " queued=" + q1 + "\n     note asked: " + !!note + " | confirmed in the same spelling: muts=" + JSON.stringify(r2.muts) + " | Wilhelmina on file: " + !!memory.npcs["Wilhelmina Underbough"]);
});
