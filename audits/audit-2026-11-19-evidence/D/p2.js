var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1400));}
H.fresh();H.run("[LOCATION:Ashfen]");
r=H.run("[LOCATION_SIZE:large] The hall is vast. [NPC:Bram|calm|ally]");
var k=currentNodeKey();show("LSIZE greedy",{muts:r.muts,warns:r.warns,key:k,size:memory.map.nodes[k]&&memory.map.nodes[k].size,tm:memory.map.nodes[k]&&memory.map.nodes[k].travelMins});
// NPC_SUPERSEDE middle group [^|]+
H.fresh();H.run("[NPC:Bram|calm|ally]");r=H.run("[NPC_SUPERSEDE:Bram|was a smith] later [QUEST:Find the smith|active]");
show("SUPERSEDE greedy",{muts:r.muts,kn:memory.npcs.Bram&&memory.npcs.Bram.knowledge,q:worldState.questLog.map(function(q){return q.title;})});
// NPC_FACTION 2 fields
H.fresh();H.run("[NPC:Zarith|calm|ally]");r=H.run("[NPC_FACTION:Zarith|The Black Hand] and [NPC:Bob|calm|ally]");
show("NPCFACTION greedy",{muts:r.muts,nf:memory.npcGraph&&memory.npcGraph.npcFactions,f:memory.npcGraph&&memory.npcGraph.factions});
// COMPANION_ABILITY 2 fields
H.fresh();
