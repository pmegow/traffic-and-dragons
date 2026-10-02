// H3: the player-character swap (swapPlayerCharacter, game.js — the pure half of _switchPlayerCharacter).
// The promoted companion's memory record stays on file under the NEW hero's name. What do the person tags do afterwards?
require("./common.js");
P("version", ver());
function setup(kind) {
  makeWorld(); if (kind) worldState.kind = kind; else delete worldState.kind; worldState.turn = 9;
  worldState.character.aliases = ["the Stormborn"];                                   // the old hero's earned epithet
  var sheet = { name: "Bram Stoneheart", gender: "M", hp: 9, maxHp: 9, inventory: [], conditions: [], relationships: [], aliases: ["the Bear"], cls: "Warrior", level: 1, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, abilities: [], spells: [], skills: initSkills() };
  worldState.npcs = [{ name: "Bram Stoneheart", status: "ally", rel: "companion", met: 1, partyMember: true, pronouns: "he/him", portrait: null, aliases: ["the Bear", "Stoneheart the smith"], charSheet: sheet },
    { name: "Mara", status: "present", rel: "ally", met: 2, partyMember: false, pronouns: "she/her", portrait: null, aliases: [] }];
  memory.npcs = { "Bram Stoneheart": { attitude: "ally", knowledge: ["forged the gate"], events: [{ turn: 1, note: "met at the forge" }], aliases: ["the Bear", "Stoneheart the smith"], pronouns: "he/him", partyMember: true },
    "Mara": { attitude: "", knowledge: [], events: [], aliases: [], pronouns: "she/her" } };
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
}
function swap(to) { var q = quiet(function () { return swapPlayerCharacter(to); }); return q.r; }
function snap() { return { hero: worldState.character.name, epithets: (worldState.character.aliases || []).slice(), memKeys: Object.keys(memory.npcs), memKeysPlayer: Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }), rows: worldState.npcs.map(function (n) { return n.name + (n.partyMember ? "[party]" : "") + (n.charSheet ? "[sheet]" : ""); }) }; }
function go(label, tags) { var r = run("It happens. " + tags); P("  " + label + " :: " + tags, ""); P("     muts", r.muts); return r; }
["", "village"].forEach(function (kind) {
  P("\n######## kind=" + (kind || "adventure"), "");
  setup(kind); var r = swap("Bram Stoneheart"); P("swap result", r); P("after swap", snap());
  // (a) the FORMER hero written as an NPC
  go("a1 former hero, standing tag", "[NPC:Tess|steady|companion]"); go("a2 former hero, note+pronoun", "[NPC_NOTE:Tess|kept the watch] [NPC_PRONOUN:Tess|she/her]");
  go("a3 former hero, alias", "[NPC_ALIAS:Tess|the Stormborn]"); go("a4 former hero leaves/joins", "[PARTY_MEMBER:Tess|false]");
  P("  => Tess record", { mem: memory.npcs["Tess"] || null, row: (function (n) { return n ? { status: n.status, pronouns: n.pronouns, partyMember: n.partyMember, aliases: n.aliases } : null; })(wsNpcByName("Tess")) });
  // (b) the NEW hero by exact name: must be refused
  go("b1 new hero exact", "[NPC_NOTE:Bram Stoneheart|a fact] [NPC_PRONOUN:Bram Stoneheart|he/him] [PARTY_MEMBER:Bram Stoneheart|true]");
  // (c) a RELATIVE of the new hero by surname only (a different person): the contract says "exact names only"
  go("c1 relative, standing tag", "[NPC:Old Stoneheart|gruff|ally]"); go("c2 relative, note", "[NPC_NOTE:Old Stoneheart|raised Bram at the forge]"); go("c3 relative, pronoun", "[NPC_PRONOUN:Lord Stoneheart|he/him]");
  go("c4 alias on a third person", "[NPC_ALIAS:Mara|Stoneheart]"); go("c5 possessive kin", "[NPC:Bram Stoneheart's brother|sullen|neutral] [NPC_NOTE:Bram Stoneheart's brother|owes a debt]");
  // (d) the new hero is awarded an epithet that is an alias on his OWN stale record
  go("d1 own old alias as epithet", "[NPC_ALIAS:Bram Stoneheart|Stoneheart the smith]"); go("d2 fresh epithet", "[NPC_ALIAS:Bram Stoneheart|the Gatewright]");
  // (e) the new hero is awarded the old hero's sheet epithet
  go("e1 old hero's epithet", "[NPC_ALIAS:Bram Stoneheart|the Stormborn]");
  P("final", snap()); P("stale record", memory.npcs["Bram Stoneheart"] || null);
  P("rows named like the hero", worldState.npcs.filter(function (n) { return memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name; }));
  // (f) swap back
  var r2 = swap("Tess"); P("swap back", r2); P("after swap back", snap());
  go("f1 Bram is an NPC again", "[NPC_NOTE:Bram Stoneheart|took the rear] [NPC:Bram Stoneheart|calm|companion]");
  go("f2 Tess is the hero again", "[NPC_NOTE:Tess|a fact]");
  P("final2", snap());
});
