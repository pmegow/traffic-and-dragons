// p15 — what the GM is shown while the question is open (the roster name it would copy), and the answer written in the same
// reply as another tag that uses the roster's ° name.
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Queen Underbough", 85);
function open() { fresh(); person("Wilhelmina Underbough", "she/her"); run("[NPC:Queen Underbough|furious|hostile] [NPC_PRONOUN:Queen Underbough|she/her] [SAY:Queen Underbough|Out.] [SCENE_CAST:Queen Underbough, Wilhelmina Underbough]"); worldState.turn = 86; }
hdr("the prompt lines that name her");
open();
var p; try { p = quiet(function () { return buildSysPrompt(); }).r; } catch (e) { p = null; console.log("buildSysPrompt threw: " + e.message); }
if (p) { var all = String(p.stable || "") + "\n" + String(p.volatile || ""), ls = all.split("\n").filter(function (l) { return /Underbough/.test(l); }); ls.slice(0, 12).forEach(function (l) { line("prompt", l.slice(0, 300)); }); }

hdr("the answer, with another tag in the SAME reply that uses the roster's ° name");
[["DIFFERENT, proper name", "[MERGE:npc|Queen Isolde Underbough|" + K + "] [NPC:" + K + "|cold|hostile]"],
 ["DIFFERENT, name kept", "[MERGE:npc|Queen Underbough|" + K + "] [NPC:" + K + "|cold|hostile]"],
 ["SAME", "[NPC_MERGE:Wilhelmina Underbough|" + K + "] [NPC:" + K + "|calm|ally]"],
 ["SAME + speech", "[NPC_MERGE:Wilhelmina Underbough|" + K + "] [SAY:" + K + "|It is I.] [NPC_NOTE:" + K + "|revealed herself]"]].forEach(function (c) {
  open(); var r = run(c[1]); console.log(" > " + c[0] + ": " + c[1]); line("rows", rows()); line("mem", mems()); line("muts", JSON.stringify(r.muts));
  var i, fired = 0; for (i = 0; i < 12; i++) { worldState.turn++; if (quiet(function () { return buildProvisionalNudge(); }).r) fired++; } line("collision note in the next 12 turns", fired + " time(s)");
});
