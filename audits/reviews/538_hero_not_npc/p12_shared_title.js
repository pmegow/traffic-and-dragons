// A title the story gives to the hero AND a companion ("If the named character is the PLAYER or a party member, the alias is recorded as a
// TITLE/EPITHET on their character sheet" — the STATE TAGS doc). One reply, both text orders; then: is the companion still writable, are bonds intact?
require("./common.js");
P("version", ver());
function st() { var fz = wsNpcByName("Frizwick"); return { heroEpithets: (worldState.character.aliases || []).slice(), frizSheetAliases: (fz.charSheet.aliases || []).slice(), frizMemAliases: (memory.npcs["Frizwick"].aliases || []).slice(), frizBonds: fz.charSheet.relationships.map(function (r) { return r.entity + ":" + r.bond; }).join(","), frizStatus: fz.status, frizEvents: (memory.npcs["Frizwick"].events || []).length, resolves: resolveNpcName("Hero of Sandpoint") }; }
function one(label, rep) {
  var h = world(); P("-- " + label, "");
  rep = rep.split("HERO").join(h); var r = run(rep); P("   " + rep, ""); P("      muts", r.muts);
  var r2 = run("Later. [NPC:Frizwick|proud|companion] [NPC_NOTE:Frizwick|kept the gate] [NPC:Hero of Sandpoint|cheered|companion]"); P("   follow-up muts", r2.muts);
  P("   state", st());
}
one("hero first in the text", "The town cheers you both. [NPC_ALIAS:HERO|Hero of Sandpoint] [NPC_ALIAS:Frizwick|Hero of Sandpoint]");
one("companion first in the text", "The town cheers you both. [NPC_ALIAS:Frizwick|Hero of Sandpoint] [NPC_ALIAS:HERO|Hero of Sandpoint]");
one("two replies: the companion earned it earlier", "She is cheered. [NPC_ALIAS:Frizwick|Hero of Sandpoint]");
P("   then the hero earns the same title", ""); var r3 = run("Now they cheer you too. [NPC_ALIAS:" + worldState.character.name + "|Hero of Sandpoint]"); P("      muts", r3.muts); P("   state", st());
