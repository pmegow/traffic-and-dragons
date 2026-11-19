var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1400));}
["[SUBLOCATION_LEAVE:the tavern]","[COMBAT_END]","[REST]","[ENEMY_SURRENDERS:]","[TIME_ADVANCE:]","[NPC:Bram|a [b] c|ally]","[SAY:Bram]\"Hi\"","[ACTIONS:x]"].forEach(function(t){log(JSON.stringify(t)+" -> "+JSON.stringify(cleanTxt("A "+t+" B")));});
H.fresh();H.run("[LOCATION:Ashfen][SUBLOCATION:The Rusty Tankard]");r=H.run("You step out. [SUBLOCATION_LEAVE:The Rusty Tankard]");
show("leave with colon",{muts:r.muts,warns:r.warns,sub:worldState.world.sublocation});
// multi-tag order: ITEM_LOST then ITEM_GAINED same name not held
H.fresh();r=H.run("You drop the rope then pick it up. [ITEM_LOST:Rope] [ITEM_GAINED:Rope]");show("lost-then-gained not held",{muts:r.muts,inv:worldState.character.inventory});
// reroll idempotence of applyMuts if called twice on same text
H.fresh();var t="[GOLD:+5][ITEM_GAINED:Torch][XP:5][FUTURE_EVENT:The cult returns|in 3 days][SCHEDULE:Moot|2h][TIME_ADVANCE:1h]";H.run(t);H.run(t);show("double apply",{coin:worldState.character.coin,inv:worldState.character.inventory,xp:worldState.character.xp,fe:memory.futureEvents.length,sched:worldState.clock.schedule.length,min:worldState.clock.min});
