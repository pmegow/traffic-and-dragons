// dev/sabotage-526-guard-report.js — proves the #526 guard: a W2 or summary-identity refusal in summarize() is the guard
// working (console + drift-health line), reported only once it quarantines the window (the third strike); every other
// extraction failure reports at once. Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-526-guard-report.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#168 W2"]], cases: cases }); }
prove("memory.js", [
  { label: "a guard refusal is mailed as a crash again",
    find: "  var guard=!!(e&&(e.w2Identity||e.summaryIdentity));\n  return !guard||(strikes|0)>=3;", replace: "  return true;",
    mustFail: "#526 a W2 death refusal" },
  { label: "the quarantining third strike is never reported",
    find: "  return !guard||(strikes|0)>=3;", replace: "  return !guard;",
    mustFail: "#526 a W2 death refusal" },
  { label: "an ordinary extraction failure is swallowed with the guard's",
    find: "  return !guard||(strikes|0)>=3;", replace: "  return (strikes|0)>=3;",
    mustFail: "#526 a W2 death refusal" },
  { label: "summarize's catch reports past the gate",
    find: "    if(summaryFailureReportWanted(e,_sumFails)&&typeof reportError===\"function\")reportError(\"summarize\",_eMsg,_dbg+\"\\n\"+_eStk);", replace: "    if(typeof reportError===\"function\")reportError(\"summarize\",_eMsg,_dbg+\"\\n\"+_eStk);",
    mustFail: "#526 a W2 death refusal" }
]);
process.exit(code);
