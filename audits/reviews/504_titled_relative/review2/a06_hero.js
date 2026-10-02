// Finding A: after a REAL hero swap (swapPlayerCharacter), a merge whose canonical RESOLVES to the hero lands on the hero.
require("./b.js");
function swapTo(name) {
  var row = wsNpcByName(name); row.partyMember = true;
  var sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = name; sheet.gender = "F"; sheet.relationships = []; row.charSheet = sheet;
  var r = quiet(function () { return swapPlayerCharacter(name); }).r; console.log("  swapPlayerCharacter -> " + JSON.stringify(r));
}
function state(label) { console.log("  " + label + " hero=" + worldState.character.name + "\n     ROWS " + rows() + "\n     MEM  " + mems()); }

hdr("A1 title question open, then the player switches to Wilhelmina (refs ON)");
q(); swapTo("Wilhelmina Underbough"); state("after the swap:");
worldState.turn += PROVISIONAL_NUDGE_COOLDOWN + 1;
var note = quiet(function () { return buildProvisionalNudge(); }).r; console.log("  NOTE: " + note);
worldState.turn++;
go("It is her. [NPC_MERGE:Wilhelmina|" + K + "]"); state("after [NPC_MERGE:Wilhelmina|<provisional>]:");
show("  an NPC roster row under the hero's name", JSON.stringify(wsNpcByName("Wilhelmina Underbough")));

hdr("A2 the exact name is refused (what the fix covers)");
q(); swapTo("Wilhelmina Underbough"); worldState.turn++;
go("[NPC_MERGE:Wilhelmina Underbough|" + K + "]"); state("after:");

hdr("A3 another provisional, 'other' reading: the canonical is a short form of the hero (refs OFF)");
fresh({ refs: false }); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her");
quiet(function () { applyMuts("[NPC:Lady Marsh|calm|ally]"); }); worldState.turn = 86;
swapTo("Wilhelmina Underbough"); worldState.turn++;
go("[MERGE:npc|Wilhelmina|Lady Marsh]"); state("after [MERGE:npc|Wilhelmina|Lady Marsh]:");

hdr("A4 with refs ON the same 'other' reading is offered for confirmation by the hero's name, then refused when confirmed");
fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her");
quiet(function () { applyMuts("[NPC:Lady Marsh|calm|ally]"); }); worldState.turn = 86;
swapTo("Wilhelmina Underbough"); worldState.turn++;
go("[MERGE:npc|Wilhelmina|Lady Marsh]"); show("  queued", JSON.stringify(worldState.pendingMergeHints));
var n2 = quiet(function () { return buildMergeConfirmNudge(); }).r; console.log("  CONFIRM NOTE: " + n2);
worldState.turn++; go("[NPC_MERGE:Wilhelmina Underbough|Lady Marsh " + "°t85]"); state("after the note's own tag:");

hdr("B the #156 note after its 'of' became the hero");
fresh(); person("Savah", "she/her"); worldState.turn = 140;
quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met]"); });
swapTo("Savah"); worldState.turn = 141 + PROVISIONAL_NUDGE_COOLDOWN;
note = quiet(function () { return buildProvisionalNudge(); }).r; console.log("  NOTE: " + note);
worldState.turn++; var r = go("[NPC_MERGE:Savah|Savah °t140]"); state("after the note's own tag:");
show("  tagLog refused", JSON.stringify((worldState.tagLog || []).slice(-1)[0]));
