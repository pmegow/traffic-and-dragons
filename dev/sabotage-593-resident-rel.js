// dev/sabotage-593-resident-rel.js — proves #593 is guarded: a Village resident's colder standing is staged until the GM writes it
// again on a later response. The kind flag, the vocabulary, the handler's ask, the duplicate and moved-preimage checks, the
// different-proposal refusal, the expiry and the taught note are each mutated back toward a free write.
//   node dev/sabotage-593-resident-rel.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#593"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var ROW = "#593";
prove("tag_table.js", [
  { label: "the handler lands every relation without asking (the resident guard is bypassed)",
    find: "if(npRel&&residentRelWrite(_npN,npRel,R))_npN.rel=npRel;", replace: "if(npRel)_npN.rel=npRel;",
    mustFail: ROW }
]);
prove("data.js", [
  { label: "the village kind no longer asks for confirmation",
    find: "    residentRelConfirm:true,", replace: "    residentRelConfirm:false,",
    mustFail: ROW },
  { label: "the village stops teaching the rule",
    find: "THE VILLAGE — A RESIDENT'S STANDING: a resident's relation", replace: "THE VILLAGE: a resident's relation",
    mustFail: ROW }
]);
prove("helpers.js", [
  { label: "every word is in good standing (every write lands)",
    find: "function residentRelGood(rel){return RESIDENT_REL_GOOD_RE.test(String(rel||\"\"));}", replace: "function residentRelGood(rel){return true;}",
    mustFail: ROW },
  { label: "a same-response duplicate confirms",
    find: "if(p.turn>=turn){", replace: "if(p.turn>turn){",
    mustFail: ROW },
  { label: "a moved preimage confirms anyway",
    find: "if(p.prev!==prev){q.splice(q.indexOf(p),1);", replace: "if(false){q.splice(q.indexOf(p),1);",
    mustFail: ROW },
  { label: "a different colder proposal confirms the first",
    find: "if(p.next.toLowerCase()!==next.toLowerCase()){if(R&&R.muts)R.muts.push(", replace: "if(false){if(R&&R.muts)R.muts.push(",
    mustFail: ROW },
  { label: "a proposal never expires",
    find: "if(turn-q[i].turn>=RESIDENT_REL_EXPIRE_TURNS){", replace: "if(false){",
    mustFail: ROW },
  { label: "a warmer word leaves the stale colder proposal waiting",
    find: "var old=residentRelPending(npc.name);if(old){", replace: "var old=null;if(old){",
    mustFail: ROW }
]);
process.exit(code);
