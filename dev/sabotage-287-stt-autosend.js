// Retained mutation proof for the #287 STT auto-send battery. Disposable-clone mutations only.
//
// The battery (dev/tests-287-stt-autosend.js) claims four things:
//   ① the corrected proper noun — not the raw homophone — is what reaches sendAction, on BOTH
//     the native and the cloud surface;
//   ② the suspicion verdict is what decides send-vs-confirm;
//   ③ the #77 confirm interceptor sits ABOVE the busy-park and the rank-8 <3-char gate;
//   ④ the confirm vocabulary ("no" discards) is what the interceptor routes on.
// Each clause below deletes or demotes exactly one of those, and the battery must red with an
// attributed failure. A mutation that changes no bytes is a FAILURE of the clause, not a pass.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "stt.js",
  command: ["node", ["dev/tests-287-stt-autosend.js"]],
  cases: [
    {
      label: "#77 confirm interceptor removed from _applySendPolicy",
      mustFail: "the confirmation is STILL pending",
      find: "if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }",
      replace: "if (false && _confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }"
    },
    {
      label: "#77 confirm interceptor demoted BELOW the rank-5 busy-park",
      mustFail: "the confirmation is STILL pending",
      find: "if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }",
      replace: "if (_confirmPending && _gotFinal && text && !(typeof busy !== \"undefined\" && busy)) { _resolveConfirm(text, el); return; }"
    },
    {
      label: "#77 confirm interceptor demoted BELOW the rank-8 <3-char gate",
      mustFail: "the confirmation is STILL pending",
      find: "if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }",
      replace: "if (_confirmPending && _gotFinal && text && !(carModeOn && text.length < 3)) { _resolveConfirm(text, el); return; }"
    },
    {
      label: "suspicion verdict ignored — every utterance auto-sends",
      mustFail: "a suspicious utterance auto-sent",
      find: "if (_susp.suspicious) { _enterConfirm(text, _susp, el, carModeOn); return; }",
      replace: "if (false && _susp.suspicious) { _enterConfirm(text, _susp, el, carModeOn); return; }"
    },
    {
      label: "native final chunk skips roster name-correction",
      mustFail: "native: 'a mica' is corrected to Ameiko",
      find: "if (_roster.length && typeof sttCorrectNames === \"function\") finalTxt = sttCorrectNames(finalTxt, _roster, _utterCorr);",
      replace: "if (false) finalTxt = sttCorrectNames(finalTxt, _roster, _utterCorr);"
    },
    {
      label: "cloud finalize skips roster name-correction",
      mustFail: "cloud: null confidence + one low-score correction auto-sends",
      find: "if (roster.length && typeof sttCorrectNames === \"function\") text = sttCorrectNames(text, roster, _utterCorr);",
      replace: "if (false) text = sttCorrectNames(text, roster, _utterCorr);"
    }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/tests-287-stt-autosend.js"]],
  also: ["stt.js"],   /* the battery drives the WORKING stt.js — it must ride into the clone beside the mutated helper */
  cases: [
    {
      label: "sttSuspicion never flags (the confirm gate goes dark)",
      mustFail: "a suspicious utterance auto-sent",
      find: "return {suspicious:reasons.length>0,reasons:reasons};",
      replace: "return {suspicious:false,reasons:reasons};"
    },
    {
      label: "sttCorrectNames is a no-op (raw homophones reach the GM turn)",
      mustFail: "native: 'a mica' is corrected to Ameiko",
      find: "function sttCorrectNames(text,roster,collector){",
      replace: "function sttCorrectNames(text,roster,collector){return text;"
    },
    {
      label: "the confirm vocabulary loses 'no' (a discard stops being recognizable)",
      mustFail: "parseConfirmCommand: 'no' discards",
      find: "if (/^(?:no|nope|nah|cancel|dont|dont send|dont send it|discard|drop it|never mind|nevermind|scratch that|forget it)$/.test(t)) return \"no\";",
      replace: "if (/^(?:__never_spoken__)$/.test(t)) return \"no\";"
    }
  ]
});

process.exit(rc ? 1 : 0);
