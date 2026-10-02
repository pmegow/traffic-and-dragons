// The readers of resolveNpcName outside the tag table: a whole turn (commitGmTurn), the prompt, retrieval, the summary extract,
// through the life of a title question (open -> answered) and with the old key still in the transcript. Looking for throws and misfiles.
require("./b.js");
(function(){var fs=require("fs"),geval=eval,root=process.env.ENGINE_ROOT,m=require(root+"/dev/engine-manifest.js").map(function(e){return e.file;}),i=m.indexOf("game.js")+1,ow=console.warn,oi=console.info;console.warn=function(){};console.info=function(){};for(;i<m.length;i++)geval(fs.readFileSync(root+"/"+m[i],"utf8"));console.warn=ow;console.info=oi;})();
function tryIt(label, fn) { try { var r = quiet(fn); var w = r.warns.filter(function (x) { return /threw|TypeError|is not a function|undefined/i.test(x); }); console.log("  ok    " + label + (r.r !== undefined ? " -> " + String(typeof r.r === "string" ? r.r : JSON.stringify(r.r)).slice(0, 170) : "") + (w.length ? "   SUSPECT WARN " + JSON.stringify(w).slice(0, 300) : "")); return r.r; } catch (e) { console.log("  THROW " + label + " :: " + e.message + "\n" + String(e.stack).split("\n").slice(1, 4).join("\n")); } }
function turn(text) { return tryIt("commitGmTurn " + text.slice(0, 90), function () { var r = commitGmTurn(text, { playerTxt: "I look around.", logPlayer: true }); return r && r.muts ? r.muts : (r === undefined ? "(done)" : typeof r); }); }
hdr("lifecycle through whole turns (commitGmTurn), scene refs on");
fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her"); worldState.turn = 84; worldState.ragMemory = true;
turn("The hall falls silent. [NPC:Queen Underbough|furious|hostile] [SAY:Queen Underbough|Who let you in?] [SCENE_CAST:Queen Underbough, Wilhelmina Underbough]");
dump();
tryIt("buildProvisionalNudge", function () { return buildProvisionalNudge(); });
tryIt("buildSysPrompt (open)", function () { var p = buildSysPrompt(); return typeof p === "string" ? p.length : Object.keys(p).join(","); });
tryIt("memoryTOC (open)", function () { return memoryTOC().length; });
tryIt("memoryNpcDetail(K)", function () { return memoryNpcDetail(K).slice(0, 120); });
tryIt("ragRetrieve 'the queen'", function () { return String(ragRetrieve("What did Queen Underbough say to me?") || "").length; });
tryIt("summary extract naming her three ways", function () {
  return applySummaryExtract({ summary: "The queen raged.", npcUpdates: [{ name: "Queen Underbough", attitude: "hostile", knowledge: ["knows the hero entered uninvited"] }, { name: "the Queen Underbough", knowledge: ["rules the Elderwood"] }, { name: K, knowledge: ["wears the antler crown"] }],
    npcDeaths: [], sameNpc: [{ canonical: "Wilhelmina Underbough", duplicate: "Queen Underbough" }], futureEvents: [], lore: [], decisions: [] }) || "(applied)";
});
dump();
turn("She is the princess's mother. [MERGE:npc|Maeve Underbough|" + K + "] [NPC:" + K + "|cold|hostile] [NPC_NOTE:" + K + "|is Wilhelmina's mother] [SAY:" + K + "|Leave.]");
dump();
tryIt("buildSysPrompt (answered)", function () { var p = buildSysPrompt(); return typeof p === "string" ? p.length : Object.keys(p).join(","); });
tryIt("resolve old key", function () { return resolveNpcName(K); });
tryIt("ragRetrieve after the answer", function () { return String(ragRetrieve("What did Maeve Underbough say to me?") || "").length; });
tryIt("summary extract by the old key", function () { return applySummaryExtract({ summary: "x", npcUpdates: [{ name: K, knowledge: ["keeps a hound"] }], sameNpc: [{ canonical: "Maeve Underbough", duplicate: K }] }) || "(applied)"; });
dump();
turn("Later. [NPC:" + K + "|asleep|hostile] [NPC_PRONOUN:" + K + "|she/her] [NPC_DEATH_REPORTED:" + K + "|a rider]");
dump();
console.log("  transcript e.n stamps: " + JSON.stringify((worldState.transcript || []).map(function (e) { return e.e && e.e.n; }).filter(Boolean)));
console.log("  tagLog tail: " + JSON.stringify((worldState.tagLog || []).slice(-1)));
