// With the question about "Queen Underbough" OPEN, other forms of her name in tags that are not [NPC:]
require("./b.js");
["[NPC_DEATH_REPORTED:Old Queen Underbough|a rider]", "[NPC_NOTE:Queen Mother Underbough|was crowned at Elderwood]", "[NPC_PRONOUN:the old Queen Underbough|she/her] [NPC_NOTE:the old Queen Underbough|rules the Elderwood]", "[NPC_DEATH_REPORTED:Queen_Underbough|a rider]", "[NPC:Old Queen Underbough|weeping|hostile]"].forEach(function (t) {
  q(); var pre = JSON.stringify([memory.npcs["Wilhelmina Underbough"], wsNpcByName("Wilhelmina Underbough")]);
  var r = run(t);
  console.log("  " + t + "\n     muts=" + JSON.stringify(r.muts) + "\n     the princess's record changed: " + (JSON.stringify([memory.npcs["Wilhelmina Underbough"], wsNpcByName("Wilhelmina Underbough")]) !== pre) + " | records: " + Object.keys(memory.npcs).join(", ") + " | princess row: " + rows().split(";")[0]);
});
