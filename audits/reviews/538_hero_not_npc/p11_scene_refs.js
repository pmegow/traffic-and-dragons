// Scene handles with a REAL binding (the author's census revealed a handle that was never declared): bind, reveal as the hero, kill.
require("./common.js");
P("version", ver());
function st() { return { memKeys: Object.keys(memory.npcs), heroNamed: Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }), rows: worldState.npcs.map(function (n) { return n.name + (n.dead ? "[dead]" : ""); }), actors: ((worldState.sceneRefs && worldState.sceneRefs.active && worldState.sceneRefs.active.actors) || []).map(function (a) { return a.handle + "=" + a.entity + (a.revealed ? "(revealed)" : ""); }), conflicts: (worldState.identityConflicts || []).length }; }
function go(rep) { worldState.turn++; var r = run(rep); P("   " + rep, ""); P("      muts", r.muts); if (r.r && r.r.errors && r.r.errors.length) P("      errors", r.r.errors); }
function base(spell) {
  var h = world(); if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes[worldState.world.location] = { firstVisit: 1, visits: 3, description: null, parent: null, npcs: [], items: [], size: "small", travelMins: null };
  quiet(function () { sceneRefsEnsure(); });
  return h;
}
P("\n-- a hooded figure is observed, then revealed as the hero's exact name, then killed", "");
var h = base();
go("A hooded figure waits. [SCENE_REF:hood|?] [NPC:the hooded figure|watchful|unknown]");
go("The hood falls: it is you. [SCENE_REVEAL:hood|" + h + "]");
go("[CANON_TXN_BEGIN:hood_dies|npc-death|" + h + "|hood|-][SCENE_DEATH:hood][CANON_TXN_END:hood_dies]");
go("[SCENE_DEATH:hood]");
P("   state", st());
P("\n-- same, the handle is bound straight to the hero's name, 'player', and an epithet", "");
h = base(); worldState.character.aliases = ["the Butcher"];
go("[SCENE_REF:a|" + h + "] [SCENE_REF:b|player] [SCENE_REF:c|the Butcher] [SCENE_NOT:d|" + h + "|explicit]");
go("[SCENE_DEATH:a] [SCENE_DEATH:b] [SCENE_DEATH:c]");
go("[MERGE:npc|" + h + "|the hooded figure] [ALIAS:npc|Bram|" + h + "] [NPC_MERGE:Bram|" + h + "]");
P("   state", st());
