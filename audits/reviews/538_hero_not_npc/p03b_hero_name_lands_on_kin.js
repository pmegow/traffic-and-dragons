// H2, end to end: a relative is introduced by a possessive handle through the ordinary [NPC:] tag; from then on the hero's EXACT name
// consolidates onto that one record, and the two "older refusals" ([NPC:], [NPC_DEATH_REPORTED:]) plus the summary path no longer see the player.
require("./common.js");
P("version", ver());
function kin(k) { var n = wsNpcByName(k), m = memory.npcs[k]; return { status: n && n.status, rel: n && n.rel, dead: (n && n.dead) || (m && m.dead) || null, events: m ? (m.events || []).map(function (e) { return e.note; }) : null, knowledge: m ? m.knowledge : null, attitude: m ? m.attitude : null }; }
function flow(hero, gender, kinName, kinPron, second) {
  var h = world({ hero: hero }); worldState.character.gender = gender;
  P("\n-- hero '" + h + "' (" + gender + "); reply 1 introduces '" + kinName + "'", "");
  var r1 = run("She waits at the gate. [NPC:" + kinName + "|worried|family] [NPC_PRONOUN:" + kinName + "|" + kinPron + "]"); P("   reply 1 muts", r1.muts);
  P("   resolveNpcName('" + h + "') ->", resolveNpcName(h));
  if (typeof second === "string") { var r2 = run(second.split("HERO").join(h)); P("   reply 2: " + second.split("HERO").join(h), ""); P("     muts", r2.muts); }
  else { var q = quiet(function () { return applySummaryExtract(second(h), null); }); P("   summary extraction: " + JSON.stringify(second(h)), ""); P("     console", q.warns.filter(function (w) { return /death|player|rejected/i.test(w); }).map(function (w) { return w.slice(0, 160); })); }
  P("   '" + kinName + "' now", kin(kinName)); P("   hero-named records", Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }));
}
flow("Tess", "F", "Tess's mother", "she/her", "You fall. [NPC:HERO|dead|ally]");
flow("Silas", "M", "Silas's mother", "she/her", "Word comes back. [NPC_DEATH_REPORTED:HERO|a rider from the pass]");
flow("Silas", "M", "Silas's mother", "she/her", "You rage. [NPC:HERO|furious|enemy]");
flow("Silas", "M", "Silas's mother", "she/her", function (h) { return { npcDeaths: [h] }; });
flow("Silas", "M", "Silas's mother", "she/her", function (h) { return { npcUpdates: [{ name: h, attitude: "vengeful", knowledgeGained: "swore to burn the mill" }] }; });
flow("Silas", "M", "Old Silas", "he/him", "You fall. [NPC:HERO|dead|ally]");
flow("Silas", "M", "Silas's mother", "she/her", "[NPC_NOTE:HERO|a fact] [NPC_SUPERSEDE:HERO|old|new] [PARTY_MEMBER:HERO|true] [NPC_LINK:HERO|Bram|kin] [NPC_FACTION:HERO|The Guild|member] [NPC_FORGET:HERO|gate]");
P("\n   graph after the last flow", JSON.stringify(memory.npcGraph || {}).slice(0, 300));
