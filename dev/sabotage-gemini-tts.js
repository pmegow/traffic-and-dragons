// sabotage-gemini-tts.js — prove the #41b conveyor guards actually guard.
// The Gemini tier spends the player's money, so its bounds are the contract: the conveyor depth
// (memory + quota + skip-waste all hang off it), strict delivery order (the voice-change seam),
// halt-on-abort (billing), the fast-start opener, and the length-scaled deadline. Each case
// breaks one; the suite must go red on that clause's own test. Runs via the harness's disposable
// git clone — the working tree is never mutated.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "tts.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "conveyor depth bound broken — every group synthesizes at once (quota burst, unbounded held audio, whole-turn skip waste)",
      mustFail: "depth bounds in-flight + ready together",
      find: "      while (!s.halted && (s.started - s.taken) < depth && s.started < count) { s.started++; startFn(s.started - 1); }",
      replace: "      while (!s.halted && s.started < count) { s.started++; startFn(s.started - 1); }" },
    { label: "ordered delivery broken — any landed result reads as ready (out-of-order playback at the voice seam)",
      mustFail: "results deliver strictly IN ORDER",
      find: "      ready:  function() { return s.results[s.taken] !== undefined; },",
      replace: "      ready:  function() { for (var k in s.results) return true; return false; }," },
    { label: "halt stops nothing — a skipped read keeps synthesizing and billing",
      mustFail: "halt() stops the pump",
      find: "      while (!s.halted && (s.started - s.taken) < depth",
      replace: "      while ((s.started - s.taken) < depth" },
    { label: "fast-start cap dropped — the cold open pays a full-size group's non-streaming synthesis again",
      mustFail: "the FIRST group is capped small",
      find: "      var cap = groups.length ? GEMINI_TTS_MAX_GROUP_CH : GEMINI_TTS_FAST_START_CH;",
      replace: "      var cap = GEMINI_TTS_MAX_GROUP_CH;" },
    { label: "flat deadline restored — full-size groups are guaranteed losers again (the mid-read degrade class)",
      mustFail: "timeout scales with group length",
      find: "    return GEMINI_TTS_TIMEOUT_BASE_MS + Math.round((chars || 0) * GEMINI_TTS_TIMEOUT_PER_CH_MS)\n         + (isFirst ? GEMINI_TTS_TIMEOUT_COLD_MS : 0);",
      replace: "    return 25000 + (isFirst ? GEMINI_TTS_TIMEOUT_COLD_MS : 0);" }
  ]
});

process.exit(rc ? 1 : 0);
