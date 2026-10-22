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
    find: "    _talkLine(t.name, answer);\n    carNotify(\"response\", answer);",
    replace: "    _talkLine(t.name, answer); worldState.lastNarration = answer;\n    carNotify(\"response\", answer);",
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

/* #639 (owner 2026-10-15): the frames — a talk opens off-stage; "step into the story" / "step out of the story" move it */
rc |= sabotage.prove({ file: "companion-talk.js", command: SUITE, cases: [
  { label: "#639 the talk opens inside the story again (the owner's off-stage default reverted)",
    find: "var TALK_FRAME_DEFAULT = \"offstage\";",
    replace: "var TALK_FRAME_DEFAULT = \"moment\";",
    mustFail: "the owner's ruling: open off-stage" },
  { label: "#639 the off-stage frame drops the AI line (a character who knows they are in a tale is one step from 'I am a program')",
    find: "    .concat([\"- Break character to discuss rules, the app or being an AI — decline in character instead.\"]);",
    replace: "    .concat(frame === TALK_FRAMES.offstage ? [] : [\"- Break character to discuss rules, the app or being an AI — decline in character instead.\"]);",
    mustFail: "the AI line closes the block in both frames" },
  { label: "#639 the off-stage frame rewrites the HOW YOU SPEAK rules (two personalities, not one character in two frames)",
    find: "    \"- End cleanly so the player can answer.\"];",
    replace: "    \"- End cleanly so the player can answer.\"].concat(frame === TALK_FRAMES.offstage ? [\"- Narrate freely.\"] : []);",
    mustFail: "the knowledge, the voice rules and the shared must-nots are the same in both frames" },
  { label: "#639 a frame move no longer swaps the persona on the engine (the character keeps answering in the old frame)",
    find: "  t.engine.persona(talkPersona(t.sheet, t.ctx, id));\n",
    replace: "",
    mustFail: "the engine's persona is the in-the-story frame now" },
  { label: "#639 a frame move resets the conversation (the character forgets what was just said)",
    find: "  t.engine.persona(talkPersona(t.sheet, t.ctx, id));\n",
    replace: "  t.engine.persona(talkPersona(t.sheet, t.ctx, id)); t.engine.reset();\n",
    mustFail: "the kept exchange survives the move" },
  { label: "#639 the move is said in the character's voice (fabricated words in their mouth)",
    find: "  if (typeof TTS !== \"undefined\" && typeof TTS.speak === \"function\") TTS.speak(fr.enterLine(t.name));   // the NARRATOR's voice",
    replace: "  t.voice.speak(fr.enterLine(t.name));",
    mustFail: "the NARRATOR says the move, never the character" },
  { label: "#639 the host hands the loop the base vocabulary only (the moves are speech for the character)",
    find: "  commands: function() { return TALK_COMMANDS; },",
    replace: "  commands: function() { return CAR_COMMANDS_BASE; },",
    mustFail: "the host hands the loop its own table" },
  { label: "#639 the way in matches a substring (\"I want to step into the story later\" would move the frame)",
    find: "/^(?:(?:step|go|come|get) )?(?:back )?in(?:to)? the story$/",
    replace: "/(?:(?:step|go|come|get) )?(?:back )?in(?:to)? the story/",
    mustFail: "a sentence that contains the line is speech" },
  { label: "#639 the overlay stops showing the frame",
    find: "vit.textContent = \"Talking with you · \" + TALK_FRAMES[t.frame].label + (t.frame === \"moment\" && worldState && worldState.world && worldState.world.location ? \" · \" + worldState.world.location : \"\");",
    replace: "vit.textContent = \"Talking with you\" + (worldState && worldState.world && worldState.world.location ? \" · \" + worldState.world.location : \"\");",
    mustFail: "off-stage: no place on the overlay" }
]});

rc |= sabotage.prove({ file: "ui-carmode.js", command: SUITE, cases: [
  { label: "the game's Car Mode host swallows plain speech (a GM turn is never sent)",
    find: "  hear: function() { return false; },",
    replace: "  hear: function() { return true; },",
    mustFail: "the game's host leaves plain speech to stt.js" }
]});

rc |= sabotage.prove({ file: "car-session.js", command: SUITE, cases: [
  { label: "the loop stops offering plain speech to the host (a talk hears nothing)",
    find: "  if (!cmd) return _carSpeech(text);",
    replace: "  if (!cmd) return false;",
    mustFail: "speech is consumed by the talk host" }
]});

/* #636 (owner 2026-10-15): the exchange on the overlay — the talk's half */
rc |= sabotage.prove({ file: "companion-talk.js", command: SUITE, cases: [
  { label: "#636 the talk's reply never reaches the overlay (the player hears it but cannot glance at it)",
    find: "    carNotify(\"response\", answer);           // the ready earcon; the reply on the overlay while it is read (#636); a stale tap-to-retry arm dropped",
    replace: "    carNotify(\"response\");",
    mustFail: "#636 the reply on the overlay while it is read" },
  { label: "#636 the reply keeps a stale tap-to-retry arm (the pre-#636 earcon path: a later idle tap asks the line a second time)",
    find: "    carNotify(\"response\", answer);           // the ready earcon; the reply on the overlay while it is read (#636); a stale tap-to-retry arm dropped",
    replace: "    t.voice.earcon(\"ready\"); _carSetSaid(answer);",
    mustFail: "the reply drops the arm" }
]});
/* #636 — the loop's half, pinned by the transport suite */
rc |= sabotage.prove({ file: "car-session.js", command: ["node", ["dev/tests-19b-carmode-transport.js"]], cases: [
  { label: "#636 the loop stops showing the player's words",
    find: "  _carSetHeard(text);\n  return !!_carHost.hear(text);",
    replace: "  return !!_carHost.hear(text);",
    mustFail: "#636 the player's words on the overlay" },
  { label: "#636 a pick shows nothing (the player hears 'two', the overlay says nothing about what was chosen)",
    find: "  _carSetHeard(pick);   // #636: the option's words, not the number — that is what the turn answers\n",
    replace: "",
    mustFail: "#636 a pick paints the option's words" },
  { label: "#636 the heard line survives into the next listen (stale words while the player speaks new ones)",
    find: "      if (!(typeof M.isConfirmPending === \"function\" && M.isConfirmPending())) _carSetHeard(\"\");\n",
    replace: "",
    mustFail: "#636 the next listen clears the heard line" },
  { label: "#636 the reply line ignores the text it is handed",
    find: "    _carSetSaid(text || \"\");   // #636: a host that hands the reply's text shows it while it is read (the talk); the game passes none\n",
    replace: "",
    mustFail: "#636 the reply on the overlay" },
  { label: "#636 a new utterance leaves the old reply on screen",
    find: "  if (text) _carSetSaid(\"\");   // a new exchange begins\n",
    replace: "",
    mustFail: "#636 a new utterance clears the reply" },
  { label: "#636 the exchange outlives the overlay (the next host inherits it)",
    find: "  _carSetHeard(\"\"); _carSetSaid(\"\");   // #636 — nor the last exchange (the next host must not inherit it)\n",
    replace: "",
    mustFail: "#636 the exchange clears with the overlay" }
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
