var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1400));}
H.fresh();H.run("[COMBAT_START:Goblin|7|15|+4|1d6|low]");r=H.run("[ENEMY_HP:Goblin|+50]");show("ENEMY heal",{muts:r.muts,foe:worldState.combat.foes[0]});
H.fresh();r=H.run("[COMBAT_START:Ghost|0|15|+4|1d6|low]");show("CS hp0",{muts:r.muts,combat:worldState.combat});
// SPELL_DEF negative tier then cast
H.fresh();var c=worldState.character;c.cls="Wizard";
r=H.run("[SPELL_DEF:Mana Spring|tier=-50|effect=restores|range=self]");
c.spells.push({nm:"Mana Spring",lvl:1,used:false});
log("manaMax",manaMax(c),"cur",manaCur(c),"cost",manaSpellCost(c.spells[c.spells.length-1]));
var before=manaCur(c);r=H.run("[SPELL_USED:Mana Spring]");show("neg tier cast",{def:worldState.capabilityBible["Mana Spring"]||worldState.capabilityBible[capBaseName("Mana Spring")],muts:r.muts,before:before,after:c.mana,max:manaMax(c)});
// SPELL_DEF huge tier
H.fresh();c=worldState.character;c.cls="Necromancer";r=H.run("[SPELL_DEF:Doom Bolt|tier=999999|effect=ruin|range=60 ft]");c.spells.push({nm:"Doom Bolt",lvl:1,used:false});
r=H.run("[SPELL_USED:Doom Bolt]");show("huge tier necro",{muts:r.muts,hp:c.hp,downed:worldState.downed});
