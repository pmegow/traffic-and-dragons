// sabotage-contract-tier.js — retained mutation proofs for the run-tests.js SOURCE CONTRACTS
// that had none (#275, Fable f74). Run: node dev/sabotage-contract-tier.js
//
// WHY THIS FILE EXISTS
// -------------------
// dev/run-tests.js carries ~34 build-blocking source contracts. They are pattern scans over
// shipped source, and several are ABSENCE patterns ("this bad spelling must not return") — the
// exact fake-coverage class dev/sabotage.js was built to kill on 2026-07-29. A tier of them was
// mutation-checked once at authoring time and the proofs were thrown away (or, for the oldest TTS
// contracts, v1.419–v1.434, predates the sabotage-proof rule entirely). Nothing could re-verify
// them after a refactor. This battery is the retained record.
//
// THE GATE: `node dev/run-tests.js repairModelJson`.
// Source contracts run at the TOP of run-tests.js, unconditionally, BEFORE the engine suite and
// independent of the section filter — so a filtered run exercises every contract in this file
// while executing only one tiny engine section (198ms vs 11s). run-tests.js sanctions exactly
// this shape ("Filtered sabotage runs skip this layer: their named section must remain the only
// possible attribution source", :1836), and the narrow filter is a FEATURE here: it removes the
// engine suite as a rival source of red, so every `mustFail` names the contract itself.
// "repairModelJson" is a real section (engine-tests.js:48); if it is ever renamed, every clause
// here reddens loudly with FILTER … matched 0 sections rather than passing silently.
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// CENSUS — dev/run-tests.js source contracts × retained sabotage coverage (2026-08-28, v1.729)
// Method: dev/check-sabotage-applicability.js collect() over all 43 pre-existing sabotage-*.js
// batteries (563 clauses), each clause's `mustFail` matched back to the run-tests.js line that
// emits it. 34 contract sections, 13 proven, 21 unproven. f74's own census is superseded: #92
// SYNC COMPRESSION and #144A ARCHIVE CARRY were closed after it was written (sabotage-252-*),
// and the TABLE TALK count is 15 clauses / 2 proven, as f74's verifier corrected.
// Do not re-derive this by hand — re-run the cross-reference.
//
//   PROVEN BEFORE THIS FILE (13)
//     #144A ARCHIVE CARRY .............. sabotage-252-archive-carry.js, sabotage-jp0-5-archive-registry.js
//     JP0-4 CORRUPT-STORE RESCUE ....... sabotage-jp0-4-store-rescue.js
//     BIBLE EDITOR ..................... sabotage-bible-editor-toolbar.js
//     CAP VALIDATOR .................... sabotage-cap-category.js
//     BIB PICKER ....................... sabotage-bib-filter.js, sabotage-cap-snapshot.js
//     FEAT MOVE / CAP EDIT ............. sabotage-bible-editor-remaining.js, -upsert.js
//     #92 SYNC COMPRESSION ............. sabotage-252-sync-compression.js
//     APPEARANCE WRITE ................. sabotage-appearance-remaining.js
//     SERVER TTS TIER .................. sabotage-server-tts.js
//     BUG TRACKER SATELLITE ............ sabotage-251-bug-tracker.js
//     #17/P2-03 GROWTH TELEMETRY ....... sabotage-253-growth-telemetry.js
//     BLUEPRINT DESIGNER ............... sabotage-blueprint-classes.js (5 clauses, exit-status
//                                        only — no mustFail pin; see the residue note below)
//     PERFORMANCE BENCH LOADER/LABEL ... sabotage-bench-loaders.js (its mustFail carries the
//                                        file name the contract CONCATENATES, so a literal
//                                        cross-reference misses it — attribution verified by hand)
//     #76 TABLE TALK ISOLATION ......... 2 of 15 _ttReq clauses only (the #28 logPlayer pair in
//                                        sabotage-drift-hardening.js) — 13 unproven, closed here
//
//   UNPROVEN → CLOSED BY THIS FILE (20 contracts, 79 running clauses, all caught + attributed)
//     VENDOR PATCH preamble (4) · NARRATION-PERSON #172 (2) · TRANSCRIPT SEAM #177 (2) ·
//     VOICE-DELETION v1.419 (6) · #151 LATCH REGISTRY (3) · STARS PORTABILITY (4) +
//     DEFAULT BENCH #95.6 (1) · #158 PHASE-DETECTOR WIRING (3) · VOICE LAB (5) ·
//     AUDIO RECOVERY v1.421 (4) · RESPAWN ORDERING v1.424 (3) · PLAYBACK RECYCLE v1.430 (2) ·
//     UNLOAD STAMP v1.432 (1) · WORK-BUDGET GOVERNOR v1.434 (2) · INJECTION SINK (4, incl. the
//     escHtml behavioural half) · BIBLE-SERVER WRITE-AUTH (3) · ENGINE MANIFEST (4) ·
//     #14 PENDING ACTION (4) · #113 STT UPGRADES (6) · #77 CONFIRM GATE (3) ·
//     #76 TABLE TALK ISOLATION (13 — every previously unproven _ttReq clause)
//
//   ⚠ FINDING — INERT CONTRACT, NOT REPAIRED HERE (1)
//     REFUSAL COPY CONTRACT (#213, run-tests.js:103-139) reports through `process.exitCode = 1`
//     (its four sites are the only ones in the file), and run-tests.js:1852 ends with an
//     unconditional `process.exit(0)` that DISCARDS process.exitCode. Measured: rename
//     W2_REFUSAL_REASONS in identity.js → the contract prints its failure and `node
//     dev/run-tests.js` exits 0. So a drift-surface guard over the shipped-refusal vocabulary
//     cannot fail CI or the pre-commit hook. Its two clauses sit skip-flagged below (the
//     applicability scan still keeps their find targets fresh); the one-character repair is
//     Fable's call, not this lane's — see todo_checkWithFable.md ▸ "#275 retained proofs".
//
//   DELIBERATELY NOT PROVEN HERE (recorded, not skipped)
//     TRANSCRIPT SEAM clause ①, the "scan regex catches its own violation fixture" self-check:
//       it is an INLINE self-sabotage fixture (run-tests.js:153) — the contract proves its own
//       non-vacuity on every build, which is the pattern f74 asks the others to adopt. Mutating
//       it would mean mutating run-tests.js, which is the harness, not a guarded source file.
//     BLUEPRINT DESIGNER: covered by sabotage-blueprint-classes.js, but with NO mustFail on any
//       of its 9 clauses — an exit-status-only verdict cannot tell a real catch from an unrelated
//       red (the #170 lesson). Adding pins there is a change to an existing battery and is filed
//       as residue in todo_checkWithFable.md rather than done silently in this lane.
//
//   VACUITY SCAN: every running clause CHANGED BYTES (sabotage.js treats a no-op mutation as a
//   hard failure) and reddened its OWN contract's message, so no contract in the closed set is
//   vacuous against current source. Three clauses needed a second draft, and the reason is the
//   fake-coverage class itself: a rename whose replacement still CONTAINS the scanned literal
//   ("tndRecycleSessionGONE", "_stuckCtxRETIRED") does not disturb an indexOf guard at all.
//   Those two, plus one call site that turned out to sit outside the censused function slice,
//   are annotated inline so the next author does not re-learn them.
// ────────────────────────────────────────────────────────────────────────────────────────────

var sabotage = require("./sabotage.js");
var rc = 0;

/* The gate. See the header for why it is filtered. */
var GATE = ["node", ["dev/run-tests.js", "repairModelJson"]];

/* ═══ game.js ═══════════════════════════════════════════════════════════════════════════════
   Seven contracts read game.js. They run in run-tests.js line order, and each exits on its
   first failure, so every clause below carries a mustFail naming its own contract — a mutation
   that trips an EARLIER game.js contract would report MISATTRIBUTED rather than pass. */
rc |= sabotage.prove({
  file: "game.js",
  command: GATE,
  cases: [
    /* ── NARRATION-PERSON RETIREMENT CONTRACT (#172, run-tests.js:77) ── */
    {
      label: "#172 the mpEnded correction is retired on a TURN COUNT again (the field bug)",
      mustFail: "game.js retires worldState.mpEnded on a TURN COUNT again",
      find: "  if(!_refusal&&typeof personDriftDetect===\"function\")personDriftDetect(clean,_bookkeeping);",
      replace: "  if(worldState.mpEnded&&(worldState.turn-worldState.mpEnded.turn)>=3)delete worldState.mpEnded;\n  if(!_refusal&&typeof personDriftDetect===\"function\")personDriftDetect(clean,_bookkeeping);"
    },
    {
      label: "#172 the narration-person watcher is unwired at both seams",
      mustFail: "nothing calls personDriftDetect",
      find: /personDriftDetect\(clean/g,
      replace: "personDriftDetectUNWIRED(clean"
    },

    /* ── #151 LATCH REGISTRY CONTRACT (run-tests.js:392) ── */
    {
      label: "#151 the latch snapshot is taken AFTER the builders have stamped",
      mustFail: "sendAction no longer snapshots BEFORE buildEngineNotes",
      find: "{var _latchSnap=snapshotNoteLatches();",
      replace: "{var _enEarly=buildEngineNotes();var _latchSnap=snapshotNoteLatches();"
    },
    {
      label: "#151 a pre-commit failure no longer un-burns the delivered latches",
      mustFail: "the pre-commit failure path no longer restores the latches",
      find: "restoreNoteLatches(_latchSnap);",
      replace: ""
    },

    /* ── #158 PHASE-DETECTOR WIRING CONTRACT (run-tests.js:597) ── */
    {
      label: "#158 commitGmTurn stops judging committed prose for phase drift",
      mustFail: "#158: commitGmTurn no longer runs clockPhaseDetect",
      find: "  if(!_refusal&&typeof clockPhaseDetect===\"function\")clockPhaseDetect(clean);",
      replace: "  if(!_refusal&&false)clockPhaseDetectOFF(clean);"
    },
    {
      label: "#158 a re-rolled scene can assert a phase with no detection and no tag heal",
      mustFail: "#158: rerollLast no longer runs clockPhaseDetect",
      find: "  if(!_rrRefusal&&typeof clockPhaseDetect===\"function\")clockPhaseDetect(clean);",
      replace: "  if(!_rrRefusal&&false)clockPhaseDetectOFF(clean);"
    },

    /* ── AUDIO RECOVERY CONTRACT ③ (run-tests.js:1100) ── */
    {
      label: "v1.421 the send gesture no longer repairs an interrupted AudioContext",
      mustFail: "sendAction no longer repairs audio on the send gesture",
      find: "TTS.recoverAudio(\"send\");",
      replace: "TTS.recoverAudioLATER(\"send\");"
    },

    /* ── TRANSCRIPT MUTATION SEAM CONTRACT ② (run-tests.js:141) ── */
    {
      label: "#177 a shipped file writes a transcript-entry field directly again",
      mustFail: "writes a transcript-entry field directly",
      find: "function retryLast(){",
      replace: "function retryLast(){if(false)worldState.transcript[0].e=null;"
    },

    /* ── #76 TABLE TALK ISOLATION CONTRACT (run-tests.js:1389) — the 13 unproven clauses ── */
    {
      label: "#76 lastAction unguarded — Retry replays a Table Talk question as a story turn",
      mustFail: "lastAction guarded by !isTT",
      find: "if(!isTT)lastAction=txt;",
      replace: "lastAction=txt;"
    },
    {
      label: "#76 summarize unguarded — out-of-character chatter drives memory extraction",
      mustFail: "summarize guarded by !isTT",
      find: "    if(!isTT&&sessionTokens()>=SUMMARIZE_AT)await summarize();",
      replace: "    if(sessionTokens()>=SUMMARIZE_AT)await summarize();"
    },
    {
      label: "#76 engine notes unguarded — a TT question consumes one-shot nudge latches",
      mustFail: "engine notes guarded by !isTT",
      find: "    if(!isTT&&!(opts&&opts.silent)){var _latchSnap=snapshotNoteLatches();",
      replace: "    if(!(opts&&opts.silent)){var _latchSnap=snapshotNoteLatches();"
    },
    {
      label: "#76 the multi-PC queue swallows a Table Talk question as a player's round action",
      mustFail: "multi-PC queue bypassed for TT",
      find: "  if(!isTT&&!(opts&&opts.silent)&&!(opts&&opts.mpBypass)",
      replace: "  if(!(opts&&opts.silent)&&!(opts&&opts.mpBypass)"
    },
    {
      label: "#76 the TT call sends the narrative sessionLog as history",
      mustFail: "TT sends noHistory",
      find: "isTT?{noHistory:true,kind:\"tabletalk\"}:undefined",
      replace: "isTT?{kind:\"tabletalk\"}:undefined"
    },
    {
      label: "#76 the TT pane renders raw state tags again (the #74① [CALENDAR:] sighting)",
      mustFail: "TT response runs cleanTxt",
      find: "      var ttClean=(typeof cleanTxt===\"function\")?cleanTxt(resp):resp;",
      replace: "      var ttClean=resp;"
    },
    {
      label: "#76 a failed TT question retries through retryLast — into the story channel",
      mustFail: "TT failure retries AS TT",
      find: "isTT?function(){sendAction(txt,{ttRetry:true});}:function(){retryLast();}",
      replace: "function(){retryLast();}"
    },
    {
      label: "#76 opts.ttRetry no longer forces the TT path — a retry lands on whatever tab is open",
      mustFail: "opts.ttRetry forces the TT path",
      find: "  var isTT=(opts&&opts.ttRetry)?true:(activeChatTab===\"tabletalk\");",
      replace: "  var isTT=(activeChatTab===\"tabletalk\");"
    },
    {
      label: "#76 commitGmTurn reachable from the TT branch — applyMuts/transcript/turn on chatter",
      mustFail: "commitGmTurn sits in the ELSE of if(isTT)",
      find: "      saveAll();/* persist the TT log;",
      replace: "      commitGmTurn(resp,{userMsg:apiTxt});saveAll();/* persist the TT log;"
    },
    {
      label: "#76 a second commitGmTurn call appears in sendAction (double-commit surface)",
      mustFail: "commitGmTurn called exactly once in sendAction",
      find: "      commitGmTurn(resp,{userMsg:apiTxt,playerTxt:txt,logPlayer:",
      replace: "      commitGmTurn(resp,{userMsg:apiTxt});commitGmTurn(resp,{userMsg:apiTxt,playerTxt:txt,logPlayer:"
    },
    {
      label: "#76 ttLog written twice in game.js — the TT log stops being TT's alone",
      mustFail: "ttLog is written in game.js exactly once",
      find: "      ttLogExchange(txt,ttClean);",
      replace: "      ttLogExchange(txt,ttClean);ttLogExchange(txt,ttClean);"
    },

    /* ── #14 PENDING ACTION CONTRACT (run-tests.js:1673) ── */
    {
      label: "#14 the failure path stops persisting the story action (a page kill eats the words)",
      mustFail: "the sendAction failure path no longer persists the story action",
      find: "if(!isTT)savePendingAction(txt);",
      replace: "savePendingAction(txt);"
    },
    {
      label: "#14 a committed turn no longer supersedes the persisted draft",
      mustFail: "commitGmTurn no longer clears the pending action",
      find: "  if(typeof clearPendingAction===\"function\")clearPendingAction();",
      replace: "  if(false)clearPendingActionOFF();"
    },
    {
      label: "#14 savePendingAction flushes through saveAll — persisting the orphan transcript entry",
      mustFail: "savePendingAction must write ONLY its own key",
      find: "  try{store.set(PENDING_ACT_K,",
      replace: "  saveAll();try{store.set(PENDING_ACT_K,"
    }
  ]
});

/* ═══ api.js ════════════════════════════════════════════════════════════════════════════════ */
rc |= sabotage.prove({
  file: "api.js",
  command: GATE,
  cases: [
    /* ── #151 LATCH REGISTRY CONTRACT — the registry half ── */
    {
      label: "#151 a latch field is dropped from NOTE_LATCH_FIELDS while its write stays",
      mustFail: "builder region writes UNDECLARED worldState key(s)",
      find: "\"phaseMismatch\",",
      replace: ""
    },
    /* ── #76 TABLE TALK ISOLATION CONTRACT — the prompt-builder half ── */
    {
      label: "#76 the gameplay prompt builder gains a Table Talk reference",
      mustFail: "buildSysPrompt/api.js has zero Table Talk references",
      find: "var __lastRagBlock=\"\";",
      replace: "var __ttLogPeek=(typeof ttLog!==\"undefined\")?ttLog:null;var __lastRagBlock=\"\";"
    }
  ]
});

/* ═══ table-talk.js ═════════════════════════════════════════════════════════════════════════ */
rc |= sabotage.prove({
  file: "table-talk.js",
  command: GATE,
  cases: [
    {
      label: "#76 a date/solstice special-case branch returns to the help agent",
      mustFail: "table-talk.js has NO date/solstice special-case branch",
      find: "function ttRecallBlock(question){",
      replace: "function ttRecallBlock(question){if(/solstice/i.test(question))return \"\";"
    }
  ]
});

/* ═══ identity.js — REFUSAL COPY CONTRACT (#213, run-tests.js:103) ══════════════════════════
   ⚠ SKIPPED, AND THE REASON IS THE FINDING (#275, 2026-08-28). Both clauses below MUTATE BYTES
   and both make the contract PRINT its failure — and `node dev/run-tests.js` still exits 0.
   run-tests.js:103-139 is the ONLY contract in the file that reports with `process.exitCode = 1`
   (four sites) instead of `process.exit(1)`, and run-tests.js:1852 ends with an unconditional
   `process.exit(0)`, which discards process.exitCode. So the #213 contract is non-blocking: CI
   and the pre-commit hook both go green while the shipped-refusal-vocabulary ↔ player-copy
   registry guard shouts into a log nobody fails on. Measured, not inferred (rename
   W2_REFUSAL_REASONS → the message prints, status 0).
   This is a drift-surface guard, so the one-character fix is NOT this lane's to make: per the
   #275 brief a vacuous/inert contract is recorded for Fable, never repaired in place. The
   clauses stay here, skip-flagged, because dev/check-sabotage-applicability.js still collects
   and freshness-checks their find targets — the day `process.exitCode` becomes `process.exit(1)`
   the proof is one `skip` line away. */
rc |= sabotage.prove({
  file: "identity.js",
  skip: true,
  command: GATE,
  cases: [
    {
      label: "#213 a new refusal reason ships with no player sentence in the registry",
      mustFail: "identity.js refuses with reason(s) the shipped registry does not carry",
      find: "var W2_REFUSAL_REASONS=[",
      replace: "var _w2NewReason=\"death evidence is missing an owner-ruled witness\";var W2_REFUSAL_REASONS=["
    },
    {
      label: "#213 the shipped-reason registry itself is gone",
      mustFail: "W2_REFUSAL_REASONS is gone from identity.js",
      find: "var W2_REFUSAL_REASONS=[",
      replace: "var W2_REFUSAL_REASONS_RENAMED=["
    }
  ]
});

/* ═══ memory.js — TRANSCRIPT MUTATION SEAM CONTRACT ③ ═══════════════════════════════════════ */
rc |= sabotage.prove({
  file: "memory.js",
  command: GATE,
  cases: [
    {
      label: "#177 the sanctioned-bypass marker is lost — the one aliased write goes undocumented",
      mustFail: "memory.js lost the '#177 SANCTIONED SEAM BYPASS' marker",
      find: "#177 SANCTIONED SEAM BYPASS",
      replace: "#177 sanctioned seam bypass (marker renamed)"
    }
  ]
});

/* ═══ clock.js — #158 PHASE-DETECTOR WIRING CONTRACT (the one-vocabulary rule) ══════════════ */
rc |= sabotage.prove({
  file: "clock.js",
  command: GATE,
  cases: [
    {
      label: "#158 the prose phase forms stop being derived from TIME_PHASES (two vocabularies)",
      mustFail: "#158: the prose forms are no longer DERIVED from TIME_PHASES",
      find: "TIME_PHASES[i].re.source",
      replace: "\"dawn|dusk\"/* hand-copied */"
    }
  ]
});

/* ═══ helpers.js — INJECTION SINK CONTRACT ③ (the behavioural half, run-tests.js:1790) ══════ */
rc |= sabotage.prove({
  file: "helpers.js",
  command: GATE,
  cases: [
    {
      label: "escHtml stops neutralizing '<' — every escaped render in the app becomes a sink",
      mustFail: "escHtml() no longer neutralizes markup",
      find: ".replace(/</g,\"&lt;\")",
      replace: ""
    }
  ]
});

/* ═══ storage-adapter.js — INJECTION SINK CONTRACT ① ② ══════════════════════════════════════ */
rc |= sabotage.prove({
  file: "storage-adapter.js",
  command: GATE,
  cases: [
    {
      label: "the untrusted server-blob narrativeHtml innerHTML sink returns",
      mustFail: "renders narrativeHtml via innerHTML again",
      find: "if (typeof initReplaySession === \"function\") initReplaySession();",
      replace: "document.getElementById(\"story-narrative\").innerHTML = data.narrativeHtml;"
    },
    {
      label: "the post-adopt replay fallback is gone — a pre-transcript blob shows an empty pane",
      mustFail: "lost the initReplaySession fallback after server adopt",
      find: "if (typeof initReplaySession === \"function\") initReplaySession();",
      replace: "if (false) { /* no replay */ }"
    }
  ]
});

/* ═══ ui-portrait.js — INJECTION SINK CONTRACT ② (the err.message sink scan) ════════════════ */
rc |= sabotage.prove({
  file: "ui-portrait.js",
  command: GATE,
  cases: [
    {
      label: "a raw err.message is concatenated into innerHTML without escHtml",
      mustFail: ".message rendered via innerHTML without escHtml()",
      find: "function compressPortrait(",
      replace: "function _pmSinkDemo(el,e){el.innerHTML=\"<b>Render failed:</b> \"+e.message;}\nfunction compressPortrait("
    }
  ]
});

/* ═══ ui-boot.js — #14 PENDING ACTION CONTRACT ③ ════════════════════════════════════════════ */
rc |= sabotage.prove({
  file: "ui-boot.js",
  command: GATE,
  cases: [
    {
      label: "#14 boot restores with a direct .value= write, clobbering a fresher STT draft",
      mustFail: "ui-boot no longer restores via restoreFailedInput",
      find: "restoreFailedInput(_pi,_pa)",
      replace: "(_pi.value=_pa)"
    }
  ]
});

/* ═══ error-report.js — UNLOAD STAMP CONTRACT (v1.432) ══════════════════════════════════════ */
rc |= sabotage.prove({
  file: "error-report.js",
  command: GATE,
  cases: [
    {
      label: "v1.432 the pagehide/beforeunload stamp is gone — every recovered ring reads as a kill",
      mustFail: "the pagehide/beforeunload unload stamp is gone from error-report.js",
      find: /erCrumb\("unload"\)/g,
      replace: "erCrumb(\"page-closed\")"
    }
  ]
});

/* ═══ tts.js — the oldest tier: VENDOR PATCH, VOICE-DELETION, AUDIO RECOVERY, RESPAWN,
     PLAYBACK RECYCLE, GOVERNOR, DEFAULT BENCH. These predate the 2026-07-29 sabotage rule and
     may never have had authoring-time proofs at all (f74 verifier note). ═════════════════════ */
rc |= sabotage.prove({
  file: "tts.js",
  command: GATE,
  cases: [
    /* ── VENDOR PATCH preamble (run-tests.js:38, :60) ── */
    {
      label: "the vits-web patch rev and PIPER_RUNTIME_REV fall out of lockstep",
      mustFail: "VENDOR REV MISMATCH",
      find: "var PIPER_RUNTIME_REV = \"r9\";",
      replace: "var PIPER_RUNTIME_REV = \"r10\";"
    },
    {
      label: "the r8 cross-turn session recycle loses its caller (the iOS 9/50 memory ratchet)",
      mustFail: "session recycle (T&D r8)",
      /* the replacement must NOT contain the scanned literal — "tndRecycleSessionGONE" still
         satisfies indexOf("tndRecycleSession") and reported MISSED on the first run */
      find: /tndRecycleSession/g,
      replace: "tndSessionRecycle"
    },

    /* ── VOICE-DELETION TRUTHFULNESS CONTRACT (v1.419/v1.439/#95) ── */
    {
      label: "v1.419 a deletion path goes back through the swallowing vendored mod.remove()",
      mustFail: "a deletion path calls the vendored mod.remove()",
      find: "  function _piperDeleteVoice(id) {",
      replace: "  function _piperDeleteVoice(id) {\n    try { mod.remove(id); } catch (e) { console.error(e); }"
    },
    {
      label: "v1.419 the standard removeEntry primitive is replaced by the Chrome-only handle.remove()",
      mustFail: "no longer uses removeEntry()",
      find: /removeEntry\(/g,
      replace: "removeEntryCHROMEONLY("
    },
    {
      label: "v1.419 automatic eviction stops consulting _voiceAssignedTo (takes an assigned voice)",
      mustFail: "_piperEvictExcess no longer consults _voiceAssignedTo",
      /* only the protection check INSIDE _piperEvictExcess (tts.js:2286). A global rename also
         renames the definition, which trips the contract's "anchor moved" clause instead
         (MISATTRIBUTED, run 1); the releaseVoiceIfUnused call site is a different function and
         is outside the censused slice (MISSED, run 2). */
      find: "      if (_voiceAssignedTo(stored[i]).length) { protectedIds.push(stored[i]); continue; }",
      replace: "      if (false) { protectedIds.push(stored[i]); continue; }"
    },
    {
      label: "v1.419 the slot list caps its row loop at PIPER_VOICE_CAP (over-cap voices undeletable)",
      mustFail: "_renderPiperSlots caps its row loop at PIPER_VOICE_CAP",
      find: "  function _renderPiperSlots(",
      replace: "  function _renderPiperSlotsCapped(){var i;for (i = 0; i < PIPER_VOICE_CAP; i++){}}\n  function _renderPiperSlots("
    },
    {
      label: "#95 R1 a third split-on-'#' site appears outside voiceBaseId/voiceSpeaker",
      mustFail: "takes voice ids apart on '#' in more than the two sanctioned places",
      find: "  function _renderPiperSlots(",
      replace: "  function _voiceModelOf(id){return String(id).split(\"#\")[0];}\n  function _renderPiperSlots("
    },

    /* ── AUDIO RECOVERY CONTRACT (v1.421/v1.437/v1.438) ── */
    {
      label: "v1.437 the second-attempt escalation (_stuckCtx → _ctxDoomed) is gone from recoverAudio",
      mustFail: "the second-attempt escalation (_stuckCtx",
      /* same substring trap as the r8 clause: "_stuckCtxRETIRED" still contains "_stuckCtx" */
      find: /_stuckCtx/g,
      replace: "_wedgedCtx"
    },
    {
      label: "v1.437 the frozen-clock zombie detector is gone (a 'running' ctx plays silence forever)",
      mustFail: "the frozen-clock zombie detector is gone",
      find: "erCrumb(\"ctx-zombie\"",
      replace: "erCrumb(\"ctx-slow\""
    },
    {
      label: "v1.438 the doomed-ctx rebuild discards the in-flight item (bar stranded on 'Speaking…')",
      mustFail: "no longer requeues the in-flight item",
      find: "      _queue.unshift(replayItem);",
      replace: ""
    },

    /* ── RESPAWN ORDERING CONTRACT (v1.424/v1.429) ── */
    {
      label: "v1.424 build-then-destroy returns — the replacement realm is spawned before the free",
      mustFail: "the old realm is destroyed AFTER the new one is spawned",
      find: "        _respawnStage = \"destroy\";",
      replace: "        _piperSpawnFrame();_respawnStage = \"destroy\";"
    },
    {
      label: "v1.429 the respawn stops publishing its swap — a mid-respawn read spawns a 2nd realm",
      mustFail: "no longer publishes its swap as _frameRespawnP",
      find: "    _frameRespawnP = p;",
      replace: "    var _unpublished = p;"
    },
    {
      label: "v1.429 _piperInit stops awaiting the in-flight respawn (the orphaned-engine leak)",
      mustFail: "_piperInit no longer awaits _frameRespawnP",
      find: "      try { await _frameRespawnP; }",
      replace: "      try { await Promise.resolve(); }"
    },

    /* ── PLAYBACK RECYCLE CONTRACT (v1.430) ── */
    {
      label: "v1.430 the onended handler stops detaching the source buffer (Safari #718 retention)",
      mustFail: "no longer nulls the source's buffer",
      find: /mySrc\.buffer = null/g,
      replace: "mySrc.bufferRETAINED = null"
    },
    {
      label: "v1.430 the healthy-context recycle is gone from recoverAudio (B9's prime suspect uncapped)",
      mustFail: "the healthy-context recycle is gone from recoverAudio",
      find: "_ctxSynths >= AUDIO_CTX_RECYCLE_SYNTHS",
      replace: "false"
    },

    /* ── WORK-BUDGET GOVERNOR CONTRACT (v1.434) ── */
    {
      label: "v1.434 the START gate is gone from _speakPiper — the iOS energy budget is spent again",
      mustFail: "the START gate (_piperGovernStart) is gone",
      find: "    if (_piperGovernStart()) { _curNative = true; _speakNative(text); return; }",
      replace: "    if (false) { _curNative = true; _speakNative(text); return; }"
    },
    {
      label: "v1.434 the HARD mid-read gate is gone — a long read crosses the death floor mid-flight",
      mustFail: "the HARD mid-read gate (_piperGovernHard) is gone",
      find: "      if (i > 0 && _piperGovernHard()) {",
      replace: "      if (i > 0 && false) {"
    },

    /* ── DEFAULT BENCH CONTRACT (#95.6, nested in STARS PORTABILITY) ── */
    {
      label: "#95.6 the two DEFAULT STAR BENCH copies drift apart (game vs speaker browser)",
      mustFail: "DEFAULT STAR BENCH copies have drifted apart",
      find: "{ id: \"en_US-libritts_r-medium#1\", label: \"Speaker 1 · reader 8699 (F)\", g: \"F\" },",
      replace: "{ id: \"en_US-libritts_r-medium#1\", label: \"Speaker 1 · reader 8699 (F) [edited]\", g: \"F\" },"
    }
  ]
});

/* ═══ vendor/piper/vits/vits-web.js — VENDOR PATCH preamble ═════════════════════════════════ */
rc |= sabotage.prove({
  file: "vendor/piper/vits/vits-web.js",
  command: GATE,
  cases: [
    {
      label: "a re-vendor drops the T&D session-cache patch (the iOS per-sentence session crash)",
      mustFail: "lost the T&D session-cache patch",
      find: /T&D PATCH/g,
      replace: "TnD PATCH"
    },
    {
      label: "a re-vendor drops the non-OK download guard (an HF error page cached AS the model)",
      mustFail: "S() lost the non-OK download guard",
      find: "voice download failed: HTTP",
      replace: "voice download failed (http)"
    }
  ]
});

/* ═══ ui-sheets.js — VOICE-DELETION CONTRACT ⑨ (#95 S5) ═════════════════════════════════════ */
rc |= sabotage.prove({
  file: "ui-sheets.js",
  command: GATE,
  cases: [
    {
      label: "#95 S5 the ★ Cast voices optgroup is gone — an assigned speaker voice is unreachable",
      mustFail: "no longer renders the ★ Cast voices optgroup",
      find: /starOptionsHtml/g,
      replace: "starOptionsGONE"
    }
  ]
});

/* ═══ speaker_browser.html — STARS PORTABILITY CONTRACT (#95.5/#95.7/#95.8) ═════════════════ */
rc |= sabotage.prove({
  file: "speaker_browser.html",
  command: GATE,
  cases: [
    {
      label: "#95.8 the manual Push/Pull cloud buttons are gone from the page",
      mustFail: "the Push/Pull cloud buttons are gone from the page",
      find: "id=\"star-push\"",
      replace: "id=\"star-push-old\""
    },
    {
      label: "#95.5 saveStars stops scheduling a cloud push — local edits silently stop mirroring",
      mustFail: "saveStars no longer schedules a cloud push",
      find: "    schedulePushStars();   // #95.5:",
      replace: "    /* push removed */   // #95.5:"
    },
    {
      label: "#95.8 applyMetaInto stops applying gender overrides — corrections vanish on every load",
      mustFail: "applyMetaInto no longer applies gender overrides",
      find: "    applyGenderOverrides(st);   // #95.8:",
      replace: "    /* overrides dropped */   // #95.8:"
    },
    {
      label: "#95.7 the cloud adopt stops deriving g via starG — a pull lands a g-less bench",
      mustFail: "adoptCloudStars no longer derives g via starG",
      find: "stars.push({ id: it.id, label: lbl, g: starG(",
      replace: "stars.push({ id: it.id, label: lbl, gDropped: starG("
    }
  ]
});

/* ═══ author_voice_lab.html + sw.js + data.js — VOICE LAB CONTRACT (v1.492) ═════════════════ */
rc |= sabotage.prove({
  file: "author_voice_lab.html",
  command: GATE,
  cases: [
    {
      label: "the pure-core markers are gone — the lab's only node-test seam disappears",
      mustFail: "core markers missing",
      find: "/* >>> VOICE LAB CORE",
      replace: "/* VOICE LAB CORE (markers dropped)"
    },
    {
      label: "the browser test seam is gone (satellite testability rule)",
      mustFail: "the window.__voiceLabTest seam is gone",
      find: /__voiceLabTest/g,
      replace: "__voiceLabSeamGone"
    },
    {
      label: "stub mode is gone — UI verification without a provider key becomes impossible",
      mustFail: "stub mode (?stub=1) is gone",
      find: /stub=1/g,
      replace: "stubmode=on"
    }
  ]
});

rc |= sabotage.prove({
  file: "sw.js",
  command: GATE,
  cases: [
    {
      label: "the voice lab drops out of sw.js's network-first REGEX — the SW pins it stale",
      mustFail: "author_voice_lab is missing from sw.js's network-first REGEX",
      find: "|author_voice_lab|voice_picker",
      replace: "|voice_picker"
    }
  ]
});

rc |= sabotage.prove({
  file: "data.js",
  command: GATE,
  cases: [
    {
      label: "a new AUTHORS entry ships with no voice-lab baseline (the same-commit rule)",
      mustFail: "(data.js) has NO baseline",
      find: "var AUTHORS=[",
      replace: "var AUTHORS=[\n{id:\"newvoice\",nm:\"New Voice\",blurb:\"x\",vc:\"y\"},"
    }
  ]
});

/* ═══ dev/engine-manifest.js + test.html — ENGINE MANIFEST CONTRACT ═════════════════════════ */
rc |= sabotage.prove({
  file: "dev/engine-manifest.js",
  command: GATE,
  cases: [
    {
      label: "the manifest order stops matching index.html's engine load order (the #17 rot class)",
      mustFail: "no longer matches index.html's engine load order",
      find: "  { file: \"tts.js\",                sym: \"TTS\" },\n  { file: \"sound.js\",              sym: \"Sound\" }",
      replace: "  { file: \"sound.js\",              sym: \"Sound\" },\n  { file: \"tts.js\",                sym: \"TTS\" }"
    },
    {
      label: "a manifest entry loses its load-guard sym — test.html's missing-file report goes blind",
      mustFail: "manifest entries missing a sym",
      find: "  { file: \"tts.js\",                sym: \"TTS\" },",
      replace: "  { file: \"tts.js\" },"
    }
  ]
});

rc |= sabotage.prove({
  file: "test.html",
  command: GATE,
  cases: [
    {
      label: "test.html stops generating its tags from ENGINE_MANIFEST (the manual-copy class)",
      mustFail: "test.html no longer loads dev/engine-manifest.js",
      find: "src=\"dev/engine-manifest.js\"",
      replace: "src=\"dev/engine-manifest-old.js\""
    },
    {
      label: "a static engine <script> tag creeps back into test.html and shadows the generated list",
      mustFail: "test.html has static engine <script> tags again",
      find: "<body>",
      replace: "<body>\n<script src=\"globals.js\"></script>"
    }
  ]
});

/* ═══ dev/bible-server.js — BIBLE-SERVER WRITE-AUTH CONTRACT (v1.521) ═══════════════════════ */
rc |= sabotage.prove({
  file: "dev/bible-server.js",
  command: GATE,
  cases: [
    {
      label: "the write token stops being random per run — any local page can write the bible",
      mustFail: "TOKEN is no longer crypto.randomBytes per run",
      find: "var TOKEN = crypto.randomBytes(16).toString(\"hex\");",
      replace: "var TOKEN = \"bible-dev-token\";"
    },
    {
      label: "/install loses the token → 403 guard entirely",
      mustFail: "lost the x-bible-token",
      find: "if (!localOrigin && req.headers[\"x-bible-token\"] !== TOKEN) {",
      replace: "if (!localOrigin && false) {"
    },
    {
      label: "CORS stops allowing X-Bible-Token — the preflight strips auth and every save 403s",
      mustFail: "Access-Control-Allow-Headers lost X-Bible-Token",
      find: "\"Content-Type, X-Bible-Token, X-Bible-Helper-Version\"",
      replace: "\"Content-Type, X-Bible-Helper-Version\""
    }
  ]
});

/* ═══ stt.js — #113 STT UPGRADES + #77 CONFIRM GATE. f74: "stt.js entirely" unproven. ═══════ */
rc |= sabotage.prove({
  file: "stt.js",
  command: GATE,
  cases: [
    /* ── #113 STT UPGRADES CONTRACT (run-tests.js:1711) ── */
    {
      label: "#113 §4a the roster prompt-bias stops riding the transcription (Frizwick→Physics)",
      mustFail: "the Whisper prompt-bias append is gone",
      find: "    if (bias) form.append(\"prompt\", bias);",
      replace: "    if (bias) { /* bias dropped */ }"
    },
    {
      label: "#113 §4b the loud one-retry model fallback is gone — a bad primary is a dead mic",
      mustFail: "the model constants / fallback retry are gone",
      find: "        return _transcribeOnce(blob, ext, key, STT_CLOUD_FALLBACK);",
      replace: "        throw e;"
    },
    {
      label: "#113 §4b a hardcoded whisper-1 model append creeps back",
      mustFail: "a hardcoded whisper-1 model append crept back",
      find: "    if (bias) form.append(\"prompt\", bias);",
      replace: "    form.append(\"model\", \"whisper-1\");\n    if (bias) form.append(\"prompt\", bias);"
    },
    {
      label: "#113 §4c the recording cap goes back to a literal 15s wall",
      mustFail: "the recording cap no longer runs on STT_MAX_RECORD_MS",
      find: "      }, STT_MAX_RECORD_MS);",
      replace: "      }, 15000);"
    },
    {
      label: "#113 §4c the teardown stops killing the VAD monitor (poll/source leak across takes)",
      mustFail: "_cloudTeardownStream no longer stops the VAD monitor",
      find: "    _vadStop(); // §4c: every stop path kills the monitor",
      replace: "    /* vad left running */ // §4c: every stop path kills the monitor"
    },
    {
      label: "#113 §4d the mic getSettings → #16 crumb telemetry is gone (the car case goes blind)",
      mustFail: "the mic getSettings → #16 crumb telemetry is gone",
      find: /erCrumb\("stt-mic"/g,
      replace: "erCrumb(\"stt-device\""
    },

    /* ── #77 CONFIRM GATE CONTRACT (run-tests.js:1749) ── */
    {
      label: "#77 the confirm interceptor sinks below carVoiceCommand — a spoken 'no' is eaten",
      mustFail: "the _confirmPending interceptor no longer sits ABOVE carVoiceCommand",
      find: "    if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }",
      replace: "    if (typeof carVoiceCommand === \"function\") { /* moved above */ }\n    if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }"
    },
    {
      label: "#77 Layer 0 stops requesting logprobs — every cloud utterance reads as no-signal",
      mustFail: "the include[]=logprobs request field is gone",
      find: "      form.append(\"include[]\", \"logprobs\");",
      replace: "      /* logprobs not requested */"
    },
    {
      label: "#77 Layer 2 a confirmed send re-reads the (cleared) field instead of the pending text",
      mustFail: "_resolveConfirm no longer sends the stored pending text",
      find: "sendAction(pend.text);",
      replace: "sendAction(el && el.value);"
    }
  ]
});

process.exit(rc);
