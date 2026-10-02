require("./h2.js");
// The REAL load path: fileDenouement -> saveCore/saveMem -> loadState() x N (each loadState parses the stored blob, runs
// migrateWorldState, and persists with saveCore when the migration reports a change).
function flow(hero, record, loads) {
  makeWorld(); var c = worldState.character; c.name = hero; c.coreMemories = []; worldState.campName = "The Long Walk"; worldState.turn = 89; worldState.campId = "camp_probe";
  worldState.npcs.push({ name: "Daeris", status: "steady", rel: "wife", partyMember: true, charSheet: { name: "Daeris", cls: "Cleric", level: 18, coreMemories: [] } });
  memory.chapters = []; worldState.transcript = []; worldState.spineComplete = { turn: 88 };
  worldState.ended = { turn: 89, cause: "the tale is told", at: 1, spine: true };
  quiet(function () { fileDenouement("You walk out of the palace.\n\nYou learned to stay.\nRECORD: " + record); });
  quiet(function () { saveCore(); saveMem(); });
  console.log("\n=== hero " + J(hero) + "  RECORD: " + record);
  console.log("filed            : " + J(endings(worldState.character)[0]));
  var i;
  for (i = 1; i <= loads; i++) {
    var q = quiet(function () { return loadState(); });
    var stored = JSON.parse(__ls[WSK]);
    var storedEnding = ((stored.character && stored.character.coreMemories) || []).filter(function (m) { return m.kind === "ending"; }).map(function (m) { return m.text; })[0];
    console.log("loadState #" + i + " -> " + q.r + " | live: " + J(endings(worldState.character)[0]) + "\n               stored on disk: " + J(storedEnding) + " | core blob " + __ls[WSK].length + " bytes");
  }
}
flow("Ammut", "Ammut learned to stay when leaving was easier.", 3);
flow("José", "José learned to stay when leaving was easier.", 4);
