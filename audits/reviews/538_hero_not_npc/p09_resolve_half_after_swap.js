// The "resolves to the player" half of memoryNpcNamesPlayer, after a hero swap (the promoted companion's memory record stays under the new hero's name).
// Two handlers never resolve the operand they write (NPC_ALIAS registers the alias string as written; NPC_MERGE uses the survivor's name as written),
// so for them the resolve half is a refusal on a guess. Control: the same tags in a campaign that never swapped.
require("./common.js");
P("version", ver());
function setup(swapped) {
  makeWorld(); delete worldState.kind; worldState.turn = 9;
  var sheet = { name: "Bram Stoneheart", gender: "M", hp: 9, maxHp: 9, inventory: [], conditions: [], relationships: [], aliases: [], cls: "Warrior", level: 1, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, abilities: [], spells: [], skills: initSkills() };
  worldState.npcs = [{ name: "Bram Stoneheart", status: "ally", rel: "companion", met: 1, partyMember: true, pronouns: "he/him", portrait: null, aliases: [], charSheet: sheet },
    { name: "Mara", status: "present", rel: "ally", met: 2, partyMember: false, pronouns: "she/her", portrait: null, aliases: [] },
    { name: "the old smith", status: "present", rel: "neutral", met: 3, partyMember: false, pronouns: "he/him", portrait: null, aliases: [] }];
  memory.npcs = { "Bram Stoneheart": { attitude: "ally", knowledge: ["forged the gate"], events: [{ turn: 1, note: "met at the forge" }], aliases: [], pronouns: "he/him", partyMember: true },
    "Mara": { attitude: "", knowledge: [], events: [], aliases: [], pronouns: "she/her" },
    "the old smith": { attitude: "", knowledge: ["taught Bram the hammer"], events: [{ turn: 3, note: "sold nails" }], aliases: [], pronouns: "he/him" } };
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  if (swapped) { var q = quiet(function () { return swapPlayerCharacter("Bram Stoneheart"); }); if (!q.r || !q.r.ok) throw new Error("swap failed"); }
  else { worldState.character.name = "Bram Stoneheart"; worldState.npcs.shift(); delete memory.npcs["Bram Stoneheart"]; } // control: Bram Stoneheart was the hero from turn 0 — no record of his own
}
function go(rep) { var r = run(rep); P("   " + rep, ""); P("      muts", r.muts); }
[false, true].forEach(function (swapped) {
  P("\n######## " + (swapped ? "AFTER A HERO SWAP to Bram Stoneheart (his old memory record is still on file)" : "CONTROL: Bram Stoneheart is the hero from turn 0"), "");
  setup(swapped); P("hero / hero-named memory keys", [worldState.character.name, Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); })]);
  go("His sister is called by the family name. [NPC_ALIAS:Mara|Stoneheart]"); P("   Mara aliases", memory.npcs["Mara"].aliases);
  setup(swapped);
  go("The old smith is his father. [NPC_MERGE:Old Stoneheart|the old smith]"); P("   memory keys", Object.keys(memory.npcs)); P("   rows", worldState.npcs.map(function (n) { return n.name; }));
  setup(swapped);
  go("[NPC:Old Stoneheart|gruff|ally] [NPC_NOTE:Old Stoneheart|raised Bram at the forge] [NPC_PRONOUN:Old Stoneheart|he/him]"); P("   memory keys", Object.keys(memory.npcs)); P("   rows", worldState.npcs.map(function (n) { return n.name; }));
  P("   hero's own record", memory.npcs["Bram Stoneheart"] ? { events: memory.npcs["Bram Stoneheart"].events.map(function (e) { return e.note; }) } : null);
});
