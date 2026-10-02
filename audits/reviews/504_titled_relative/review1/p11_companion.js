// p11 — what the twin costs a COMPANION: tags addressed by her first name after the SAME answer was written with it.
// PROBE_TREE=pre|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
function setup() {
  fresh();
  var sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = "Daeris Vane"; sheet.gender = "F"; sheet.hp = 14; sheet.maxHp = 14; sheet.inventory = ["Mace"];
  person("Daeris Vane", "she/her", { partyMember: true, charSheet: sheet, rel: "companion" });
  return sheet;
}
hdr("control: no title question — [COMPANION_HP:Daeris|-3] [COMPANION_ITEM_GAINED:Daeris|Silver ring]");
var s = setup(); var r = run("[COMPANION_HP:Daeris|-3] [COMPANION_ITEM_GAINED:Daeris|Silver ring]");
line("hp / inventory", s.hp + " / " + JSON.stringify(s.inventory)); line("muts", JSON.stringify(r.muts));

hdr("title question, SAME answered with her first name, then the same companion tags");
s = setup(); r = run("[NPC:Mother Vane|stern|acquaintance]");
line("after [NPC:Mother Vane]", mems());
if (!Object.keys(memory.npcs).some(function (k) { return memory.npcs[k].provisional; })) { line("(this tree)", "no provisional — a party member is never asked about here"); }
else {
  worldState.turn = 86; r = run("It is Daeris. [NPC_MERGE:Daeris|Mother Vane]"); line("answer muts", JSON.stringify(r.muts)); line("mem", mems());
  worldState.turn = 87; r = run("[COMPANION_HP:Daeris|-3] [COMPANION_ITEM_GAINED:Daeris|Silver ring] [NPC:Daeris|bleeding|companion]");
  line("hp / inventory", s.hp + " / " + JSON.stringify(s.inventory)); line("muts", JSON.stringify(r.muts)); line("warns", JSON.stringify(r.warns.slice(0, 4).map(function (w) { return w.slice(0, 170); })));
  line("rows", rows());
}
hdr("title question OPEN, companion tags by her surname form");
s = setup(); run("[NPC:Mother Vane|stern|acquaintance]"); worldState.turn = 86;
r = run("[COMPANION_HP:Vane|-3] [COMPANION_HP:Daeris|-2]");
line("hp", s.hp); line("muts", JSON.stringify(r.muts)); line("warns", JSON.stringify(r.warns.slice(0, 3).map(function (w) { return w.slice(0, 170); })));
