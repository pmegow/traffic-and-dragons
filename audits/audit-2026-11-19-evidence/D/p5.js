var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1400));}
// GOLD huge
H.fresh();r=H.run("[GOLD:+"+"9".repeat(400)+" gp]");show("GOLD huge",{muts:r.muts,coin:worldState.character.coin,json:JSON.parse(JSON.stringify(worldState.character)).coin});
H.fresh();r=H.run("[GOLD:+1e9 gp]");show("GOLD 1e9",{muts:r.muts,coin:worldState.character.coin});
H.fresh();r=H.run("[GOLD:a few coppers]");show("GOLD words",{muts:r.muts,warns:r.warns,coin:worldState.character.coin,clean:r.clean});
// HP huge / decimal
H.fresh();r=H.run("[HP:-"+"9".repeat(400)+"]");show("HP huge neg",{muts:r.muts,hp:worldState.character.hp,downed:worldState.downed});
// NPC 4 fields silent
H.fresh();r=H.run("[NPC:Bram|the smith|calm|ally]");show("NPC 4 fields",{muts:r.muts,warns:r.warns,npcs:worldState.npcs.map(function(n){return n.name;}),clean:r.clean});
// XP negative silent
H.fresh();r=H.run("[XP:-50]");show("XP neg",{muts:r.muts,warns:r.warns,xp:worldState.character.xp});
// nested bracket LORE
H.fresh();r=H.run("Lore. [LORE:The [old] king sleeps] End.");show("LORE nested",{muts:r.muts,lore:memory.lore,clean:r.clean});
// __proto__ names
var names=["__proto__","constructor","toString","hasOwnProperty"];
names.forEach(function(nm){H.fresh();var rr;try{rr=H.run("[NPC:"+nm+"|calm|ally][NPC_NOTE:"+nm+"|met at the gate][QUEST:"+nm+"|active][QUEST_STEP:"+nm+"|find it|false][LOCATION:"+nm+"][SUBLOCATION:"+nm+"][FACTION:"+nm+"|a guild][NPC_FACTION:"+nm+"|"+nm+"|boss][SCHEDULE:"+nm+"|2h][ARC_COMPLETE:"+nm+"]");}catch(e){log(nm,"THREW",e.message);return;}
  show("proto "+nm,{muts:rr.muts,errors:rr.errors,objProto:Object.prototype.calm!==undefined||Object.keys(Object.prototype).length,memNpc:Object.prototype.hasOwnProperty.call(memory.npcs,nm),node:!!(memory.map.nodes&&Object.prototype.hasOwnProperty.call(memory.map.nodes,nm))});});
log("Object.prototype keys:",JSON.stringify(Object.getOwnPropertyNames(Object.prototype)));
