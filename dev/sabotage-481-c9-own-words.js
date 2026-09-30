// dev/sabotage-481-c9-own-words.js — proves the #481 C9 guards are guarded: the narration scan reads free prose through C7's
// mask, the DEFINING MOMENTS header teaches no register word, the RETOLD MEMORY note names the moment and never quotes it,
// the sheet report lists abilities and items, and the scrub walks the real quest fields. Each mutation runs in a clone.
//   node dev/sabotage-481-c9-own-words.js
var sabotage = require("./sabotage.js"), code = 0;
var ENG = ["node", ["dev/run-tests.js", "#481 C9"]], SCRUB = ["node", ["dev/tests-459-register-gate.js"]];
function prove(file, cmd, cases) { if (!code) code = sabotage.prove({ file: file, command: cmd, cases: cases }); }
prove("api.js", ENG, [
  { label: "the narration scan files a canonical name as a slip again",
    find: "var hits=(typeof registerScanProse===\"function\"&&typeof recordCanonNames===\"function\")?registerScanProse(clean,recordCanonNames()):registerScan(clean);", replace: "var hits=registerScan(clean);",
    mustFail: "the narration scan: a canonical name is no slip" },
  { label: "the moments header teaches 'that business with the lien' again",
    find: "knows it only as a passing handle (\\\"all that business\\\"), never the record's wording", replace: "knows it only as a passing handle (\\\"that business with the lien\\\"), never the record's wording",
    mustFail: "the DEFINING MOMENTS header's own example is register-free" },
  { label: "the note quotes the record back",
    find: "\" in the record's words (this note does not repeat them)\"", replace: "\" in the record's words (\\\"\"+key+\"…\\\")\"",
    mustFail: "the RETOLD MEMORY note names the moment" },
  { label: "the note forgets the campaign",
    find: "+(q.camp?\" from \"+q.camp:\"\")+\" in the record's words", replace: "+\" in the record's words",
    mustFail: "the RETOLD MEMORY note names the moment" }
]);
prove("helpers.js", ENG, [
  { label: "the sheet report forgets ability names",
    find: "if(ha.length)out.push({name:name,field:\"ability\",words:ha,text:an});", replace: "",
    mustFail: "the sheet report lists ability and item names" }
]);
prove("dev/register-scrub.js", SCRUB, [
  { label: "the scrub walks a quest field that does not exist again",
    find: "(ws.questLog || []).forEach(function (q, i) { if (!q) return; var qp = \"worldState.questLog[\" + i + \"]\";", replace: "(ws.quests || []).forEach(function (q, i) { if (!q) return; var qp = \"worldState.quests[\" + i + \"]\";",
    mustFail: "FAIL #459 ⑤ list walks every record family" },
  { label: "the scrub forgets the archived quests",
    find: "    Object.keys(mem.quests || {}).forEach(function (k) {", replace: "    Object.keys({}).forEach(function (k) {",
    mustFail: "FAIL #459 ⑤ list walks every record family" }
]);
process.exit(code);
