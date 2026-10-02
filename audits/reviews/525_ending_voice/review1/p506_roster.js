require("./h.js");
// #506: how long does the roster TELL the GM that a sheeted former companion is captured?
makeWorld(); delete worldState.kind; worldState.turn = 30;
worldState.npcs.push({ name: "Bram", status: "watching the road", rel: "former companion", partyMember: false, pronouns: "he/him", met: 1, portrait: null, aliases: [],
  charSheet: { name: "Bram", cls: "Warrior", level: 3, trait: "Blunt and loyal", inventory: [], abilities: [] } });
memory.npcs.Bram = { attitude: "", knowledge: [], events: [], aliases: [] };
run("They drag him off. [NPC:Bram|terrified, captured by the slavers|former companion]");
console.log("status on record: " + J(wsNpcByName("Bram").status) + " (statusTurn " + wsNpcByName("Bram").statusTurn + "), MOOD_AUDIT_TURNS=" + MOOD_AUDIT_TURNS);
[31, 35, 41, 42, 43, 60].forEach(function (t) {
  worldState.turn = t;
  var v = quiet(function () { return buildSysPrompt(); }).r.volatile, line = (v.match(/Bram[^;\n]*/) || ["(Bram not in the roster)"])[0];
  console.log("t" + t + " roster: " + line.slice(0, 160));
});
