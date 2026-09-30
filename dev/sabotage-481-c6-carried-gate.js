// dev/sabotage-481-c6-carried-gate.js — proves the #481 C6 guards are guarded: ONE gate (carriedHeldNow) holds the carried
// record in a small-talk kind until the hero raises the past, both the splice and the note ask it, the Hall and the
// adventure are never held, and the gate reads the named residents' names and records. Each mutation runs in a clone.
//   node dev/sabotage-481-c6-carried-gate.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C6"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "the splice ignores the gate (the purchase serves the record)",
    find: "var carriedRagBlock=(typeof ragCarriedRetrieve===\"function\"&&!(typeof carriedHeldNow===\"function\"&&carriedHeldNow(_cAct)))?", replace: "var carriedRagBlock=(typeof ragCarriedRetrieve===\"function\")?",
    mustFail: "buying cakes from Nyla serves neither" },
  { label: "the note ignores the gate",
    find: "  if(typeof carriedHeldNow===\"function\"&&carriedHeldNow(act))return \"\";/* #481 C6: the ONE gate the splice asks */\n", replace: "",
    mustFail: "buying cakes from Nyla serves neither" }
]);
prove("helpers.js", [
  { label: "the gate never holds",
    find: "  if(typeof kindDef!==\"function\"||!kindDef().smallTalk||typeof worldState===\"undefined\"||!worldState||!worldState.character)return false;\n  if(_standingInHall())return false;\n  var act=",
    replace: "  return false;\n  var act=",
    mustFail: "buying cakes from Nyla serves neither" },
  { label: "an adventure is held too (the kind check is gone)",
    find: "  if(typeof kindDef!==\"function\"||!kindDef().smallTalk||typeof worldState===\"undefined\"", replace: "  if(typeof kindDef!==\"function\"||typeof worldState===\"undefined\"",
    mustFail: "the adventure is unchanged" },
  { label: "the Hall holds the record too",
    find: "  if(_standingInHall())return false;\n  var act=", replace: "  var act=",
    mustFail: "the Hall serves the record unasked" },
  { label: "the gate forgets the named residents' records",
    find: "for(i=0;i<pool.length;i++)if(named.indexOf(pool[i].who)>=0)prior.push({who:pool[i].who,text:pool[i].text});", replace: "",
    mustFail: "a word from the named resident's own record" },
  { label: "the gate forgets the named residents' names",
    find: "  names=names.concat(named);\n", replace: "",
    mustFail: "buying cakes from Nyla serves neither" },
  { label: "how people met is no longer the past (the owner's t92 question is held)",
    find: "|first met|how (did |do )?(you|they|he|she|we)( two| both| all)? (first )?(meet|met))\\b/i;", replace: ")\\b/i;",
    mustFail: "buying cakes from Nyla serves neither" }
]);
process.exit(code);
