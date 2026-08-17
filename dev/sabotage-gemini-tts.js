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
    /* NOTE: pump()'s own `!s.halted` clause has NO sabotage case ON PURPOSE — it is unreachable
       belt-and-suspenders (take() and landed() both guard halt first, and started-taken stays
       saturated at depth once takes stop), so no test can be made to see it. The first run of
       this suite proved that as a MISSED clause; the reachable halt teeth are take()'s refusal,
       pinned below. */
    { label: "halt's take-guard removed — a skipped read hands out audio anyway (the billing/skip path's real teeth)",
      mustFail: "take() after halt refuses",
      find: "      take:   function() { if (s.halted) return { fail: \"halted\" }; var r = s.results[s.taken];",
      replace: "      take:   function() { var r = s.results[s.taken];" },
    { label: "fast-start cap dropped — the cold open pays a full-size group's non-streaming synthesis again",
      mustFail: "the FIRST group is capped small",
      find: "      var cap = groups.length ? GEMINI_TTS_MAX_GROUP_CH : GEMINI_TTS_FAST_START_CH;",
      replace: "      var cap = GEMINI_TTS_MAX_GROUP_CH;" },
    { label: "flat deadline restored — full-size groups are guaranteed losers again (the mid-read degrade class)",
      mustFail: "timeout scales with group length",
      find: "    return GEMINI_TTS_TIMEOUT_BASE_MS + Math.round((chars || 0) * GEMINI_TTS_TIMEOUT_PER_CH_MS)\n         + (isFirst ? GEMINI_TTS_TIMEOUT_COLD_MS : 0);",
      replace: "    return 25000 + (isFirst ? GEMINI_TTS_TIMEOUT_COLD_MS : 0);" },
    { label: "#41c quota backoff flattened to a blip retry — the owner's group-7/11 mid-read degrade returns",
      mustFail: "quota-window schedule, not a blip retry",
      find: "  var GEMINI_TTS_429_BACKOFF_MS = [5000, 15000, 30000];",
      replace: "  var GEMINI_TTS_429_BACKOFF_MS = [1200];" },
    { label: "#41c RetryInfo parser gutted — Google says exactly how long to wait and we stop listening",
      mustFail: "Google's own retryDelay is honored",
      find: "          var m = String(d.retryDelay).match(/^([\\d.]+)s$/);\n          if (m) return Math.round(parseFloat(m[1]) * 1000);",
      replace: "          if (d.retryDelay) return 0;" },
    { label: "#41d hint cap removed — a 33-minute RetryInfo becomes a 33-minute mid-read wait (the owner's second capture)",
      mustFail: "an absurd quota hint is refused",
      find: "    if (hintMs > GEMINI_TTS_429_HINT_CAP_MS) return -1;\n    if (hintMs > 0) return hintMs;",
      replace: "    if (hintMs > 0) return hintMs;" },
    { label: "#41d degrade-window extension dropped — a closed quota gets a probe request burned against it every 60s",
      mustFail: "quota hint EXTENDS the degrade window",
      find: "    _geminiTtsErrFor = Math.min(Math.max(forMs || GEMINI_TTS_RETRY_MS, GEMINI_TTS_RETRY_MS), GEMINI_TTS_DEGRADE_CAP_MS);",
      replace: "    _geminiTtsErrFor = GEMINI_TTS_RETRY_MS;" }
  ]
});

process.exit(rc ? 1 : 0);
