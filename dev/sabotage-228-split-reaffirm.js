// sabotage-228-split-reaffirm.js — mutation proof for the #228 re-affirm no-op.
//
// The guard being proven: an identical [PARTY_SPLIT:] re-affirm of an already-stamped split must
// change NOTHING. Field origin t2320-t2324 (the live Ammut save): buildSplitAudit's same-world
// waiver made a split at the party's OWN node due every turn, the note asked the GM to re-affirm,
// and the re-affirm re-minted splitLoc — destroying the .audited cooldown, so the audit fired
// again next turn. A closed loop with the engine on both ends, each pass stamping a phantom
// guestbook arrival and re-witnessing #194 presence evidence for characters standing still.
//
// Each clause must make dev/run-tests.js FAIL. A mutation that changes no bytes is a hard failure
// (see sabotage.js) — a clause guarding nothing is worse than no clause at all.
// Usage: node dev/sabotage-228-split-reaffirm.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the no-op branch never fires — the t2320 audit/re-affirm loop returns in full",
      mustFail: "an identical re-affirm is a NO-OP",
      find: "if(psWas&&psWas.turn!=null&&!psToastWorthy){",
      replace: "if(false){" },

    { label: "_freshSplits dropped from the no-op — ruling B breaks, #133b dissolves \"stay here\" on the next response",
      mustFail: "ruling B preserved",
      find: "    R._freshSplits[psName]=1;/* ruling B: the stay-behind keeps its #133b grace */",
      replace: "" },

    { label: "the turn!=null guard dropped — a LEGACY unstamped split no-ops and can never become fresh, auditing forever",
      mustFail: "CHANGES the record still writes",
      find: "if(psWas&&psWas.turn!=null&&!psToastWorthy){",
      replace: "if(psWas&&!psToastWorthy){" },

    { label: "sublocation dropped from the sameness test — the audit's own \"include the SUBLOCATION\" ask would no-op",
      mustFail: "CHANGES the record still writes",
      find: "if(psWas&&psWas.turn!=null&&!psToastWorthy){",
      replace: "if(psWas&&psWas.turn!=null&&psWas.location===psArg){" }
  ]
});

process.exit(rc ? 1 : 0);
