// dev/sabotage-593-resident-rel.js — proves #593 is guarded: a Village resident's colder standing is staged until the GM writes it
// again on a later response. The kind flag, the vocabulary, the handler's ask, the duplicate and moved-preimage checks, the
// different-proposal refusal, the expiry and the taught note are each mutated back toward a free write. #614 adds the merge: the
// resident mark and the library stamp through the record fold, and the waiting proposal handed to the survivor.
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
// #614 (owner ruling 2026-10-12): a merge keeps the resident. The NPC_MERGE record fold carries the mark (OR of both records) and the
// library stamp with the sheet it stamps; the merge hands a waiting proposal to the survivor (staging turn kept), and when the survivor
// has one of its own the duplicate's is dropped with the glyph. Proved under the #614 section's own filter.
var CMD614 = ["node", ["dev/run-tests.js", "#614"]];
function prove614(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD614, cases: cases }); }
var ROW614 = "#614";
prove614("tag_table.js", [
  { label: "#614 the record fold drops the resident mark (a merged or renamed resident becomes a visitor)",
    find: "if(_mgDupN.resident&&!_mgCanN.resident){_mgCanN.resident=true;", replace: "if(false){_mgCanN.resident=true;",
    mustFail: ROW614 },
  { label: "#614 the residency moves in silence (the merge summary does not say it)",
    find: "R.muts.push(\"Resident carried: \"+mgDupe+\" -> \"+mgCanon);", replace: "",
    mustFail: ROW614 },
  { label: "#614 the adopted sheet arrives without its library stamp",
    find: "if(_mgDupN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet&&_mgDupN.libraryAt!==undefined)_mgCanN.libraryAt=_mgDupN.libraryAt;", replace: "",
    mustFail: ROW614 },
  { label: "#614 the duplicate's stamp is taken even when the survivor keeps its own sheet",
    find: "_mgCanN.charSheet===_mgDupN.charSheet&&_mgDupN.libraryAt!==undefined", replace: "_mgDupN.libraryAt!==undefined",
    mustFail: ROW614 },
  { label: "#614 the merge leaves a waiting proposal under the dead name",
    find: "residentRelRekey(mgCanon,mgDupe,R);", replace: "",
    mustFail: ROW614 }
]);
prove614("helpers.js", [
  { label: "#614 the re-key restamps the staging turn (a later response's repeat reads as a same-response duplicate)",
    find: "p.name=canonical;", replace: "p.name=canonical;p.turn=(R&&typeof R.turn===\"number\")?R.turn:p.turn;",
    mustFail: ROW614 },
  { label: "#614 the re-key is silent",
    find: "R.muts.push(\"Resident relation proposal re-keyed: \"", replace: "void(\"Resident relation proposal re-keyed: \"",
    mustFail: ROW614 },
  { label: "#614 the duplicate's proposal joins the survivor's (two proposals under one name)",
    find: "if(residentRelPending(canonical)){", replace: "if(false){",
    mustFail: ROW614 },
  { label: "#614 the dropped proposal's receipt loses the glyph",
    find: "R.muts.push(\"⚠ Resident relation proposal DROPPED (merged into \"", replace: "R.muts.push(\"Resident relation proposal DROPPED (merged into \"",
    mustFail: ROW614 }
]);
process.exit(code);
