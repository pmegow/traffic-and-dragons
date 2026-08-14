// sabotage-phase.js — prove the #158 phase-mismatch detector's guards actually guard.
// Each case breaks one clause of the recognition contract or a wiring seam; the suite must go
// red on every one, and every mutation must change real bytes. Defense-in-depth is deliberate
// here (parity / residual-quote / blank-run overlap), so each clause has a test case that fails
// when IT ALONE is removed — a masked sabotage would be fake coverage.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "clock.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "\\b anchoring dropped — 'Morningstar'/'knight' match again", mustFail:"prose forms are \\b-anchored derivations of TIME_PHASES",
      find: "out.push(new RegExp(\"\\\\b(?:\"+TIME_PHASES[i].re.source+\")\\\\b\",\"gi\"));",
      replace: "out.push(new RegExp(\"(?:\"+TIME_PHASES[i].re.source+\")\",\"gi\"));" },
    { label: "any-quote-in-sentence rule removed — a quoted phase with no speech verb leaks", mustFail:"rejections: quoted dialogue, plans, history, figurative, negation, vis",
      find: "    if(/[\"“”]/.test(sent))continue;",
      replace: "" },
    { label: "rejection list gutted — plans/history/figurative all assert", mustFail:"rejections: quoted dialogue, plans, history, figurative, negation, vis",
      find: "if(_PHASE_REJECT_RE.test(sent))continue;",
      replace: "" },
    { label: "quote-parity guard removed — a stray quote no longer distrusts the entry", mustFail:"rejections: quoted dialogue, plans, history, figurative, negation, vis",
      find: "  var _sq=(s.match(/\"/g)||[]).length;\n  if(_sq%2)return null;",
      replace: "" },
    { label: "last-cue selection becomes first-cue — narrative recency lost", mustFail:"recognition positives: current-phase narration parses; the LAST qualif",
      find: "if(!best||g>best.at)best={at:g,idx:claimed[i].idx,label:claimed[i].label};",
      replace: "if(!best)best={at:g,idx:claimed[i].idx,label:claimed[i].label};" },
    { label: "band distance degrades to always-far — in-band agreement stops silencing (the DETECTOR's copy, not the reconcile's)", mustFail:"band distance: in-band = 0, the t1605 case alerts, adjacent-phase slop",
      find: "  if(off>=ph.b0&&off<ph.b1)return 0;\n  var fwd=(ph.b0-off+MIN_PER_DAY)%MIN_PER_DAY;",
      replace: "  var fwd=(ph.b0-off+MIN_PER_DAY)%MIN_PER_DAY;" },
    { label: "this/that reference guard removed — 'this afternoon' asserts", mustFail:"rejections: quoted dialogue, plans, history, figurative, negation, vis",
      find: "if(/\\b(?:this|that)\\s+$/i.test(sent.slice(Math.max(0,st-8),st)))continue;",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "commitGmTurn hook removed — untagged phases go unnoticed on the story path",
      find: "  if(typeof clockPhaseDetect===\"function\")clockPhaseDetect(clean);/* #158: phase-mismatch watcher",
      replace: "  /* hook excised — #158: phase-mismatch watcher" },
    { label: "rerollLast hook removed — replacement narration escapes detection",
      find: "    if(typeof clockPhaseDetect===\"function\")clockPhaseDetect(clean);/* #158: rerolls REPLACE",
      replace: "    /* hook excised — #158: rerolls REPLACE" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "stale-agreement discard removed — a healed clock still gets nagged", mustFail:"buildPhaseMismatchNudge: one-shot with the amended phrasing, combat-si",
      find: "  if(typeof clockPhaseBandDist===\"function\"&&clockPhaseBandDist(q.idx)<PHASE_MISMATCH_MIN){delete worldState.phaseMismatch;return\"\";}",
      replace: "" }
  ]
});

process.exit(rc ? 1 : 0);
