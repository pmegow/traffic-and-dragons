var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1600));}
function withBram(){H.fresh();worldState.npcs.push({name:"Bram",status:"",rel:"ally",met:1,partyMember:true,portrait:null,aliases:[],charSheet:{name:"Bram",hp:10,maxHp:10,cls:"Warrior",level:1,xp:0,inventory:[],conditions:[],abilities:[],spells:[],skills:initSkills(),stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10}}});memory.npcs.Bram={attitude:"",knowledge:[],events:[],aliases:[]};}
// A. DOWNED_RESOLVED:dead on a hale hero
H.fresh();var hp0=worldState.character.hp;r=H.run("The bandit captain falls. [DOWNED_RESOLVED:dead|the captain bled out]");
show("DOWNED dead hale",{hp:hp0,muts:r.muts,downed:worldState.downed,deathPending:worldState.deathPending});
H.fresh();r=H.run("[DOWNED_RESOLVED:rescued|the militia arrived]");
show("DOWNED rescued hale",{muts:r.muts,core:worldState.character.coreMemories});
// B. companion condition case
withBram();r=H.run("[COMPANION_CONDITION:Bram|Poisoned|1 hour|spider bite]");var r2=H.run("[COMPANION_CONDITION:Bram|poisoned|2 hours|spider bite]");var r3=H.run("[COMPANION_CONDITION_REMOVED:Bram|POISONED]");
show("comp cond case",{m1:r.muts,m2:r2.muts,m3:r3.muts,w3:r3.warns,conds:findCompanionChar("Bram").conditions});
H.fresh();H.run("[CONDITION:Poisoned|1 hour|bite]");H.run("[CONDITION:poisoned|2 hours|bite]");var r4=H.run("[CONDITION_REMOVED:POISONED]");
show("hero cond case",{m:r4.muts,conds:worldState.character.conditions});
// C. companion XP uncapped vs hero
withBram();r=H.run("[XP:5000]");var r5=H.run("[COMPANION_XP:Bram|5000]");
show("xp caps",{hero:r.muts,comp:r5.muts,heroXp:worldState.character.xp,bramXp:findCompanionChar("Bram").xp,bramLvl:findCompanionChar("Bram").level});
// D. companion ability case dup
withBram();H.run("[COMPANION_ABILITY:Bram|Second Wind|heal]");H.run("[COMPANION_ABILITY:Bram|second wind|heal]");
show("comp ability dup",{ab:findCompanionChar("Bram").abilities.map(function(a){return a.nm;})});
H.fresh();H.run("[ABILITY_GAINED:Second Wind|heal]");H.run("[ABILITY_GAINED:second wind|heal]");
show("hero ability dup",{ab:worldState.character.abilities.map(function(a){return a.nm;})});
