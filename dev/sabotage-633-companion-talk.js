// dev/sabotage-633-companion-talk.js — proves the #633 guards guard: talk to your character is read-only, in the character's
// own voice, through the host row for speech, with a private system and no history; the persona's rules are never trimmed
// away; the hero is a partner; a failed call speaks as the narrator and the tap re-asks. Each clause plants the exact
// regression; dev/tests-633-companion-talk.js must then FAIL. A mutation that changes no bytes is a hard failure.
//   node dev/sabotage-633-companion-talk.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-633-companion-talk.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "companion-talk.js", command: SUITE, cases: [
  { label: "the persona loses its MUST NOT block (the character is free to advance the story)",
    find: "    return L.concat([\"\"], speak, [\"\"], mustNot).join(\"\\n\");",
    replace: "    return L.concat([\"\"], speak).join(\"\\n\");",
    mustFail: "missing: WHAT YOU MUST NOT DO" },
  { label: "the trim pass is disabled (a long campaign cuts the rules off the end of the block)",
    find: "  while (out.length > TALK_CAP.total && guard++ < 80) {",
    replace: "  while (false && out.length > TALK_CAP.total && guard++ < 80) {",
    mustFail: "the trim pass never cuts the rules" },
  { label: "the hero is no longer a partner (only companions are offered)",
    find: "  out.push({ name: ws.character.name, sheet: ws.character, isHero: true });\n",
    replace: "",
    mustFail: "the partners: the hero first" },
  { label: "the talk sends the whole sessionLog with every ask (the private call grows with the campaign)",
    find: "{ noHistory: true, kind: \"talk\" }",
    replace: "{ noHistory: false, kind: \"talk\" }",
    mustFail: "speech asks the model ONCE with a private system and noHistory" },
  { label: "a talk writes the campaign (the character's reply becomes the last narration)",
    find: "    _talkLine(t.name, answer);\n    t.voice.earcon(\"ready\");",
    replace: "    _talkLine(t.name, answer); worldState.lastNarration = answer;\n    t.voice.earcon(\"ready\");",
    mustFail: "worldState and memory are byte-identical after a talk" },
  { label: "a failed call is voiced as the character (fabricated words in their voice)",
    find: "    if (typeof TTS !== \"undefined\" && typeof TTS.speak === \"function\") TTS.speak(\"The line dropped. Say it again, or tap.\");",
    replace: "    t.voice.speak(\"The line dropped. Say it again, or tap.\");",
    mustFail: "the notice is the NARRATOR's voice" },
  { label: "retry forgets the last line (the tap re-asks nothing)",
    find: "  retry: function() { if (_talk && _talk.lastHeard) _talkAsk(_talk.lastHeard); else carNotify(\"info\", \"Nothing to ask again\"); },",
    replace: "  retry: function() { carNotify(\"info\", \"Nothing to ask again\"); },",
    mustFail: "retry re-asks the same line" },
  { label: "the talk leaves stt.js's parked transcript in the field (the auto-mic waits on it forever — the bench's defect A)",
    find: "  if (TALK_HOST.parked().trim() === text) TALK_HOST.clearParked();\n",
    replace: "",
    mustFail: "the transcript stt.js parked is cleared by the talk" },
  { label: "the reply plays with the head unit reading PAUSED (the bench's defect B, the talk's half)",
    find: "    t.voice.speak(answer);\n    if (typeof _carSyncBtn === \"function\") _carSyncBtn();   // AFTER the read starts",
    replace: "    t.voice.speak(answer);   // AFTER the read starts",
    mustFail: "the head unit reads PLAYING while the character speaks (the reply)" },
  { label: "close keeps the talk host installed (Car Mode would run on the talk's rows afterwards)",
    find: "  closed: function() { var t = _talk; _talk = null; if (t && t.engine) t.engine.reset(); carSessionHost(CAR_HOST); },",
    replace: "  closed: function() { var t = _talk; _talk = null; if (t && t.engine) t.engine.reset(); },",
    mustFail: "close restores the game's host" }
]});

rc |= sabotage.prove({ file: "ui-carmode.js", command: SUITE, cases: [
  { label: "the game's Car Mode host swallows plain speech (a GM turn is never sent)",
    find: "  hear: function() { return false; },",
    replace: "  hear: function() { return true; },",
    mustFail: "the game's host leaves plain speech to stt.js" }
]});

rc |= sabotage.prove({ file: "car-session.js", command: SUITE, cases: [
  { label: "the loop stops offering plain speech to the host (a talk hears nothing)",
    find: "  if (!cmd) return !!_carHost.hear(text);",
    replace: "  if (!cmd) return false;",
    mustFail: "speech is consumed by the talk host" }
]});

/* the loop's own reads sync the head unit (defect B, the loop's half) — pinned by the transport suite */
rc |= sabotage.prove({ file: "car-session.js", command: ["node", ["dev/tests-19b-carmode-transport.js"]], cases: [
  { label: "the entry brief plays with the head unit reading PAUSED",
    find: "V.speak(brief); _carSetStatus(CAR_STR.narratorSpeaking); _carSyncBtn(); return; }",
    replace: "V.speak(brief); _carSetStatus(CAR_STR.narratorSpeaking); return; }",
    mustFail: "the head unit reads PLAYING during the brief" }
]});

rc |= sabotage.prove({ file: "ui-boot.js", command: SUITE, cases: [
  { label: "the Talk to… row leaves the File menu",
    find: "    h+=g?btn(p+\"talk\",\"&#128483; Talk to&hellip;\",0):btn(null,\"&#128483; Talk to&hellip;\",0,{dim:true});",
    replace: "",
    mustFail: "the Talk to… row" }
]});

process.exit(rc);
