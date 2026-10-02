require("./h.js");
// READ-ONLY: fate lines on the owner's saves (hero + every sheeted NPC), and the Village Hall block that quotes them.
var fs = require("fs");
["C:/Projects/traffic-and-dragons/Campaigns/The_Princess_Is_Not_In_Danger__Ammut_/saves/The_Princess_Is_Not_In_Danger__Ammut__Ammut_t89.tnd",
 "C:/Projects/traffic-and-dragons/Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t254.tnd",
 "C:/Projects/traffic-and-dragons/Campaigns/Silas_Morne/saves/Silas_Morne_Silas_Morne_t166.tnd"].forEach(function (f) {
  var save = JSON.parse(fs.readFileSync(f, "utf8"));
  worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory; sessionLog = save.sessionLog || [];
  console.log("\n##### " + f.split("/").pop() + " kind=" + (worldState.kind || "adventure") + " hero=" + worldState.character.name);
  var c = worldState.character; if (c.fate) console.log("  HERO " + c.name + " fate: " + J(c.fate).slice(0, 500));
  (worldState.npcs || []).forEach(function (n) { if (n.charSheet && n.charSheet.fate) console.log("  " + (n.partyMember ? "party " : n.resident ? "resident " : "npc ") + n.name + " fate: " + J(n.charSheet.fate).slice(0, 500)); });
  if (worldState.kind === "village") {
    var hk = villageHallKey(worldState.world.location), node = memory.map.nodes[locResolve(hk)] || memory.map.nodes[hk];
    console.log("  hall mementos on record: " + J(((node && node.mementos) || []).map(function (m) { return m.resident + ": " + m.fate; })).slice(0, 1500));
  }
});
