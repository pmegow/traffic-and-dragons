// dev/sabotage-498-tts-skip-line.js — proves the #498 guard is guarded (owner's console 2026-09-30, and every bug report filed
// with a paid voice: "tts-server-skip speechify availability re-check failed" once per read). The #90 attribution line is for a
// read that fell BELOW the server's tier; a voice the player chose skipped nothing. Each mutation runs in a disposable clone.
//   node dev/sabotage-498-tts-skip-line.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/tests-audit-voice.js"]];
var CHOSE = "#498 a signed-in page reading on a voice the player chose", FELL = "#498 a read that FELL below the server tier", RULE = "#498 the rule";
rc |= sabotage.prove({ file: "tts.js", command: CMD, cases: [
  { label: "every engine that is not the server tier reports a skip again (the paid voices)",
    find: "    if (TTS_LADDER.indexOf(engine) <= TTS_LADDER.indexOf(\"server\")) return null;", replace: "    if (engine === \"server\") return null;",
    mustFail: CHOSE },
  { label: "the device voice by the player's own choice reports a skip",
    find: "    if (primary === \"native\") return null;", replace: "    if (false) return null;",
    mustFail: CHOSE },
  { label: "a read that fell below the tier goes silent (no line, no crumb)",
    find: "    return serverErr || (online === false ? \"navigator.onLine=false\" : \"availability re-check failed\");", replace: "    return null;",
    mustFail: FELL },
  { label: "the recorded failure is dropped from the reason",
    find: "    return serverErr || (online === false ? \"navigator.onLine=false\" : \"availability re-check failed\");", replace: "    return (online === false ? \"navigator.onLine=false\" : \"availability re-check failed\");",
    mustFail: FELL },
  { label: "the offline reason is lost",
    find: "    return serverErr || (online === false ? \"navigator.onLine=false\" : \"availability re-check failed\");", replace: "    return serverErr || \"availability re-check failed\";",
    mustFail: RULE },
  { label: "speak() decides on its own again, without the rule",
    find: "    var _skipWhy = _serverSkipWhy(engine, _voicePrimary(), _serverTtsErr, (typeof navigator !== \"undefined\") ? navigator.onLine : undefined);", replace: "    var _skipWhy = engine !== \"server\" && (_serverTtsErr || \"availability re-check failed\");",
    mustFail: CHOSE }
]});
process.exit(rc ? 1 : 0);
