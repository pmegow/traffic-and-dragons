// The guard asks about the TRIMMED operand; two writers resolve the operand AS WRITTEN (NPC_NOTE -> fileNpcEvent(nnp[1]); NPC_PRONOUN -> resolveNpcName(pnp[1])).
// State: after a hero swap (the new hero's memory record is still on file), another NPC holds an exact alias that shares the hero's surname.
require("./common.js");
P("version", ver());
function setup() {
  makeWorld(); delete worldState.kind; worldState.turn = 9;
  var sheet = { name: "Bram Stoneheart", gender: "M", hp: 9, maxHp: 9, inventory: [], conditions: [], relationships: [], aliases: [], cls: "Warrior", level: 1, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, abilities: [], spells: [], skills: initSkills() };
  worldState.npcs = [{ name: "Bram Stoneheart", status: "ally", rel: "companion", met: 1, partyMember: true, pronouns: "he/him", portrait: null, aliases: [], charSheet: sheet },
    { name: "Garrick", status: "present", rel: "ally", met: 2, partyMember: false, pronouns: "he/him", portrait: null, aliases: ["Stoneheart"] }];
  memory.npcs = { "Bram Stoneheart": { attitude: "ally", knowledge: [], events: [{ turn: 1, note: "met at the forge" }], aliases: [], pronouns: "he/him", partyMember: true },
    "Garrick": { attitude: "", knowledge: [], events: [], aliases: ["Stoneheart"], pronouns: "he/him" } };
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  var q = quiet(function () { return swapPlayerCharacter("Bram Stoneheart"); }); if (!q.r || !q.r.ok) throw new Error("swap failed");
}
function st() { return { hero: worldState.character.name, heroRecordEvents: memory.npcs["Bram Stoneheart"].events.map(function (e) { return e.note; }), garrickEvents: memory.npcs["Garrick"].events.map(function (e) { return e.note; }), rowsNamedLikeHero: worldState.npcs.filter(function (n) { return memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name + " pronouns=" + n.pronouns; }), garrickPronouns: wsNpcByName("Garrick").pronouns }; }
function go(rep) { var r = run(rep); P("   " + JSON.stringify(rep), ""); P("      muts", r.muts); }
P("\n-- operand written tight: resolves through Garrick's alias", ""); setup(); go("[NPC_NOTE:Stoneheart|paid the toll] [NPC_PRONOUN:Stoneheart|they/them]"); P("   state", st());
P("\n-- the same operand with a space each side", ""); setup(); go("[NPC_NOTE: Stoneheart |paid the toll] [NPC_PRONOUN: Stoneheart |they/them]"); P("   state", st());
