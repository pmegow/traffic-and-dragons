// Finding 1, compact: one line per input, head vs before.
require("./b.js");
var D = "\u00b0";
function princess() { return rows().split(";")[0]; }
function line(setup, tag, who) {
  setup(); var pre = JSON.stringify([memory.npcs[who], wsNpcByName(who)]); var r = run(tag);
  var changed = JSON.stringify([memory.npcs[who], wsNpcByName(who)]) !== pre;
  console.log("  " + tag + "\n     muts=" + JSON.stringify(r.muts) + "\n     " + who + " " + (changed ? "CHANGED -> " + rows().split("; ").filter(function (x) { return x.indexOf(who + " [") === 0; })[0] + " ev=" + (memory.npcs[who].events || []).length : "untouched") + " | records now: " + Object.keys(memory.npcs).join(", "));
}
function title() { q(); }
function s156() { fresh(); person("Savah", "she/her"); worldState.turn = 140; quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met]"); }); worldState.turn = 141; }
hdr("1a  title question open (provisional '" + K + "'): the called name with a separator");
line(title, "[NPC:Queen_Underbough|weeping|hostile]", "Wilhelmina Underbough");
line(title, "[NPC_DEATH_REPORTED:Queen-Underbough|a rider]", "Wilhelmina Underbough");
hdr("1b  title question open: another title form, in a tag that is not [NPC:]");
line(title, "[NPC_DEATH_REPORTED:Old Queen Underbough|a rider]", "Wilhelmina Underbough");
line(title, "[NPC_NOTE:Queen Mother Underbough|was crowned at Elderwood]", "Wilhelmina Underbough");
hdr("1c  #156 question open (provisional 'Savah " + D + "t140'): its key, almost right");
line(s156, "[NPC:Savah t140|grinning|rival]", "Savah");
line(s156, "[NPC_NOTE:savah " + D + "t140|is a spy for the Sczarni]", "Savah");
line(s156, "[NPC_DEATH_REPORTED:Savah " + D + "T140|a rider]", "Savah");
