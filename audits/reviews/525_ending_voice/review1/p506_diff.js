require("./h.js");
// Differential battery for the [NPC:] handler: run on two trees (ENGINE_ROOT) and diff the output files.
// Subjects: party member with trait, unsheeted NPC, sheeted NPC without trait, sheeted NPC with trait (adventure + village), a NEW npc, a dead npc.
var moods = ["unconscious", "terrified, captured by the slavers", "cheerful, warm", "grim; bound", "pouring ale, sick", "wounded", "dead", "resurrected", "", "she/her", "fled", "missing", "restrained, polite", "watching the road", "at the mill", "asleep, snoring", "slain", "petrified", "hostile"];
function subjects(kind) {
  if (kind === "village") { villageEF(); } else { makeWorld(); delete worldState.kind; }
  worldState.turn = 30;
  function add(name, o) { var n = { name: name, status: "steady", statusTurn: 5, rel: "ally", partyMember: false, pronouns: "he/him", met: 1, portrait: null, aliases: [] }; Object.keys(o).forEach(function (k) { n[k] = o[k]; }); worldState.npcs.push(n); memory.npcs[name] = { attitude: "", knowledge: [], events: [], aliases: [] }; }
  add("PartyTrait", { partyMember: true, charSheet: { name: "PartyTrait", cls: "Warrior", level: 3, trait: "Blunt", inventory: [], abilities: [] } });
  add("Unsheeted", {});
  add("SheetNoTrait", { charSheet: { name: "SheetNoTrait", cls: "Warrior", level: 3, trait: "", inventory: [], abilities: [] } });
  add("SheetTrait", { charSheet: { name: "SheetTrait", cls: "Warrior", level: 3, trait: "Blunt and loyal", inventory: [], abilities: [] } });
  add("DeadOne", { dead: 12, status: "dead", charSheet: { name: "DeadOne", cls: "Warrior", level: 3, trait: "Quiet", inventory: [], abilities: [] } });
}
["adventure", "village"].forEach(function (kind) {
  moods.forEach(function (m) {
    ["PartyTrait", "Unsheeted", "SheetNoTrait", "SheetTrait", "DeadOne", "Newcomer"].forEach(function (who) {
      subjects(kind);
      var r = run("[NPC:" + who + "|" + m + "|friend]");
      var n = wsNpcByName(who);
      console.log(kind + " | " + who + " | " + J(m) + " => status=" + J(n && n.status) + " turn=" + (n && n.statusTurn) + " rel=" + J(n && n.rel) + " dead=" + (n && n.dead) + " pron=" + J(n && n.pronouns) + " muts=" + J(r.muts));
    });
  });
});
