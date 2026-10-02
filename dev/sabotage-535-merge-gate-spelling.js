// dev/sabotage-535-merge-gate-spelling.js — proves the #535 guards are guarded. The parser (_identityActionTag) trims and
// lower-cases a [MERGE:<domain>|a|b] tag's domain; the W2 merge gate matched the exact spelling "MERGE:npc|" only, so
// [MERGE:NPC|a|b] and [MERGE: npc |a|b] reached the handler unseen and fused two established people with no confirmation.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-535-merge-gate-spelling.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#535"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#535 the repro", OTHER = "#535 a confirmed merge still lands under any spelling";
prove("identity.js", [
  { label: "the gate is case-exact again ([MERGE:NPC|…] passes unseen)",
    find: "var gen=ordinary.match(/\\[MERGE:\\s*[nN][pP][cC]\\s*\\|", replace: "var gen=ordinary.match(/\\[MERGE:\\s*npc\\s*\\|",
    mustFail: REPRO },
  { label: "the gate is spacing-exact again ([MERGE: npc |…] passes unseen)",
    find: "var gen=ordinary.match(/\\[MERGE:\\s*[nN][pP][cC]\\s*\\|", replace: "var gen=ordinary.match(/\\[MERGE:[nN][pP][cC]\\|",
    mustFail: REPRO },
  { label: "the whole tag is read in any case (a lower-case tag no handler reads is queued as a proposal)",
    find: "|([^\\]]+)\\]/g)||[];for(mi=0;mi<gen.length;mi++){var gp=gen[mi].match(/\\[MERGE:\\s*[nN][pP][cC]\\s*\\|([^|\\]]+)\\|([^\\]]+)\\]/)", replace: "|([^\\]]+)\\]/gi)||[];for(mi=0;mi<gen.length;mi++){var gp=gen[mi].match(/\\[MERGE:\\s*[nN][pP][cC]\\s*\\|([^|\\]]+)\\|([^\\]]+)\\]/i)",
    mustFail: OTHER }
]);
process.exit(code ? 1 : 0);
