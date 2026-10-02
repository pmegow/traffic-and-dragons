// "every later tag for that name, however it is spelled, gathers on the provisional (#534)" - spellings joined by a separator
require("./b.js");
hdr("title question open (Queen Underbough, of Wilhelmina Underbough she/her): where does each spelling of the called name go?");
q();
["Queen Underbough", "queen underbough", "The Queen Underbough", "Queen Underbough (her mother)", "Queen_Underbough", "Queen-Underbough", "Queen.Underbough", "Queen/Underbough", "Queen\u00a0Underbough", "Queen\u2019s Underbough", "Queen, Underbough", "Qu\u00e9en Underbough"].forEach(function (n) {
  var r = resolveNpcName(n), kind = !memory.npcs[r] ? "NO RECORD (a new one: '" + r + "')" : memory.npcs[r].provisional ? "the provisional" : "ESTABLISHED " + r;
  console.log("  " + JSON.stringify(n) + " -> " + kind);
});
hdr("the write itself");
q(); go("[NPC:Queen_Underbough|weeping|hostile] [NPC_PRONOUN:Queen_Underbough|she/her] [NPC_NOTE:Queen-Underbough|was crowned at Elderwood]"); dump();
