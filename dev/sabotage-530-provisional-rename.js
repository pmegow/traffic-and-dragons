// dev/sabotage-530-provisional-rename.js — proves the #530 guards are guarded. The name-collision note (#156) offers two
// answers; with scene tracking on, "a DIFFERENT person" — [MERGE:npc|<Their Proper Name>|<provisional>] — was stripped as a
// merge proposal and then discarded because the new name is on no record, so it never landed. A provisional may now take a
// name nobody holds; every other merge stays a proposal first. Each mutation runs in a disposable clone.
//   node dev/sabotage-530-provisional-rename.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#530"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#530 the repro", NARROW = "the gate is not widened", FREE = "the provisional's own alias is a free name";
prove("identity.js", [
  { label: "the different-person answer is a proposal again (the reported drop)",
    find: 'if(m&&m.provisional&&w2NameIsFree(canonical,duplicate))return true;', replace: '',
    mustFail: REPRO },
  { label: "any record may take a new name without confirmation",
    find: 'if(m&&m.provisional&&w2NameIsFree(canonical,duplicate))return true;', replace: 'if(m&&w2NameIsFree(canonical,duplicate))return true;',
    mustFail: NARROW },
  { label: "a name that is an established record counts as free",
    find: 'if(memory.npcs[name]||(typeof wsNpcByName==="function"&&wsNpcByName(name)))return false;', replace: '',
    mustFail: NARROW },
  { label: "the player's name counts as free",
    find: 'if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(name))return false;', replace: '',
    mustFail: NARROW },
  { label: "a name that resolves to someone else (their alias) counts as free",
    find: 'var c=resolveNpcName(name);return c===name||c===duplicate;', replace: 'var c=resolveNpcName(name);return true;',
    mustFail: FREE },
  { label: "the provisional's own alias is refused",
    find: 'var c=resolveNpcName(name);return c===name||c===duplicate;', replace: 'var c=resolveNpcName(name);return c===name;',
    mustFail: FREE }
]);
process.exit(code ? 1 : 0);
