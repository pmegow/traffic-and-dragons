// sabotage-467-openai-voice-retired.js — retained proof for dev/tests-467-openai-voice-retired.js (#467).
// Each mutation names the guard it breaks: a stale saved voice primary escaping into the Voice Settings
// draft, the voice save clobbering the GM's OpenAI key, and the OpenAI LANGUAGE MODEL losing its provider
// row or its place in the Language Model modal (the shared-name protection, owner 2026-09-27).
var sabotage = require("./sabotage.js");
var command = ["node", ["dev/tests-467-openai-voice-retired.js"]];
var voice = [
  { label: "a stale saved primary (openai) escapes the model registry check",
    find: 'return VOICE_MODELS[p] ? p : geminiTtsEnabled() ? "gemini" : "local";',
    replace: 'return p ? p : geminiTtsEnabled() ? "gemini" : "local";',
    mustFail: "stale saved primary escaped" },
  { label: "the voice save drops the GM's OpenAI key",
    find: "    if (data.keys.gemini) keys.gemini = data.keys.gemini.trim();",
    replace: "    if (data.keys.gemini) keys.gemini = data.keys.gemini.trim(); delete keys.openai;",
    mustFail: "the voice save changed the OpenAI language-model key" }
];
var provider = [
  { label: "the OpenAI language-model provider row is cut with the voice tier",
    find: "  openai:{",
    replace: "  openai_retired:{",
    mustFail: "PROVIDERS.openai is gone" }
];
var modal = [
  { label: "the Language Model modal stops listing OpenAI",
    find: "for(i=0;i<ids.length;i++)items.push({id:ids[i],label:PROVIDERS[ids[i]].label});",
    replace: "for(i=0;i<ids.length;i++)if(ids[i]!==\"openai\")items.push({id:ids[i],label:PROVIDERS[ids[i]].label});",
    mustFail: "the Language Model modal no longer lists ChatGPT (OpenAI)" }
];
// The carry-over (tests-401): shared behaviours whose only guards were the deleted #398/#399 suites.
var carried = [
  { label: "auto-cast ignores the edited star bench (was #399)",
    find: "list = starsList();", replace: "list = [];",
    mustFail: "edited structured gender ignored" },
  { label: "an unstarred shipped pin loses its gender (was #399)",
    find: "if (DEFAULT_SPEAKER_STARS[i].id === voiceId)", replace: "if (false)",
    mustFail: "unstarred shipped pin lost its gender" },
  { label: "the cloud reader keeps decoded PCM after a group ends (was #398)",
    find: "        try { mySrc.buffer = null; } catch (e) {}\n        var ix = _sources.indexOf(mySrc); if (ix >= 0) _sources.splice(ix, 1);\n        if (loopDone && activeSrcs === 0",
    replace: "        var ix = _sources.indexOf(mySrc); if (ix >= 0) _sources.splice(ix, 1);\n        if (loopDone && activeSrcs === 0",
    mustFail: "a finished group kept its decoded audio" },
  { label: "Skip leaves a cloud audition's Test pulse stuck (was #398)",
    find: "    _stopCurrent();\n    _auditionPhase(\"idle\");\n    _playing = false;",
    replace: "    _stopCurrent();\n    _playing = false;",
    mustFail: "Skip left the Test pulse stuck" },
  { label: "a new audition leaves the previous one running (proven for the retired OpenAI audition only, until #467)",
    find: "    stop();\n    var testEpoch = _piperEpoch;",
    replace: "    var testEpoch = _piperEpoch;",
    mustFail: "the first audition request is still running" }
];
var a = sabotage.prove({ file: "tts.js", command: command, cases: voice });
var b = sabotage.prove({ file: "globals.js", command: command, cases: provider });
var c = sabotage.prove({ file: "ui-modals.js", command: command, cases: modal });
var d = sabotage.prove({ file: "tts.js", command: ["node", ["dev/tests-401-voice-settings.js"]], cases: carried });
process.exit(a || b || c || d);
