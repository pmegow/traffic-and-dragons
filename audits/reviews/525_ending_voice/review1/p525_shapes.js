require("./h2.js");
// Malformed sheet shapes through the REAL load path (loadState -> migrateWorldState inside its try/catch: a throw nulls worldState).
function tryLoad(label, mutate) {
  makeWorld(); var c = worldState.character; c.name = "Ammut"; c.coreMemories = [{ text: "I spent nineteen levels.", turn: 89, kind: "ending", who: "Ammut" }]; worldState.campId = "camp_probe"; worldState.turn = 89;
  worldState.npcs.push({ name: "Daeris", status: "steady", rel: "wife", partyMember: true, charSheet: { name: "Daeris", cls: "Cleric", level: 18, coreMemories: [] } });
  worldState.npcs.push({ name: "Guard", status: "", rel: "unknown", partyMember: false, charSheet: { name: "Guard", cls: "Warrior", level: 1 } });
  mutate(worldState);
  quiet(function () { saveCore(); saveMem(); });
  var q = quiet(function () { return loadState(); });
  console.log(label + " -> loadState()=" + q.r + " worldState " + (worldState ? "loaded, hero ending " + J(endings(worldState.character)) : "NULL (campaign failed to load)") + (q.warns.length ? "  warns: " + J(q.warns.filter(function (w) { return /E |fail|throw|TypeError/i.test(w); }).slice(0, 2)) : ""));
}
console.log("ENGINE_ROOT=" + (process.env.ENGINE_ROOT || "(head)") + " healEndingMoments=" + (typeof healEndingMoments));
tryLoad("baseline", function () {});
tryLoad("NPC sheet coreMemories is an object {}", function (ws) { ws.npcs[1].charSheet.coreMemories = {}; });
tryLoad("NPC sheet coreMemories is a string", function (ws) { ws.npcs[1].charSheet.coreMemories = "none"; });
tryLoad("non-party NPC sheet coreMemories is a number", function (ws) { ws.npcs[1].charSheet.coreMemories = 3; });
tryLoad("hero coreMemories holds a null entry", function (ws) { ws.character.coreMemories.push(null); });
tryLoad("hero ending with who as a number", function (ws) { ws.character.coreMemories.push({ text: "It ended.", kind: "ending", who: 7, turn: 1 }); });
tryLoad("hero ending with text null", function (ws) { ws.character.coreMemories.push({ text: null, kind: "ending", who: "Ammut", turn: 1 }); });
tryLoad("npcs holds a null entry", function (ws) { ws.npcs.push(null); });
tryLoad("NPC charSheet is a string", function (ws) { ws.npcs[1].charSheet = "sheet"; });
