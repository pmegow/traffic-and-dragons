// Probe 26 (read-only): The Long Walk t146 — why does the hero's own sheet hold no ending moment while the companion's does?
require("./h.js");
var fs = require("fs");
var save = JSON.parse(fs.readFileSync("C:/Projects/traffic-and-dragons/Campaigns/The_Long_Walk/saves/The_Long_Walk_Silas_Morne_t146.tnd", "utf8"));
quiet(function () { worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory; });
var c = worldState.character;
console.log("hero " + c.name + " moments: " + (c.coreMemories || []).length + " | ended=" + JSON.stringify(worldState.ended) + " owed=" + worldState.denouementOwed + " turn=" + worldState.turn + " fate=" + JSON.stringify(c.fate));
(c.coreMemories || []).slice(-6).forEach(function (m) { console.log("   hero: t" + m.turn + " " + m.kind + " who=" + m.who + " camp=" + m.camp + " :: " + String(m.text).slice(0, 90)); });
worldState.npcs.forEach(function (n) { if (n.charSheet) { console.log(n.name + " party=" + n.partyMember + " moments=" + (n.charSheet.coreMemories || []).length + " fate=" + JSON.stringify(n.charSheet.fate)); (n.charSheet.coreMemories || []).slice(-3).forEach(function (m) { console.log("   " + n.name + ": t" + m.turn + " " + m.kind + " who=" + m.who + " :: " + String(m.text).slice(0, 90)); }); } });
console.log("archive coreMemories: " + JSON.stringify(((memory.archive || {}).coreMemories || []).map(function (m) { return "t" + m.turn + " " + m.kind + " " + String(m.text).slice(0, 60); })));
