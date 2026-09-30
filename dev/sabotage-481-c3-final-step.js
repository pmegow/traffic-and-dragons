// dev/sabotage-481-c3-final-step.js — proves the #481 C3 guard: a final objective ticked in the SAME reply that completes the
// quest lands on the archived record. Fable's named clause (as proposed): ignore R.questsClosed. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-481-c3-final-step.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "tag_table.js", command: ["node", ["dev/run-tests.js", "#481 C3"]], cases: [
  { label: "ignore R.questsClosed (Fable's named clause): the final tick is refused again with a false alarm",
    find: "   if(_qsArch&&qsDone&&R.questsClosed&&R.questsClosed[qsTitle.toLowerCase()]){", replace: "   if(false){",
    mustFail: "a final objective ticked in the SAME reply" },
  { label: "the QUEST handler forgets what it closed",
    find: "    (R.questsClosed=R.questsClosed||{})[String(qTitle).toLowerCase()]=true;", replace: "",
    mustFail: "a final objective ticked in the SAME reply" },
  { label: "a NEW objective in the closing reply is recorded on the archive",
    find: "     if(_qso){_qso.done=true;R.muts.push(qsTitle+\" ✓ \"+qsObj);continue;}}", replace: "     if(!_qso){_qso={text:qsObj,done:true};_qsArch.objectives=(_qsArch.objectives||[]).concat([_qso]);}_qso.done=true;R.muts.push(qsTitle+\" ✓ \"+qsObj);continue;}",
    mustFail: "a step on a quest closed at an EARLIER reply still refuses" }
]}));
