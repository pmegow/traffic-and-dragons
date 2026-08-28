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
    /* #195 bycatch (2026-08-21): both find-targets rotted at #197/v1.665 when the hooks gained
       the !_refusal / !_rrRefusal guards — the clauses reported NOT APPLIED (untested guards)
       until re-pinned to the shipped lines. */
    { label: "commitGmTurn hook removed — untagged phases go unnoticed on the story path",
      find: "  if(!_refusal&&typeof clockPhaseDetect===\"function\")clockPhaseDetect(clean);/* #158: phase-mismatch watcher",
      replace: "  /* hook excised — #158: phase-mismatch watcher" },
    { label: "rerollLast hook removed — replacement narration escapes detection",
      find: "    if(!_rrRefusal&&typeof clockPhaseDetect===\"function\")clockPhaseDetect(clean);/* #158: rerolls REPLACE",
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

/* #216 (v1.700): the [TIME_CHECK:] read-before-write declaration. Single-line finds only —
   multi-line find strings never match CRLF working copies (the 2026-08-22 newline-rot finding). */
rc |= sabotage.prove({
  file: "clock.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "TIME_CHECK gains a clock write — declaration becomes teleportation (#216)",
      mustFail: "#216 the t2175 shape: [TIME_CHECK:sundown] against a midday clock arms",
      find: "  var d=clockPhaseBandDist(idx);",
      replace: "  var d=clockPhaseBandDist(idx);clockAdvance(d);" },
    { label: "the off-band arm dies — sundown-at-midday sails through again (#216)",
      mustFail: "#216 the t2175 shape: [TIME_CHECK:sundown] against a midday clock arms",
      find: "  if(d<PHASE_MISMATCH_MIN)return null;",
      replace: "  return null;" },
    { label: "the band gate dies — every accurate declaration false-alarms (#216)",
      mustFail: "#216 an in-band declaration is silent: no mismatch armed, clock untouc",
      find: "  if(d<PHASE_MISMATCH_MIN)return null;",
      replace: "  if(false)return null;" }
  ]
});

/* #217 (v1.700): schedule near-duplicate dedupe. Single-line finds only. */
rc |= sabotage.prove({
  file: "clock.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the write-time fold dies — re-phrased deadlines file twins again (#217)",
      mustFail: "#217 a re-phrased deadline REFRESHES the existing entry instead of fil",
      find: "      if(scheduleNearDup(lbl,c.schedule[i].label)){",
      replace: "      if(false){" },

    { label: "#235: the write path falls back to the loose futureEvents fingerprint — innkeeper/ferryman fold again",
      mustFail: "distinct deadlines sharing two ordinary tokens file SEPARATELY",
      find: "      if(scheduleNearDup(lbl,c.schedule[i].label)){",
      replace: "      if(feNearDup(lbl,c.schedule[i].label)){" },

    { label: "#235: the sweep falls back to the loose fingerprint — the load sweep folds distinct deadlines",
      mustFail: "the load sweep also refuses the two-token false fold",
      find: "      if(scheduleNearDup(sorted[i].label,kept[j].label)){",
      replace: "      if(feNearDup(sorted[i].label,kept[j].label)){" },

    { label: "#235: the subset clause is dropped — plain restatements at two shared tokens file twins",
      mustFail: "a strict-subset restatement still folds",
      find: "  return shared>=3||(shared>=2&&(aEx===0||bEx===0));",
      replace: "  return shared>=3;" },
    { label: "the sweep keeps oldest instead of freshest-born — the stale seven-day deal wins (#217)",
      mustFail: "#217 the load sweep collapses the live triple to the freshest-born ent",
      find: "  var sorted=c.schedule.slice().sort(function(a,b){return (b.born||0)-(a.born||0);});",
      replace: "  var sorted=c.schedule.slice().sort(function(a,b){return (a.born||0)-(b.born||0);});" },
    { label: "#270: the dawn-seam rule dies — night at 8am is adjacency again (the t2175 blind window)",
      mustFail: "night assertion at 8am ARMS",
      find: "  var back=(off>=ph.b1)?(off-(ph.b1-1)):MIN_PER_DAY;",
      replace: "  var back=(off-(ph.b1-1)+MIN_PER_DAY)%MIN_PER_DAY;" },

    { label: "#270: the post-band grace dies — 31 minutes of slop arms the sleep-teaching demand note again",
      mustFail: "post-band slop reconciles to SILENCE",
      find: "  if(ph.tgt<off&&(off-ph.b1)>=0&&(off-ph.b1)<RECONCILE_GRACE_MIN){",
      replace: "  if(false){" },

    { label: "#270: the possessive-genitive reject dies — 'the dusk of her years' moves the mismatch machinery again",
      mustFail: "no longer asserts a time of day",
      find: "|\\b(?:dawn|morning|noon|midday|afternoon|dusk|evening|night|midnight)\\s+of\\s+(?:my|your|his|her|its|our|their)\\b)/i;",
      replace: ")/i;" },

    { label: "the sweep stops archiving pre-images — removals become unrecoverable (#217)",
      mustFail: "#217 the load sweep collapses the live triple to the freshest-born ent",
      find: "  c.repairs.push({id:\"217-schedule-dedupe\",removed:removed,t:(typeof worldState!==\"undefined\"&&worldState&&worldState.turn)||0});",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#235: the fold-honesty muts line dies — a fold silently pairs the kept label with the new countdown again",
      mustFail: "muts line is honest about a fold",
      find: "var _sf=scheduleAdd._lastFold;if(_sf&&_sf.from&&String(_sf.from).toLowerCase()!==String(ev.label).toLowerCase())",
      replace: "var _sf=null;if(_sf)" },

    { label: "#270: the resolve-count honesty dies — a multi-deadline substring retirement admits to one again",
      mustFail: "matches TWO deadlines says so",
      find: "var _srN=scheduleRemove(m[1]);if(_srN===1)R.muts.push(\"Event resolved: \"+m[1].trim());else if(_srN>1){",
      replace: "var _srN=scheduleRemove(m[1]);if(_srN>=1)R.muts.push(\"Event resolved: \"+m[1].trim());else if(false){" }
  ]
});

process.exit(rc ? 1 : 0);
