// H2: [NPC:] and [NPC_DEATH_REPORTED:] "keep their own, older refusals": they ask memoryNpcIsPlayer(resolveNpcName(raw)) only.
// When the hero's EXACT name consolidates onto ONE NPC on file (a possessive-kin key, a longer name), the hero's tag is not refused: it lands on that NPC.
require("./common.js");
P("version", ver());
function st(k) { var n = wsNpcByName(k), m = memory.npcs[k]; return { row: n ? { status: n.status, rel: n.rel, dead: n.dead || null, pronouns: n.pronouns || null, partyMember: !!n.partyMember } : null, mem: m ? { events: (m.events || []).map(function (e) { return e.note; }), dead: m.dead || null, pronouns: m.pronouns || null, knowledge: m.knowledge } : null }; }
function one(label, other, tags) {
  var h = world(); // hero Tess; Bram + Frizwick on file
  worldState.npcs.push({ name: other, status: "calm", rel: "family", met: 2, partyMember: false, pronouns: "she/her", portrait: null, aliases: [] });
  memory.npcs[other] = { attitude: "", knowledge: [], events: [{ turn: 2, note: "waved from the porch" }], aliases: [], pronouns: "she/her" };
  P("-- " + label + " | on file: '" + other + "' | resolveNpcName('" + h + "') = '" + resolveNpcName(h) + "'", "");
  var r = run("It happens. " + tags.split("HERO").join(h));
  P("   tags", tags.split("HERO").join(h)); P("   muts", r.muts); P("   '" + other + "' now", st(other)); P("   hero-named", { mem: Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }), rows: worldState.npcs.filter(function (n) { return memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name; }) });
}
one("possessive kin key", "Tess's mother", "[NPC:HERO|furious|enemy]");
one("possessive kin key, death", "Tess's mother", "[NPC:HERO|dead|enemy]");
one("possessive kin key, reported death", "Tess's mother", "[NPC_DEATH_REPORTED:HERO|a rider from the pass]");
one("longer name", "Tess Morne", "[NPC:HERO|furious|enemy]");
one("the six new handlers on the same world", "Tess's mother", "[NPC_NOTE:HERO|a fact] [NPC_PRONOUN:HERO|he/him] [NPC_SUPERSEDE:HERO|old|new] [PARTY_MEMBER:HERO|true] [NPC_FORGET:HERO|waved] [NPC_LINK:HERO|Bram|kin] [NPC_FACTION:HERO|The Guild|member]");
one("control: unrelated NPC on file", "Old Maren", "[NPC:HERO|furious|enemy] [NPC_DEATH_REPORTED:HERO|a rider]");
