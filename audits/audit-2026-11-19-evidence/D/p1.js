var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1500));}
// 1. FUTURE_EVENT missing when swallows next tag
H.fresh();r=H.run("The cult will return. [FUTURE_EVENT:The cult returns] Bram nods. [NPC:Bram|calm|ally]");
show("FE greedy",{muts:r.muts,fe:memory.futureEvents,sched:worldState.clock.schedule,bram:worldState.npcs.filter(function(n){return n.name==="Bram";})});
// 2. LOCATION_SIZE missing travelMins
H.fresh();r=H.run("[LOCATION_SIZE:large] The hall is vast. [NPC:Bram|calm|ally]");
var k=currentNodeKey();show("LSIZE greedy",{muts:r.muts,key:k,node:memory.map.nodes[k]&&{size:memory.map.nodes[k].size,travelMins:memory.map.nodes[k].travelMins}});
// 3. COMBAT_START 5 fields
H.fresh();r=H.run("[COMBAT_START:Goblin|7|15|+4|1d6] It snarls. [NPC:Bram|wary|ally]");
show("CS greedy",{muts:r.muts,combat:worldState.combat,warns:r.warns.filter(function(w){return /COMBAT_START/.test(w);})});
// 4. SAVE_MOD 2 fields + later GOLD
H.fresh();r=H.run("[SAVE_MOD:Ring of warmth|Cold] You pay. [GOLD:-5]");
show("SAVEMOD greedy",{muts:r.muts,sm:worldState.character.saveModifiers,coin:worldState.character.coin});
// 5. NPC_LINK 2 fields
H.fresh();r=H.run("[NPC:Zarith|calm|ally][NPC_LINK:Zarith|Guard Captain] later [NPC:Bob|calm|ally]");
show("NPCLINK greedy",{muts:r.muts,edges:memory.npcGraph&&memory.npcGraph.edges});
