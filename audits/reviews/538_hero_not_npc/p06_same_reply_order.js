// Order inside ONE reply: NPC_ALIAS (table row 736) runs before NPC (810), NPC_NOTE/PRONOUN (1422/1437) and PARTY_MEMBER (1442),
// whatever the text order. The epithet check (npcExactOnFile) can only see people already on file BEFORE this reply.
require("./common.js");
P("version", ver());
function st() { return { epithets: (worldState.character.aliases || []).slice(), memKeys: Object.keys(memory.npcs), rows: worldState.npcs.map(function (n) { return n.name + (n.dead ? "[dead]" : "") + (n.partyMember ? "[party]" : ""); }), hidden: Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }), friz: wsNpcByName("Frizwick").charSheet.relationships.map(function (r) { return r.entity + ":" + r.bond; }).join(",") }; }
function one(label, replies, pre) {
  var h = world(); if (pre) pre(h);
  P("-- " + label, "");
  replies.forEach(function (rep) { rep = rep.split("HERO").join(h); var r = run(rep); P("   reply: " + rep, ""); P("     muts", r.muts); });
  P("   state", st());
}
one("a new NPC is introduced and the hero is given that NPC's name in ONE reply (NPC tag first in the text)",
  ["The chief falls. They chant his name at you. [NPC:Red Hand|dead|enemy] [NPC_ALIAS:HERO|Red Hand]", "Later. [NPC:Red Hand|dead|enemy] [NPC_NOTE:Red Hand|led the dock gang]"]);
one("same, epithet tag first in the text",
  ["[NPC_ALIAS:HERO|Red Hand] The chief falls. [NPC:Red Hand|dead|enemy] [NPC_PRONOUN:Red Hand|he/him]"]);
one("control: the NPC was introduced one reply earlier",
  ["The chief sneers. [NPC:Red Hand|sneering|enemy]", "The chief falls. They chant his name at you. [NPC:Red Hand|dead|enemy] [NPC_ALIAS:HERO|Red Hand]", "Later. [NPC_NOTE:Red Hand|led the dock gang]"]);
one("an epithet and a companion bond with a not-yet-registered person of that name, one reply",
  ["[COMPANION_RELATIONSHIP:Frizwick|Red Hand|rival|wary] [NPC_ALIAS:HERO|Red Hand]"]);
one("an alias for an NPC and the same words as the hero's epithet, one reply (alias first in the text)",
  ["[NPC_ALIAS:Bram|the Hammer] [NPC_ALIAS:HERO|the Hammer]"]);
one("same, epithet first in the text",
  ["[NPC_ALIAS:HERO|the Hammer] [NPC_ALIAS:Bram|the Hammer]"]);
one("a party join and an epithet for the same new name, one reply",
  ["[PARTY_MEMBER:Red Hand|true] [NPC_ALIAS:HERO|Red Hand]"]);
