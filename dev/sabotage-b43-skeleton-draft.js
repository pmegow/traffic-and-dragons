// dev/sabotage-b43-skeleton-draft.js — proves the B43 guards are guarded (the owner's Frizwick campaign, 2026-10-12: one Gemini
// skeleton draft ended inside an array at ~4.3 KB with no cap hit; generateSkeleton parsed it bare and the campaign began
// freeform, spineless for good). The rules mutated back: the finish classifier calls every stop normal; callGM stops handing
// the finish back; the draft parser ignores a cut candidate; the one re-ask is removed; the re-ask stops sending the draft
// back; the second failure loses its evidence; the Begin reporter drops the evidence.
//   node dev/sabotage-b43-skeleton-draft.js
var sabotage = require("./sabotage.js");
var ENGINE = ["node", ["dev/run-tests.js", "#132 — output-truncation detection"]], ASYNC = ["node", ["dev/tests-459-register-gate.js"]];
var T1 = "B43: finishInfo classifies", T2 = "B43: the skeleton draft is parsed";
var code = 0;
code |= sabotage.prove({ file: "globals.js", command: ENGINE, cases: [
  { label: "every stop is normal: a RECITATION finish is no longer a cut",
    find: "return {reason:reason,cap:cap,cut:cap||!!(reason&&normal.indexOf(reason)<0)};}", replace: "return {reason:reason,cap:cap,cut:cap};}",
    mustFail: T1 }
  /* "the cap alone" is not a provable clause: every provider's cap word sits outside its finishNormal set, so dropping the
     `cap||` term changes no outcome — the term is belt-and-braces for a future entry that misfiles its cap word. */
] });
code |= sabotage.prove({ file: "api.js", command: ENGINE, cases: [
  { label: "callGM keeps the finish to itself (no opts.finish)",
    find: "  if(opts&&typeof opts===\"object\")opts.finish=_fi;\n", replace: "",
    mustFail: T1 },
  { label: "an early stop leaves no crumb",
    find: "    if(typeof erCrumb===\"function\")erCrumb(\"response-cut\",{p:prov.id,f:_fi.reason,k:_kind});\n", replace: "",
    mustFail: T1 }
] });
code |= sabotage.prove({ file: "campaign_generator.js", command: ENGINE, cases: [
  { label: "a cut candidate whose text parses is accepted",
    find: "  if(finish&&finish.cut)return {error:\"the response ended early (finish: \"+finish.reason+\")\",evidence:skeletonDraftEvidence(raw,finish,\"\")};\n", replace: "",
    mustFail: T2 },
  { label: "the re-ask no longer sends the draft back",
    find: "Here it is, exactly as received:\\n\"+String(draft||\"\")+\"\\n\\nReturn", replace: "\\n\\nReturn",
    mustFail: T2 },
  { label: "the evidence loses the tail",
    find: "tail:s.slice(-200),", replace: "tail:\"\",",
    mustFail: T2 }
] });
code |= sabotage.prove({ file: "game.js", command: ASYNC, cases: [
  { label: "the one re-ask is removed: an unusable first draft throws at once",
    find: "  if(!skel){\n    if(typeof console!==\"undefined\")console.warn(\"[skeleton] the first draft is unusable", replace: "  if(!skel)throw new Error(\"skeleton JSON unusable: \"+_d.error);\n  if(false){\n    if(typeof console!==\"undefined\")console.warn(\"[skeleton] the first draft is unusable",
    mustFail: "B43 ① a broken first draft" },
  { label: "the second failure loses its evidence",
    find: "_e2.skeletonEvidence=[_d.evidence,_d2.evidence];throw _e2;}", replace: "throw _e2;}",
    mustFail: "B43 ③ two unusable drafts" },
  { label: "the skeleton calls send the whole history again",
    find: "  var _o={kind:\"skeleton\",noHistory:true},resp=", replace: "  var _o={kind:\"skeleton\"},resp=",
    mustFail: "B43 ① a broken first draft" }
] });
code |= sabotage.prove({ file: "game.js", command: ENGINE, cases: [
  { label: "the Begin reporter drops the drafts' evidence",
    find: "+(e&&e.skeletonEvidence?\"\\n--- B43 drafts ---\\n\"+skeletonEvidenceText(e.skeletonEvidence):\"\")", replace: "",
    mustFail: T2 }
] });
process.exit(code);
