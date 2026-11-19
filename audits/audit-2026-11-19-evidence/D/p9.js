var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,900));}
H.fresh();H.run("[COMBAT_START:Goblin|7|15|+4|1d6|low]");r=H.run("The goblin flees into the dark. [COMBAT_END]");show("bare COMBAT_END",{muts:r.muts,warns:r.warns,combat:!!worldState.combat});
H.fresh();worldState.clock.min=900;r=H.run("You sleep the night through. [REST]");show("bare REST",{muts:r.muts,warns:r.warns,min:worldState.clock.min});
H.fresh();r=H.run("[REST:full]");show("REST:full",{muts:r.muts,warns:r.warns,min:worldState.clock.min});
H.fresh();r=H.run("[QUEST:Find the smith]");show("QUEST 1 field",{muts:r.muts,warns:r.warns,q:worldState.questLog.length});
H.fresh();r=H.run("[NPC:Bram]");show("NPC 1 field",{muts:r.muts,warns:r.warns,n:worldState.npcs.length});
H.fresh();r=H.run("[HP:-2d6]");show("HP dice expr",{muts:r.muts,hp:worldState.character.hp});
H.fresh();r=H.run("[ITEM_GAINED:Torch x99999]");show("qty huge",{muts:r.muts,inv:worldState.character.inventory});
