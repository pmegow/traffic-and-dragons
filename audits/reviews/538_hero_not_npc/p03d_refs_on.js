// H2 with scene refs ACTIVE (the owner's live campaigns carry worldState.sceneRefs): which of the misdirected writes does the W2 death gate stop?
require("./common.js");
P("version", ver());
function kin(k) { var n = wsNpcByName(k), m = memory.npcs[k]; return n ? { status: n.status, rel: n.rel, dead: n.dead || (m && m.dead) || null, reported: !!n.deathReported, events: m ? (m.events || []).map(function (e) { return e.note; }) : null } : null; }
function flow(second) {
  var h = world({ hero: "Silas" }); worldState.character.gender = "M";
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes[worldState.world.location] = { firstVisit: 1, visits: 3, description: null, parent: null, npcs: [], items: [], size: "small", travelMins: null };
  quiet(function () { sceneRefsEnsure(); });
  worldState.turn++; run("She waits at the gate. [SCENE_CAST:Silas's mother] [NPC:Silas's mother|worried|family] [NPC_PRONOUN:Silas's mother|she/her] [SAY:Silas's mother] \"Come home.\"");
  P("-- scene refs on: " + !!worldState.sceneRefs + " | resolveNpcName('Silas') -> " + resolveNpcName("Silas"), "");
  worldState.turn++; var r = run(second); P("   " + second, ""); P("      muts", r.muts); if (r.r && r.r.errors && r.r.errors.length) P("      errors", r.r.errors);
  P("   'Silas's mother' now", kin("Silas's mother")); P("   conflicts", (worldState.identityConflicts || []).map(function (c) { return (c.subject || c.entity || "") + ": " + (c.reason || c.why || ""); }));
}
flow("You fall. [NPC:Silas|dead|ally]");
flow("Word comes back. [NPC_DEATH_REPORTED:Silas|a rider from the pass]");
flow("You rage. [NPC:Silas|furious|enemy]");
