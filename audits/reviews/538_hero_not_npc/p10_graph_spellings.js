// "Deliberately open": NPC_LINK and NPC_FACTION may name the hero. Which spellings land on the hero's own graph node?
require("./common.js");
P("version", ver());
function one(label, tags) {
  var h = world(); worldState.character.aliases = ["the Butcher"];
  var r = run("It happens. " + tags.split("HERO").join(h));
  P("-- " + label + " :: " + tags.split("HERO").join(h), ""); P("   muts", r.muts);
  P("   edges", ((memory.npcGraph || {}).edges || []).map(function (e) { return e.a + " ~ " + e.b + " (" + e.rel + ")"; })); P("   faction members", Object.keys((memory.npcGraph || {}).npcFactions || {}));
  var g = quiet(function () { return buildNpcGraph(); }).r; P("   NPC GRAPH block", String(g).split("\n").slice(0, 6).join(" // "));
}
one("the literal", "[NPC_LINK:Bram|player|old debt] [NPC_FACTION:player|The Guild|member]");
one("the sheet name", "[NPC_LINK:Bram|HERO|old debt] [NPC_FACTION:HERO|The Guild|member]");
one("the sheet name in capitals", "[NPC_LINK:Bram|TESS|old debt] [NPC_FACTION:TESS|The Guild|member]");
one("an earned epithet", "[NPC_LINK:Bram|the Butcher|old debt] [NPC_FACTION:the Butcher|The Guild|member]");
