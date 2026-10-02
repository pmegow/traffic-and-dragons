// p08 — names holding an Object.prototype key ("constructor"). PROBE_TREE=pre|head. Also the tree BEFORE #503 is not available here.
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
function attempt(label, fn) { try { var v = fn(); line(label, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) { line(label, "THROW " + e.message); } }
hdr("the pure readers");
attempt("npcCoreTokens('Malrik the Constructor')", function () { return npcCoreTokens("Malrik the Constructor"); });
attempt("npcNameSays('Malrik the Constructor')", function () { return npcNameSays("Malrik the Constructor"); });
attempt("npcNameSays('Constructor Vale')", function () { return npcNameSays("Constructor Vale"); });
if (typeof npcNameWords === "function") attempt("npcNameWords('Queen Constructor')", function () { return npcNameWords("Queen Constructor"); });
hdr("through the engine: a record named 'Malrik the Constructor', then a tag by his short name");
fresh(); person("Malrik the Constructor", "he/him");
var r; attempt("[NPC:Malrik|grim|neutral] [NPC:Vessa|calm|ally]", function () { r = run("[NPC:Malrik|grim|neutral] [NPC:Vessa|calm|ally]"); return { rows: rows(), errors: r.r && r.r.errors, muts: r.muts }; });
hdr("a death tag (resolved outside any handler try/catch, in w2PrepareResponse)");
fresh(); person("Malrik the Constructor", "he/him");
attempt("[NPC:Malrik|dead|enemy] [XP:50]", function () { r = run("[NPC:Malrik|dead|enemy] [XP:50]"); return { rows: rows(), errors: r.r && r.r.errors, muts: r.muts, xp: worldState.character.xp }; });
hdr("#504's own lookups with the word in the tagged name");
fresh(); person("Wilhelmina Underbough", "she/her");
attempt("npcConsolidation('Constructor Underbough')", function () { return npcConsolidation("Constructor Underbough"); });
attempt("[NPC:Queen Underbough (the constructor)|x|y]", function () { r = run("[NPC:Queen Underbough (the constructor)|x|y]"); return { mem: mems(), errors: r.r && r.r.errors }; });
attempt("[NPC:Queen Constructor Underbough|x|y]", function () { r = run("[NPC:Queen Constructor Underbough|x|y]"); return { mem: mems(), errors: r.r && r.r.errors }; });
hdr("merge operands");
fresh(); person("Wilhelmina Underbough", "she/her"); run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86;
attempt("[MERGE:npc|constructor|Queen Underbough]", function () { r = run("[MERGE:npc|constructor|Queen Underbough]"); return { mem: mems(), errors: r.r && r.r.errors, muts: r.muts }; });
attempt("[MERGE:npc|toString|Queen Underbough]", function () { r = run("[MERGE:npc|toString|Queen Underbough]"); return { mem: mems(), errors: r.r && r.r.errors, muts: r.muts }; });
attempt("[NPC_MERGE:Wilhelmina Underbough|constructor]", function () { r = run("[NPC_MERGE:Wilhelmina Underbough|constructor]"); return { mem: mems(), errors: r.r && r.r.errors, muts: r.muts }; });
attempt("Object pollution check", function () { return { firstEncounter: Object.firstEncounter, aliases: Object.aliases, provisional: Object.provisional }; });
