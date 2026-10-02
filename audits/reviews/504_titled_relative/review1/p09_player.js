// p09 — the player's own name. (a) a hero swap while a title question about that companion is open; (b) surname-form death
// of the established person while the question is open. PROBE_TREE=pre|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
hdr("a. companion Daeris Vane, [NPC:Mother Vane], the player then switches hero to Daeris, the GM answers SAME with the note's own tag");
fresh();
var sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = "Daeris Vane"; sheet.gender = "F";
person("Daeris Vane", "she/her", { partyMember: true, charSheet: sheet, rel: "companion" });
var r = run("[NPC:Mother Vane|stern|acquaintance]");
line("after the tag", mems());
var sw; try { sw = quiet(function () { return swapPlayerCharacter("Daeris Vane"); }).r; } catch (e) { sw = "THROW " + e.message; }
line("swap", JSON.stringify(sw)); line("hero is now", worldState.character.name);
worldState.turn = 90; var note = quiet(function () { return buildProvisionalNudge(); }).r;
line("note", note ? note.slice(0, 330) : "(none)");
var m = note && note.match(/\[NPC_MERGE:[^\]]+\]/);
if (m) { r = run("It is her. " + m[0]); line("answer " + m[0] + " -> muts", JSON.stringify(r.muts)); line("rows", rows()); line("mem", mems());
  line("an NPC roster row with the hero's name", JSON.stringify(wsNpcByName(worldState.character.name))); }

hdr("b. the princess's death reported by a surname form while the question about 'Queen Underbough' is open");
fresh(); person("Wilhelmina Underbough", "she/her");
if (typeof npcTitleAsk === "function") run("[NPC:Queen Underbough|furious|hostile]"); else line("(pre tree)", "no title question exists; the tag below is the control");
worldState.turn = 86;
r = run("Word comes from the capital. [NPC_DEATH_REPORTED:Princess Underbough|a rider from the capital]");
line("muts", JSON.stringify(r.muts)); line("rows", rows());
