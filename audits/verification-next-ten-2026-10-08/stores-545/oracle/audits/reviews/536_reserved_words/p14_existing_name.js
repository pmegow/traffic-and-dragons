// REVIEW PROBE p14: a campaign that ALREADY has a person whose name is such a word in another case ("Constructor": harmless as
// a case-preserving key, refused because item keys are lower-cased). What does the summary door do with them? argv: <tree>
var L = require("./lib.js");
function fresh() { L.world("refs"); worldState.npcs.push({ name: "Constructor", status: "", rel: "enemy", met: 2, partyMember: false, aliases: [], pronouns: "it/its" }); memory.npcs["Constructor"] = { attitude: "", knowledge: ["a brass golem of the old guild"], events: [], aliases: [] }; worldState.turn = 20; }
function attempt(label, ex) {
  fresh(); var thrown = "", q;
  try { q = quiet(function () { return applySummaryExtract(ex, null); }); } catch (e) { thrown = String(e && e.message || e); }
  var c = memory.npcs["Constructor"], w = wsNpcByName("Constructor");
  console.log("--- " + label + "\n    " + JSON.stringify(ex).slice(0, 260) + "\n    " + (thrown ? "applySummaryExtract THREW (the whole extraction is rejected): " + thrown.slice(0, 200) : "applied") + "\n    console: " + JSON.stringify((q ? q.warns : []).filter(function (x) { return /#540|dropped|rejected/i.test(x); }).map(function (x) { return x.slice(0, 150); })) + "\n    Constructor knows " + JSON.stringify(c.knowledge) + " | attitude " + JSON.stringify(c.attitude) + " | dead " + JSON.stringify(c.dead || (w && w.dead) || null) + " | Bram knows " + JSON.stringify(memory.npcs.Bram.knowledge) + " | chapters " + memory.chapters.length + " | built-ins " + JSON.stringify(L.poison()));
}
console.log("tree: " + L.TREE);
attempt("an ordinary update for the golem beside one for Bram", { chapterSummary: "The party studied the golem in the yard.", npcUpdates: [{ name: "Constructor", attitude: "watchful", knowledgeGained: "its left arm is cracked" }, { name: "Bram", knowledgeGained: "fears the golem" }] });
attempt("the golem's death, cited the way the schema asks", { chapterSummary: "Constructor was destroyed in the yard.", npcDeaths: [{ name: "Constructor", handle: "h1", sourceTurn: 19 }], npcUpdates: [{ name: "Bram", knowledgeGained: "saw the golem fall" }] });
attempt("the same death in plainer words ('was killed')", { chapterSummary: "Constructor was killed in the yard.", npcDeaths: [{ name: "Constructor", handle: "h1", sourceTurn: 19 }], npcUpdates: [{ name: "Bram", knowledgeGained: "saw the golem fall" }] });
console.log("    open identity conflicts now: " + JSON.stringify((worldState.identityConflicts || []).map(function (c) { return c.subject + ": " + c.reason; })));
attempt("a control death for Bram, same shape", { chapterSummary: "Bram was killed in the yard.", npcDeaths: [{ name: "Bram", handle: "h1", sourceTurn: 19 }] });
