// sabotage-777-voice.js — retained proof for audit 2026-11-19 (TODO #777), section V (the rows judged without a phone):
//   car-commands.js   V8 a bare "I" is no filler · game.js, tag_table.js   V9 every Car Mode kind sent is handled
//   tts.js   V6 the earcon goes through the master gain · sound.js   V3 the reverb is rebuilt with its context; a failed play
// Each clause runs ONE named case of dev/tests-777-voice.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-voice.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  "V8": "V8: a short first-person line is the player's action",
  "V9": "V9: every kind the game sends to Car Mode is one the loop handles",
  "V3A": "V3: after the audio context is rebuilt, a sound with reverb still plays",
  "V3B": "V3: a play that fails is said at warn level and leaves no node connected",
  "V6": "V6: the narrator's beep goes out through the master gain",
  "V1": "V1: a failure the game hands the car to SAY is read aloud"
};

prove("car-commands.js", [
  { label: "V8: a bare I is filler again",
    find: "i(?:ll| will| want to| wanna)(?: take| do| pick| choose| go with)?|i(?: take| do| pick| choose| go with)|give me", replace: "i(?:ll| will| want to| wanna)?(?: take| do| pick| choose| go with)?|give me", mustFail: ONLY + T.V8 },
  { label: "V8: I before a picking verb is no longer filler (\"I pick three\" is lost)",
    find: "|i(?: take| do| pick| choose| go with)|give me", replace: "|give me", mustFail: ONLY + T.V8 }
]);
prove("game.js", [
  { label: "V9: the final death is sent as a kind the loop drops",
    find: "carNotify(\"info\",\"You have died for the last time. This story is complete.\");", replace: "carNotify(\"ended\",\"You have died for the last time. This story is complete.\");", mustFail: ONLY + T.V9 },
  { label: "V9: a respawn is sent as a kind the loop drops",
    find: "carNotify(\"info\",\"You wake again at \"+r.camp+", replace: "carNotify(\"respawn\",\"You wake again at \"+r.camp+", mustFail: ONLY + T.V9 }
]);
prove("tag_table.js", [
  { label: "V9: a downed hero is sent as a kind the loop drops",
    find: "carNotify(\"info\",\"You are down. Struggle, or yield?\");", replace: "carNotify(\"downed\",\"You are down. Struggle, or yield?\");", mustFail: ONLY + T.V9 }
]);
prove("tts.js", [
  { label: "V6: the beep is wired straight to the speakers",
    find: "gain.connect(_masterNode(ctx));   /* audit 2026-11-19, V6", replace: "gain.connect(ctx.destination);   /* audit 2026-11-19, V6", mustFail: ONLY + T.V6 }
]);
prove("sound.js", [
  { label: "V3: the reverb of the old context is kept across a rebuild",
    find: "_ctxRebuilds++; _verb = null;   /* audit 2026-11-19, V3", replace: "_ctxRebuilds++;   /* audit 2026-11-19, V3", mustFail: ONLY + T.V3A },
  { label: "V3: a failed play is said at debug level",
    find: "console.warn(\"[sound] '\" + id + \"' play failed: \" + (e && e.message));", replace: "console.debug(\"[sound] '\" + id + \"' play failed: \" + (e && e.message));", mustFail: ONLY + T.V3B },
  { label: "V3: a failed play leaves its bus connected",
    find: "      if (bus) { try { bus.disconnect(); } catch (e2) {} }", replace: "      if (false) { try { bus.disconnect(); } catch (e2) {} }", mustFail: ONLY + T.V3B }
]);
prove("car-session.js", [
  { label: "V1: a committed failure is not read aloud",
    find: "    if (V && typeof V.speak === \"function\") V.speak(text);\n    _carSyncBtn();\n  } else if (kind === \"info\"", replace: "    _carSyncBtn();\n  } else if (kind === \"info\"", mustFail: ONLY + T.V1 },
  { label: "V1: a spoken failure arms the tap-to-retry",
    find: "    _carSetStatus(CAR_STR.errorPrefix + text);\n    if (V && typeof V.speak === \"function\") V.speak(text);", replace: "    _carSetStatus(CAR_STR.errorPrefix + text); _carRetryArmed = true;\n    if (V && typeof V.speak === \"function\") V.speak(text);", mustFail: ONLY + T.V1 },
  { label: "V1 review: a spoken committed failure leaves an older retry armed",
    find: "an arm left by an earlier failure would send it again.\n    _carRetryArmed = false;\n", replace: "an arm left by an earlier failure would send it again.\n", mustFail: ONLY + T.V1 },
  { label: "V1: the car has no way to say a failure (the kind falls through in silence)",
    find: "  } else if (kind === \"say\") {", replace: "  } else if (kind === \"said\") {", mustFail: ONLY + T.V1 }
]);
prove("game.js", [
  { label: "V1: a committed turn that could not be shown is silent in the car",
    find: "carNotify(\"say\",\"The turn was applied, but it could not be shown.\");", replace: "carNotify(\"warn\",\"The turn was applied, but it could not be shown.\");", mustFail: ONLY + T.V1 },
  { label: "V1: a committed opening that could not be shown is silent in the car",
    find: "carNotify(\"say\",\"The opening could not be shown. Reload to continue.\");", replace: "carNotify(\"warn\",\"The opening could not be shown. Reload to continue.\");", mustFail: ONLY + T.V1 }
]);

process.exit(failed ? 1 : 0);
