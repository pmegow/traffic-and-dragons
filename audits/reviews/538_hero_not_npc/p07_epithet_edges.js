// Epithet edges: what npcExactOnFile sees and does not see; epithets that arrive without the tag; repair of a collision.
require("./common.js");
P("version", ver());
function st() { return { epithets: (worldState.character.aliases || []).slice(), hidden: Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }), toc: (typeof memoryTOC === "function") ? null : null }; }
function go(rep) { var r = run(rep); P("   reply: " + rep, ""); P("     muts", r.muts); return r; }
function tocHas(name) { var t = quiet(function () { return memoryTOC(); }).r || ""; return String(t).indexOf(name) >= 0; }

P("\n-- A. title passing: 'the Champion' is a registered alias of Ser Aldric; the hero wins the title", "");
var h = world(); memory.npcs["Ser Aldric"] = { attitude: "", knowledge: ["held the lists for ten years"], events: [], aliases: ["the Champion"], pronouns: "he/him" }; worldState.npcs.push({ name: "Ser Aldric", status: "proud", rel: "rival", met: 1, partyMember: false, pronouns: "he/him", portrait: null, aliases: ["the Champion"] });
go("You unhorse him. [NPC_ALIAS:" + h + "|the Champion]"); go("He bows. [NPC:the Champion|humbled|rival] [NPC_NOTE:Ser Aldric|lost the title]");
P("   state", st()); P("   Ser Aldric status", wsNpcByName("Ser Aldric").status); P("   resolve('the Champion')", resolveNpcName("the Champion"));

P("\n-- B. the hero takes a DEAD man's name (the dead NPC is on file)", "");
h = world(); memory.npcs["Red Hand"] = { attitude: "", knowledge: [], events: [], aliases: [], dead: 4 }; worldState.npcs.push({ name: "Red Hand", status: "dead", rel: "enemy", met: 1, dead: 4, partyMember: false, portrait: null, aliases: [] });
go("They chant his name at you. [NPC_ALIAS:" + h + "|Red Hand]"); P("   state", st());

P("\n-- C. a companion's SHEET epithet (charSheet.aliases only: a library companion's epithet from another campaign)", "");
h = world(); wsNpcByName("Frizwick").charSheet.aliases = ["the Gravewalker"];
go("[NPC_ALIAS:" + h + "|the Gravewalker]"); P("   state", st()); P("   Frizwick sheet aliases", wsNpcByName("Frizwick").charSheet.aliases);
go("[NPC_ALIAS:Frizwick|the Gravewalker]"); P("   Frizwick memory aliases", memory.npcs["Frizwick"].aliases);

P("\n-- D. an epithet that arrives WITHOUT the tag: the library copy of the hero (adoptLibraryHero via libReplaceApply) carries one that is an NPC's name here", "");
h = world();
var lib = JSON.parse(JSON.stringify(worldState.character)); lib.aliases = ["Bram"]; lib.level = 2;
var ra = quiet(function () { return libReplaceApply(h, lib, 123); }); P("   libReplaceApply", ra.r); P("   state", st());
go("He scowls. [NPC:Bram|angry|hostile] [NPC_NOTE:Bram|shod a horse] [NPC_PRONOUN:Bram|he/him]");
P("   Bram status / events", [wsNpcByName("Bram").status, memory.npcs["Bram"].events.length]); P("   Bram in the memory TOC", tocHas("Bram"));
P("   repair by tag: rename Bram out of the collision", ""); go("[NPC_MERGE:Bram the smith|Bram]"); P("   memory keys", Object.keys(memory.npcs)); P("   rows", worldState.npcs.map(function (n) { return n.name; }));

P("\n-- E. a pre-existing collision (a save from before the fix: the hero already holds an NPC's name as an epithet)", "");
h = world(); worldState.character.aliases = ["Bram"];
go("[NPC_NOTE:Bram|shod a horse] [NPC_PRONOUN:Bram|he/him] [PARTY_MEMBER:Bram|true] [NPC_ALIAS:Bram|the smith]");
P("   Bram", { events: memory.npcs["Bram"].events.length, aliases: memory.npcs["Bram"].aliases, partyMember: wsNpcByName("Bram").partyMember }); P("   rows", worldState.npcs.map(function (n) { return n.name + (n.partyMember ? "[party]" : ""); }));
go("[NPC_MERGE:Bram the smith|Bram]"); P("   memory keys", Object.keys(memory.npcs)); P("   rows", worldState.npcs.map(function (n) { return n.name; }));
