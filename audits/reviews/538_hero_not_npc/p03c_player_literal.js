// H2 with the documented literal "player" (the STATE TAGS doc teaches [NPC_LINK:Borin|player|old debt]) and with an epithet:
// one NPC on file whose name holds the word; the older refusals look at the RESOLVED name only.
require("./common.js");
P("version", ver());
function kin(k) { var n = wsNpcByName(k), m = memory.npcs[k]; return n ? { status: n.status, dead: n.dead || (m && m.dead) || null } : null; }
function one(label, npc, epithets, tags) {
  var h = world(); worldState.character.aliases = epithets;
  run("He plays on. [NPC:" + npc + "|cheerful|neutral]");
  P("-- " + label + " | on file '" + npc + "' | epithets " + JSON.stringify(epithets), "");
  var r = run(tags); P("   " + tags, ""); P("      muts", r.muts); P("   '" + npc + "' now", kin(npc));
}
one("the literal", "Lute Player", [], "[NPC:player|dead|ally]");
one("the literal, reported death", "Lute Player", [], "[NPC_DEATH_REPORTED:player|a rider]");
one("an epithet that is one word of an NPC's name", "Garrick the Butcher", ["Butcher"], "[NPC:Butcher|dead|ally]");
one("control: nobody on file shares the word", "Old Maren", ["Butcher"], "[NPC:player|dead|ally] [NPC:Butcher|dead|ally]");
