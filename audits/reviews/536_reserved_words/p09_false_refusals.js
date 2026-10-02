// REVIEW PROBE p09: ordinary text the tag door refuses. The strip splits EVERY payload on pipes AND commas and tests each
// piece, so (a) a sentence that lists the word between commas and (b) an operand that is never a key (a mood, a note, a
// description, a price note) are refused. argv: <tree>
var L = require("./lib.js");
var CASES = [
  ["a note: the word between commas in a sentence", "[NPC_NOTE:Bram|A mason, constructor, and father of three]", function () { return JSON.stringify(memory.npcs.Bram.events.map(function (e) { return e.note; })); }],
  ["a note: the word in a sentence, no commas (the author's own control)", "[NPC_NOTE:Bram|knew the constructor of the old bridge]", function () { return JSON.stringify(memory.npcs.Bram.events.map(function (e) { return e.note; })); }],
  ["lore: a list of ranks", "[LORE:The guild has three ranks: apprentice, constructor, master]", function () { return JSON.stringify(memory.lore); }],
  ["a decision", "[DECISION:Hired a carpenter, constructor, and two labourers for the bridge]", function () { return JSON.stringify(memory.keyDecisions.map(function (d) { return d.desc; })); }],
  ["a place description", "[LOCATION_DESC:A yard of stacked stone where the mason, constructor, and quarrymen eat at noon]", function () { return JSON.stringify(memory.map.nodes.Ashfen.description); }],
  ["a quest description", "[QUEST:The Broken Span|active|Find a mason, constructor, or engineer willing to work]", function () { return JSON.stringify(worldState.questLog.map(function (q) { return q.title; })); }],
  ["a defining moment", "[CORE_MEMORY:Bram|Bram swore, constructor, to raise the span again]", function () { return JSON.stringify((worldState.character.coreMemories || []).map(function (m) { return m.text; })); }],
  ["a story beat", "[STORY_BEAT:Named mason, constructor, and warden of the span]", function () { return JSON.stringify((worldState.character.storyBeats || []).map(function (m) { return m.text; })); }],
  ["suggestion buttons", "[SUGGEST:Ask the mason about the span|Find the guild's surveyor, constructor, or clerk|Leave]", function () { return JSON.stringify(worldState.suggestInband && worldState.suggestInband.acts); }],
  ["an NPC's MOOD is the word (a mood is never a key)", "[NPC:Bram|constructor|ally]", function () { return JSON.stringify(wsNpcByName("Bram").status); }],
  ["a ware's note is the word", "[WARES:Level|2 gp|constructor]", function () { return JSON.stringify(((memory.map.nodes.Ashfen || {}).wares || []).map(function (w) { return w.item; })); }],
  ["the hero learns a language at a level named by the word", "[LANGUAGE:Dwarvish|constructor]", function () { return JSON.stringify(worldState.character.languages.map(function (l) { return l.name; })); }],
  ["weather", "[WEATHER:constructor]", function () { return JSON.stringify(worldState.world.weather); }],
  ["an upper-case tag payload: TIME", "[TIME:Constructor]", function () { return JSON.stringify(worldState.world.time); }]
];
console.log("tree: " + L.TREE);
CASES.forEach(function (c) {
  L.world("plain");
  var r = run("It happens. " + c[1]);
  var refused = r.muts.filter(function (m) { return /reserved word/.test(m); });
  console.log((refused.length ? "REFUSED " : "filed   ") + c[0] + "\n          " + c[1] + "\n          summary: " + JSON.stringify(r.muts).slice(0, 200) + " | stored: " + String(c[2]()).slice(0, 200) + " | handler errors: " + JSON.stringify((r.r && r.r.errors) || []) + " | built-ins: " + JSON.stringify(L.poison()));
});
