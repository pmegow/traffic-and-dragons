// A provisional key the GM writes almost-right: no degree sign, capital T, no space, a look-alike glyph, a wrong turn.
// Where does a tag addressed to it land? (established person = fusion; a new record = fork; the provisional = right)
require("./b.js");
var D = "°";
function where(name) {
  var r = resolveNpcName(name);
  var kind = !memory.npcs[r] ? "NO RECORD (a new one would be made: '" + r + "')" : memory.npcs[r].provisional ? "the PROVISIONAL" : "ESTABLISHED " + r;
  return kind;
}
hdr("#156 provisional 'Savah " + D + "t140' open (of Savah)");
fresh(); person("Savah", "she/her"); worldState.turn = 140;
quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met]"); }); worldState.turn = 141;
["Savah " + D + "t140", "Savah t140", "Savah " + D + "T140", "Savah" + D + "t140", "Savah ºt140", "Savah " + D + " t140", "Savah (" + D + "t140)", "Savah " + D + "t141", "Savah " + D + "t14", "savah " + D + "t140"].forEach(function (n) {
  console.log("  " + JSON.stringify(n) + " -> " + where(n));
});
hdr("the write itself: a note and a reported death addressed to the mangled key");
var pre = JSON.stringify(memory.npcs["Savah"]);
go("[NPC_NOTE:Savah t140|is a spy for the Sczarni] [NPC_DEATH_REPORTED:Savah t140|a rider]"); dump();
show("established Savah changed?", JSON.stringify(memory.npcs["Savah"]) !== pre);
show("established Savah row", JSON.stringify(wsNpcByName("Savah")));

hdr("title provisional '" + K + "' open (of Wilhelmina Underbough)");
q();
["Queen Underbough " + D + "t85", "Queen Underbough t85", "Queen Underbough " + D + "T85", "Queen Underbough" + D + "t85", "Queen Underbough ºt85", "Queen Underbough " + D + "t86", "queen underbough " + D + "t85"].forEach(function (n) {
  console.log("  " + JSON.stringify(n) + " -> " + where(n));
});
go("[NPC_NOTE:Queen Underbough t85|rules from the Elderwood]"); dump();
