// REVIEW PROBE p20: well-formed canon claims around a reserved word (the cases expected to be clean). argv: <tree>
var L = require("./lib.js");
console.log("tree: " + L.TREE);
function setup() {
  L.world("refs"); worldState.turn = 8;
  quiet(function () { applyMuts("A hooded figure steps out. [SCENE_REF:h1|Bram] [SAY:Bram]\"Evening,\" he says."); });
  worldState.turn = 9;
}
function st() { var b = wsNpcByName("Bram"); return "Bram " + (npcIsDead(b) ? "DEAD" : "alive") + " | xp " + worldState.character.xp + " | gold " + worldState.character.gold + " | pack " + JSON.stringify(worldState.character.inventory) + " | quest " + JSON.stringify(worldState.questLog.map(function (q) { return q.status; }).concat(Object.keys(memory.quests || {}).map(function (k) { return "archived:" + memory.quests[k].status; }))) + " | claims " + JSON.stringify((worldState.canonTxns || []).map(function (t) { return t.id + ":" + t.status; })); }
function go(label, text) { setup(); var r = run(text), p = L.poison(); console.log("--- " + label + "\n    " + text + "\n    summary: " + JSON.stringify(r.muts).slice(0, 380) + "\n    after  : " + st() + (((r.r && r.r.errors) || []).length ? " | handler errors " + JSON.stringify(r.r.errors) : "") + (p.length ? " | wrote on built-ins: " + p.join(", ") : "")); }
go("control: a well-formed death claim with a reward", "He falls. [CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][XP:5][ITEM_GAINED:Bram's ring][CANON_TXN_END:c1]");
go("the same claim, one reward tag carries the word", "He falls. [CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][XP:5][ITEM_GAINED:constructor][CANON_TXN_END:c1]");
go("two claims, the FIRST carries the word in its marker", "x [CANON_TXN_BEGIN:c0|npc-death|constructor|h9|-][SCENE_DEATH:h9][XP:5][CANON_TXN_END:c0] y [CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][XP:5][CANON_TXN_END:c1]");
go("two claims, the SECOND carries the word in its marker", "x [CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][XP:5][CANON_TXN_END:c1] y [CANON_TXN_BEGIN:c2|quest-outcome|-|-|constructor][QUEST:constructor|completed][GOLD:9][CANON_TXN_END:c2]");
go("a death claim whose death operation is the tag that carries the word (wrong-victim tag)", "He falls. [CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][NPC:constructor|dead|enemy][XP:5][CANON_TXN_END:c1]");
go("control for the line above (a second victim that is not the subject)", "He falls. [CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][NPC:construqtor|dead|enemy][XP:5][CANON_TXN_END:c1]");
