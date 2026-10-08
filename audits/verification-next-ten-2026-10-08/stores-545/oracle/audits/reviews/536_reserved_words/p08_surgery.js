// REVIEW PROBE p08: what removing ONE tag (or one marker) does to what remains. argv: <tree>
var L = require("./lib.js");
function st() { var b = wsNpcByName("Bram"), k = findCompanionChar("Kira"); return "gold " + worldState.character.gold + " | xp " + worldState.character.xp + " | pack " + JSON.stringify(worldState.character.inventory) + " | Kira " + JSON.stringify(k && k.inventory) + " | Bram " + (b ? (npcIsDead(b) ? "DEAD" : "alive") : "gone") + " | quest " + JSON.stringify(worldState.questLog.map(function (q) { return q.status; })) + " | claims " + JSON.stringify((worldState.canonTxns || []).map(function (t) { return t.id + ":" + t.status; })); }
function go(label, text, mode, before) {
  L.world(mode || "plain"); worldState.character.inventory = ["Longsword", "Rope"]; if (before) before();
  var r, thrown = ""; try { r = run(text); } catch (e) { thrown = e.message; r = { muts: [], r: {} }; }
  var p = L.poison();
  console.log("--- " + label + (mode ? " [" + mode + "]" : "") + "\n    " + text + "\n    summary: " + JSON.stringify(r.muts).slice(0, 330) + "\n    after  : " + st() + (((r.r && r.r.errors) || []).length ? "\n    handler errors: " + JSON.stringify(r.r.errors).slice(0, 200) : "") + (thrown ? "\n    THROWN: " + thrown : "") + (p.length ? "\n    wrote on built-ins: " + p.join(", ").slice(0, 200) : ""));
}
console.log("tree: " + L.TREE);
console.log("===== 1. pairs: one half refused, the other lands");
go("coin + item (the GM sells the hero a thing named by the word)", "You pay the mason. [GOLD:-25] [ITEM_GAINED:Constructor]");
go("stow pair: the place operand is the word", "You set it down. [ITEM_LOST:Rope] [LOCATION_ITEM:Rope|placed|constructor]");
go("give pair: the receiver is the word", "You hand it over. [ITEM_LOST:Rope] [COMPANION_ITEM_GAINED:constructor|Rope]");
go("give pair, control receiver", "You hand it over. [ITEM_LOST:Rope] [COMPANION_ITEM_GAINED:construqtor|Rope]");
console.log("===== 2. a canon marker with the word and NO partner marker (a cut-off reply, a forgotten END)");
go("BEGIN with the word as subject, END missing", "He falls. [CANON_TXN_BEGIN:c1|npc-death|constructor|h1|-][NPC:Bram|dead|enemy][XP:50][GOLD:20]");
go("same, control subject", "He falls. [CANON_TXN_BEGIN:c1|npc-death|construqtor|h1|-][NPC:Bram|dead|enemy][XP:50][GOLD:20]");
go("END with the word as id, BEGIN missing", "He falls. [NPC:Bram|dead|enemy][XP:50][GOLD:20][CANON_TXN_END:constructor]");
go("same, control id", "He falls. [NPC:Bram|dead|enemy][XP:50][GOLD:20][CANON_TXN_END:construqtor]");
go("BEGIN with the word, END missing, scene refs active", "He falls. [CANON_TXN_BEGIN:c1|npc-death|constructor|h1|-][NPC:Bram|dead|enemy][XP:50][GOLD:20]", "refs");
go("same, control, scene refs active", "He falls. [CANON_TXN_BEGIN:c1|npc-death|construqtor|h1|-][NPC:Bram|dead|enemy][XP:50][GOLD:20]", "refs");
go("quest claim: BEGIN carries the word as its id, END missing", "The bell rings. [CANON_TXN_BEGIN:constructor|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][GOLD:20]");
go("same, control id", "The bell rings. [CANON_TXN_BEGIN:construqtor|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][GOLD:20]");
console.log("===== 3. two claims, the first unterminated, the second carrying the word");
go("claim a (no END) then claim b with the word", "x [CANON_TXN_BEGIN:a|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][GOLD:20] y [CANON_TXN_BEGIN:b|npc-death|constructor|h1|-][NPC:Bram|dead|enemy][XP:50][CANON_TXN_END:b]");
go("same, control", "x [CANON_TXN_BEGIN:a|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][GOLD:20] y [CANON_TXN_BEGIN:b|npc-death|construqtor|h1|-][NPC:Bram|dead|enemy][XP:50][CANON_TXN_END:b]");
console.log("===== 4. a death claim whose death tag carries the word in a NON-name operand");
go("the relation operand of the death tag is the word", "He falls. [CANON_TXN_BEGIN:c1|npc-death|Bram|-|-][NPC:Bram|dead|constructor][XP:50][CANON_TXN_END:c1]");
go("same, control", "He falls. [CANON_TXN_BEGIN:c1|npc-death|Bram|-|-][NPC:Bram|dead|construqtor][XP:50][CANON_TXN_END:c1]");
console.log("===== 5. bare markers (no brackets) restored first");
go("bare BEGIN/END lines with the word as subject", "He falls.\nCANON_TXN_BEGIN:c1|npc-death|constructor|h1|-\n[NPC:Bram|dead|enemy][XP:50]\nCANON_TXN_END:c1");
