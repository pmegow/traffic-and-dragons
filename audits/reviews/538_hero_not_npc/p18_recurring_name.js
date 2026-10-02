// An engine path that ASKS the GM to file the hero as an NPC: the recurring-name scan (memory.js recurringNameScan / _recurringKnownName)
// knows the hero's sheet name, not the hero's earned epithets. The GM narrates with the epithet; three turns later the engine asks for [NPC:<epithet>|…].
require("./common.js");
P("version", ver());
var h = world(); worldState.character.aliases = ["Stormborn"]; worldState.turn = 12;
worldState.transcript = [
  { t: 9, r: "gm", x: "The dockhands fall quiet when they see Stormborn at the rail. You nod once." },
  { t: 10, r: "gm", x: "A boy whispers that Stormborn herself has come. You keep walking." },
  { t: 11, r: "gm", x: "By dusk the whole quarter knows Stormborn is in Ashfen. You find the inn." },
  { t: 12, r: "gm", x: "The innkeeper pours for Stormborn without being asked. You drink." }];
quiet(function () { recurringNameScan(); });
P("recurringNamePing", worldState.recurringNamePing || null);
var note = quiet(function () { return buildRecurringNameNudge(); }).r; P("engine note", String(note).slice(0, 330));
var r = run("She is known here. [NPC:Stormborn|watchful|ally] [NPC_PRONOUN:Stormborn|she/her]"); P("the GM complies ->", r.muts);
P("hero-named records / rows", [Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }), worldState.npcs.filter(function (n) { return memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name; })]);
