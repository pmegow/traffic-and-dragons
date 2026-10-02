// dev/sabotage-530-provisional-rename.js — proves the #530 guards are guarded. The name-collision note (#156) offers two
// answers; with scene tracking on, "a DIFFERENT person" — [MERGE:npc|<Their Proper Name>|<provisional>] — was stripped as a
// merge proposal and then discarded because the new name is on no record, so it never landed. A provisional may now take a
// name nobody holds; every other merge stays a proposal first. Re-anchored by #534, which made the reading of the canonical
// operand one function (npcMergeTarget) shared by the gate and the handler. Each mutation runs in a disposable clone.
//   node dev/sabotage-530-provisional-rename.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#530"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#530 the repro", NARROW = "the gate is not widened", FREE = "the provisional's own alias is a free name";
prove("identity.js", [
  { label: "the different-person answer is a proposal again (the reported drop)",
    find: 'if(t.how==="same"||t.how==="new")return {allow:true};', replace: 'if(t.how==="same")return {allow:true};',
    mustFail: REPRO },
  { label: "any record may take a new name without confirmation",
    find: 'if(!p)return {key:canonical,how:"plain"};', replace: 'if(!p)return {key:canonical,how:"new"};',
    mustFail: NARROW },
  { label: "a provisional folds into another established person without confirmation",
    find: 'return c!==of?{key:c,how:"other"}:{key:of,how:"same"};', replace: 'return {key:of,how:"same"};',
    mustFail: NARROW },
  { label: "the player's name counts as free",
    find: '  if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(canonical))return {key:canonical,how:"player"};\n', replace: '',
    mustFail: NARROW },
  { label: "a name that resolves to someone else (their alias) counts as free",
    find: 'if(memory.npcs[c]||(typeof wsNpcByName==="function"&&wsNpcByName(c))){', replace: 'if(false){',
    mustFail: FREE },
  { label: "the provisional's own alias is refused",
    find: '  if(c===duplicate)return {key:canonical,how:"new"};', replace: '  if(false)return {key:canonical,how:"new"};',
    mustFail: FREE }
]);
process.exit(code ? 1 : 0);
