// H1: the canonical side of [NPC_ALIAS:] is checked for "player" and the sheet name only — not for an earned epithet.
require("./common.js");
P("version", ver());
function one(label, tags, follow) {
  var h = world(); worldState.character.aliases = ["the Butcher"];
  var r = run("It happens. " + tags.split("HERO").join(h));
  P("-- " + label + " :: " + tags, "");
  P("   muts", r.muts);
  P("   state", heroState());
  P("   memory keys", Object.keys(memory.npcs));
  if (memory.npcs["the Butcher"]) P("   record 'the Butcher'", memory.npcs["the Butcher"]);
  P("   resolve('Bram')", resolveNpcName("Bram")); P("   resolve('Red Hand')", resolveNpcName("Red Hand"));
  if (follow) { var r2 = run("Next. " + follow); P("   follow " + follow + " ->", r2.muts); P("   state after follow", heroState()); P("   Red Hand row", wsNpcByName("Red Hand") || null); }
}
one("epithet as canonical, new alias", "[NPC_ALIAS:the Butcher|Red Hand]", "[NPC:Red Hand|grim|foe] [NPC_NOTE:Red Hand|leads the dock gang]");
one("epithet as canonical, alias = an NPC on file (Bram)", "[NPC_ALIAS:the Butcher|Bram]", "[NPC:Bram|angry|hostile] [NPC_NOTE:Bram|shod a horse]");
one("generic route", "[ALIAS:npc|the Butcher|Red Hand]", null);
one("case variant of epithet", "[NPC_ALIAS:THE BUTCHER|Red Hand]", null);
one("control: sheet name as canonical", "[NPC_ALIAS:HERO|Red Hand]", null);
