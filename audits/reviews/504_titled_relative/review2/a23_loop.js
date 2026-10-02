// The DIFFERENT answer with "Savah Dunmere", played forward a few turns with a GM that keeps tagging the newcomer by her new name.
require("./b.js");
var D = "\u00b0";
fresh(); person("Savah", "she/her"); memory.npcs["Savah"].events.push({ turn: 12, note: "sold the hero a healing draught" }); worldState.turn = 140;
go("[NPC:Savah|counting vials|unknown, not yet met]");
var t;
for (t = 0; t < 3; t++) {
  var note = quiet(function () { worldState.turn += PROVISIONAL_NUDGE_COOLDOWN; var n = buildProvisionalNudge(); return n; }).r; worldState.turn++;
  var P = Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; })[0];
  console.log("  t" + worldState.turn + " note asks about: " + (P || "(nothing open)"));
  if (!P) break;
  go("A different woman. [MERGE:npc|Savah Dunmere|" + P + "] [NPC:Savah Dunmere|haggling over eels|stranger] [NPC_NOTE:Savah Dunmere|a fishwife from Riddleport #" + t + "]");
  dump();
}
