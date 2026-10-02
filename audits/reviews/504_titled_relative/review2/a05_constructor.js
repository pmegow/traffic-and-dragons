// #533 breadth: the WORD "constructor" (and friends) inside names, through every name-reading surface I can reach.
require("./b.js");
function tryIt(label, fn) { try { var r = quiet(fn); var v = r.r; console.log("  ok   " + label + (v !== undefined ? " -> " + (typeof v === "string" ? JSON.stringify(v.slice(0, 160)) : JSON.stringify(v).slice(0, 200)) : "") + (r.warns.filter(function (w) { return /threw|error/i.test(w); }).length ? "  WARN " + JSON.stringify(r.warns.filter(function (w) { return /threw|error/i.test(w); })) : "")); } catch (e) { console.log("  THROW " + label + " :: " + e.message); } }
hdr("world: Malrik the Constructor + Malrik Vale + Constructor Brann, sceneRefs on");
fresh(); person("Malrik the Constructor", "he/him"); person("Malrik Vale", "he/him"); person("Constructor Brann", "he/him"); person("Wilhelmina Underbough", "she/her");
tryIt("npcCoreTokens", function () { return npcCoreTokens("Malrik the Constructor"); });
tryIt("npcNameSays", function () { return npcNameSays("Malrik the Constructor"); });
tryIt("resolve 'Constructor'", function () { return resolveNpcName("Constructor"); });
tryIt("resolve 'the constructor'", function () { return resolveNpcName("the constructor"); });
tryIt("resolve 'Malrik'", function () { return resolveNpcName("Malrik"); });
tryIt("resolve 'Brann'", function () { return resolveNpcName("Brann"); });
tryIt("resolve 'Lord Constructor'", function () { return resolveNpcName("Lord Constructor"); });
tryIt("npcTitleAsk 'Lady Constructor'", function () { return npcTitleAsk("Lady Constructor"); });
tryIt("npcVariantPairs", function () { return npcVariantPairs(Object.keys(memory.npcs)); });
tryIt("scanNpcNameVariants", function () { return scanNpcNameVariants(); });
tryIt("getNameSuggestions", function () { return getNameSuggestions(5, true); });
tryIt("w2SelfNamingCanon 'Constructor'", function () { return w2SelfNamingCanon("Constructor"); });
tryIt("w2SelfNamingCanon 'the constructor'", function () { return w2SelfNamingCanon("the constructor"); });
tryIt("w2SelfNamingCanon 'Malrik the Constructor'", function () { return w2SelfNamingCanon("Malrik the Constructor"); });
tryIt("ragKnownNames", function () { return typeof ragKnownNames === "function" ? ragKnownNames().map(function (x) { return x.nm; }) : "n/a"; });
tryIt("ragQueryEntities", function () { return typeof ragQueryEntities === "function" ? ragQueryEntities("I ask the constructor about Malrik") : "n/a"; });
tryIt("ragQueryTerms", function () { return typeof ragQueryTerms === "function" ? ragQueryTerms("I ask about the constructor and the bridge") : "n/a"; });
tryIt("memoryTOC", function () { return typeof memoryTOC === "function" ? String(memoryTOC()).length : "n/a"; });
tryIt("buildSysPrompt", function () { var p = buildSysPrompt(); return typeof p === "string" ? p.length : (p && p.stable ? (p.stable.length + "/" + (p.volatile || "").length) : typeof p); });
["[NPC:Constructor|busy|ally]", "[NPC:Malrik the Constructor|dead|enemy]", "[NPC_NOTE:Constructor Brann|builds bridges]", "[NPC_PRONOUN:Malrik the Constructor|he/him]", "[NPC_DEATH_REPORTED:The Constructor|a rider]",
  "[NPC_ALIAS:Malrik the Constructor|The Constructor]", "[SAY:Constructor Brann|Hm.]", "[SCENE_REF:builder|Malrik the Constructor]", "[NPC_MERGE:Malrik the Constructor|Constructor Brann]", "[MERGE:npc|Constructor Brann|Malrik Vale]",
  "[NPC:Lady Constructor|calm|ally]", "[NPC_LINK:Malrik the Constructor|Malrik Vale|kin]", "[SCENE_CAST:Malrik the Constructor, Constructor Brann]"].forEach(function (tag) {
  try { var r = run(tag); console.log("  " + (r.r && r.r.errors && r.r.errors.length ? "ERRORS " + JSON.stringify(r.r.errors) : "ok    ") + " " + tag + " muts=" + JSON.stringify(r.muts).slice(0, 220)); } catch (e) { console.log("  THROW " + tag + " :: " + e.message); }
});
dump();
tryIt("buildSysPrompt after", function () { var p = buildSysPrompt(); return typeof p === "string" ? p.length : typeof p; });
hdr("RAG term filter: does the word 'constructor' survive as a lexical term when NO name holds it?");
fresh(); person("Wilhelmina Underbough", "she/her");
var src = String(typeof ragRetrieve === "function" ? ragRetrieve : "");
console.log("  ragRetrieve defined: " + (typeof ragRetrieve === "function"));
(function () { var ent = {}, terms = ["constructor", "bridge"], keepT = [], i; for (i = 0; i < terms.length; i++) if (!ent[terms[i]]) keepT.push(terms[i]); console.log("  plain-object filter (the shape at memory.js ~1612) keeps: " + JSON.stringify(keepT)); })();
