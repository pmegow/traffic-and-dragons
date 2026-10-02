require("./h.js");
// A NEW campaign started from sheets that still carry the pre-#525 ending (as every copy in the character library and every
// .char export made before v1.1104 does): is the old first-person ending healed when the sheets ENTER the campaign?
var fs = require("fs");
var save = JSON.parse(fs.readFileSync("C:/Projects/traffic-and-dragons/Campaigns/The_Princess_Is_Not_In_Danger__Ammut_/saves/The_Princess_Is_Not_In_Danger__Ammut__Ammut_t89.tnd", "utf8"));
var src = inflateWorldStateSnapshot(save.worldState);
var hero = JSON.parse(JSON.stringify(src.character));
var comp = JSON.parse(JSON.stringify(src.npcs.filter(function (n) { return n.name === "Daeris"; })[0].charSheet));
var PRISTINE = JSON.stringify(comp);
console.log("library copies: hero ending " + J(endings(hero)[0]).slice(0, 90) + "…  | Daeris ending " + J(endings(comp)[0]).slice(0, 60) + "…");
// the real new-campaign entry: startGame(hero, tone, voice, author) with companions picked in the wizard
(0, eval)("showGame=function(){};showChar=function(){};updateMemStatus=function(){};"); pendingCompanions = [comp]; pendingBlueprint = null;
quiet(function () { try { startGame(hero, "Sword and Sorcery", "", ""); } catch (e) { if (!/document is not defined/.test(String(e && e.message))) throw e; /* the DOM tail of startGame (send button) — the world is built before it */ } }); busy = false;
worldState.campName = "A New Road"; worldState.turn = 3;
function momentsLine() { return (buildCoreMemoryBlock().split("\n").filter(function (l) { return /nineteen levels/.test(l); })[0] || "(none)").slice(0, 170); }
console.log("\nsession 1 of the new campaign (no reload yet):");
console.log("  hero ending  : " + J(endings(worldState.character)[0]).slice(0, 80));
console.log("  Daeris ending: " + J(endings(wsNpcByName("Daeris").charSheet)[0]).slice(0, 80));
console.log("  DEFINING MOMENTS line the GM reads: " + momentsLine());
var r = quiet(function () { return migrateWorldState(); });
console.log("\nafter the next load (migrateWorldState):");
console.log("  DEFINING MOMENTS line the GM reads: " + momentsLine());
// same boundary for a Village move-in and a library refresh
villageEF(); worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== "Daeris"; });
importVillageResidents([{ character: JSON.parse(PRISTINE), updatedAt: 5 }]);
console.log("\nVillage move-in (importVillageResidents): Daeris ending " + J(endings(wsNpcByName("Daeris").charSheet)[0]).slice(0, 60));
quiet(function () { migrateWorldState(); });
var healed = endings(wsNpcByName("Daeris").charSheet)[0];
adoptLibraryCompanion(wsNpcByName("Daeris"), JSON.parse(PRISTINE), 9);
console.log("healed at load: " + J(healed).slice(0, 60) + "  -> after a later library refresh (adoptLibraryCompanion): " + J(endings(wsNpcByName("Daeris").charSheet)[0]).slice(0, 60));
