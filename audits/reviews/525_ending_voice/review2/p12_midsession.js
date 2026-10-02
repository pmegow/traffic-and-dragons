// Probe 12: a sheet that arrives mid-session with an ending filed before the heal — who reads it, and how.
require("./h.js");
var OLD = "I spent nineteen levels pulling the pin on every grenade in the realm just to prove I belonged in the room.";
function lib(name) { return { name: name, gender: "F", cls: "Cleric", level: 5, inventory: ["Silver locket"], coreMemories: [{ text: OLD, turn: 89, kind: "ending", who: "Ammut", camp: "The Princess Is Not In Danger (Ammut)" }], storyBeats: [], relationships: [] }; }

// ---- A. a Village move-in (a resident) this session
villageEF(); worldState.ragMemory = true; worldState.turn = 30;
var r = quiet(function () { return importVillageResidents([lib("Morwen Zethran")]); }).r;
var n = wsNpcByName("Morwen Zethran");
console.log("A. move-in: " + JSON.stringify(r) + " partyMember=" + n.partyMember + " resident=" + n.resident);
console.log("   stored text unchanged: " + (n.charSheet.coreMemories[0].text === OLD));
console.log("   DEFINING MOMENTS block (buildCoreMemoryBlock): " + JSON.stringify(buildCoreMemoryBlock()));
var act = "How did you and Morwen Zethran first meet? Tell me about your last adventure, Morwen Zethran.";
lastAction = act;
console.log("   carriedHeldNow: " + carriedHeldNow(act));
console.log("   CARRIED HISTORY (ragCarriedRetrieve): " + JSON.stringify(ragCarriedRetrieve(act)));
// in the Hall (everything is served)
worldState.world.sublocation = "the Village Hall";
var q = quiet(function () { return buildSysPrompt(); });
var vol = q.r.volatile, idx = vol.indexOf("I spent nineteen levels");
console.log("   in the prompt (volatile) around the ending: " + JSON.stringify(idx >= 0 ? vol.slice(Math.max(0, idx - 160), idx + 80) : "(not present)"));
var idx2 = q.r.stable.indexOf("I spent nineteen levels"); console.log("   in the stable half: " + (idx2 >= 0));
// after a load (the heal):
quiet(function () { migrateWorldState(); });
console.log("   after the next load, stored: " + JSON.stringify(wsNpcByName("Morwen Zethran").charSheet.coreMemories[0].text.slice(0, 60)));

// ---- B. a library companion (party) adopted this session, adventure kind
makeWorld(); worldState.character.name = "Ammut"; worldState.campName = "A New Tale"; worldState.turn = 12;
var cs = addComp("Daeris", [], { coreMemories: [{ text: OLD, turn: 89, kind: "ending", who: "Ammut", camp: "The Princess Is Not In Danger (Ammut)" }] });
console.log("B. party companion: block = " + JSON.stringify(buildCoreMemoryBlock().slice(-260)));
// other readers of the same record this session:
console.log("   denouement prompt DEFINING MOMENTS (hero's own sheet, unhealed copy on the hero):");
worldState.character.coreMemories = [{ text: OLD, turn: 89, kind: "ending", who: "Ammut", camp: "The Princess Is Not In Danger (Ammut)" }];
worldState.ended = { turn: 12, cause: "the tale is told" };
var dp = buildDenouementPrompt(); var di = dp.indexOf("DEFINING MOMENTS"); console.log("   " + JSON.stringify(dp.slice(di, di + 130)));
