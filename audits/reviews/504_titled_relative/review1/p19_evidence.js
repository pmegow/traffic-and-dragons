// p19 — scene evidence gathered under the ° key while the question was open: does it still vouch after the answer lands?
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Queen Underbough", 85);
function open() {
  fresh(); person("Wilhelmina Underbough", "she/her");
  run("[NPC:Queen Underbough|furious|hostile] [NPC_PRONOUN:Queen Underbough|she/her]"); worldState.turn = 86;
  run("She steps from the dais. [SCENE_REF:the queen|Queen Underbough] [SCENE_CAST:Queen Underbough] [SAY:Queen Underbough|Out.]"); worldState.turn = 87;
}
function frame() { var f = worldState.sceneRefs.active; return "actors=" + JSON.stringify((f.actors || []).map(function (a) { return a.handle + "->" + a.entity; })) + " observed=" + JSON.stringify((f.observed || []).map(function (o) { return o.entity; })) + " castLast=" + JSON.stringify(worldState.castLast && worldState.castLast.names); }
function kill(label, answer, name) {
  open(); line("frame before the answer", frame());
  var r = run(answer); line(label + " -> muts", JSON.stringify(r.muts)); line("frame after the answer", frame());
  worldState.turn = 88;
  r = run("The blade finds her. [CANON_TXN_BEGIN:q1|npc-death|" + name + "|the queen|-][SCENE_DEATH:the queen][NPC:" + name + "|dead|hostile][CANON_TXN_END:q1]");
  line("t88 death by handle, subject " + name + " -> rows", rows()); line("muts", JSON.stringify(r.muts)); line("warns", JSON.stringify(r.warns.filter(function (w) { return /identity|QUARANTINED|refus/i.test(w); }).slice(0, 2).map(function (w) { return w.slice(0, 220); })));
  open(); run(answer); worldState.turn = 88;
  r = run("The blade finds her. [NPC:" + name + "|dead|hostile]");
  line("t88 bare death tag, " + name + " -> rows", rows()); line("muts", JSON.stringify(r.muts)); line("warns", JSON.stringify(r.warns.filter(function (w) { return /identity|QUARANTINED|refus/i.test(w); }).slice(0, 2).map(function (w) { return w.slice(0, 220); })));
}
hdr("control: no answer yet — the provisional dies by her handle");
open(); var r = run("[CANON_TXN_BEGIN:q0|npc-death|Queen Underbough|the queen|-][SCENE_DEATH:the queen][NPC:Queen Underbough|dead|hostile][CANON_TXN_END:q0]");
line("rows", rows()); line("muts", JSON.stringify(r.muts));
hdr("DIFFERENT, proper name, then her death");
kill("answer", "[MERGE:npc|Queen Isolde Underbough|" + K + "]", "Queen Isolde Underbough");
hdr("DIFFERENT, name kept, then her death");
kill("answer", "[MERGE:npc|Queen Underbough|" + K + "]", "Queen Underbough");
