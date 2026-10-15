// car-commands.js — the spoken Car Mode grammar (#631, the Car Mode seam). PORTABLE: this file names nothing outside itself
// and the ECMAScript builtins (dev/tests-631-car-seam.js derives that from the source). It knows how an utterance is heard,
// not what a host does with it.
//
// The vocabulary is a TABLE, not a regex chain: an ordered list of { kind, say: [anchored regexes] } entries handed to
// parseCarCommand by the host. The first entry whose regex matches the WHOLE normalized utterance wins; the pick grammar
// (ordinals, "option N", "last") rides every table after it. The generic car words live here as named entries so a host
// composes its own table from them plus its own kinds — the game's is CAR_COMMANDS (game.js), read by the loop through
// CAR_HOST.commands(); a host with no kinds of its own passes CAR_COMMANDS_BASE. carHoldDispatch is the pure pause/resume
// table the loop executes (#410); parseConfirmCommand is the #77 confirm vocabulary stt.js routes a pending read-back on.
//
// Moved out of helpers.js by #631 (2026-10-14) byte-for-byte in behaviour; the owner rulings inside are the record as written.

// THE FALSE-POSITIVE RULE: a command must be the WHOLE utterance, never a substring. "I attack the
// second guard" and "repeat the ritual" are ACTIONS — matching a bare /second|repeat/ anywhere in
// the transcript would silently eat real turns, which is far worse than missing a command (the
// driver just repeats themselves). So every pattern below is anchored ^…$ over the trimmed,
// punctuation-stripped text, with only a short filler prefix ("uh", "let's", "I'll take") allowed.
var CAR_CMD_FILLER = /^(?:uh+|um+|ok(?:ay)?|so|well|hey|please|lets|i(?:ll| will| want to| wanna)?(?: take| do| pick| choose| go with)?|give me|do|take|pick|choose|go with|the)\s+/;
var CAR_ORDINALS = { one: 1, two: 2, three: 3, four: 4, first: 1, second: 2, third: 3, fourth: 4, "1": 1, "2": 2, "3": 3, "4": 4 };

// The generic car vocabulary — one named entry per kind, so a host's table can interleave its own kinds between them.
// full-scene replay must be tested BEFORE the options replay — "repeat everything" also starts with "repeat", and the more
// specific phrase has to win (the base order below keeps it first; a host's table must too).
var CAR_CMD_REPEAT_ALL = { kind: "repeatAll", say: [
  /^(?:repeat|read|say|play)\s+(?:it\s+|that\s+|the\s+)?(?:everything|all|scene|story|narration|again from the start)$/,
  /^(?:repeat|read)\s+everything$/,
  /^everything again$/
] };
/* #410: a spoken PAUSE / RESUME (owner vocabulary 2026-09-14: "stop" is too common a word). Anchored like everything
   else — "I pause at the door" is an action; bare "continue" is NOT a command because "continue" alone is a plausible
   action (keep walking), so the resume side is resume / unpause / GM resume / GM continue. What pause DOES is decided
   by carHoldDispatch below, not here. */
var CAR_CMD_PAUSE  = { kind: "pause",  say: [ /^(?:gm )?pause$/ ] };
var CAR_CMD_RESUME = { kind: "resume", say: [ /^(?:gm )?(?:resume|unpause)$|^gm continue$/ ] };
var CAR_CMD_REPEAT = { kind: "repeat", say: [
  /^(?:repeat|again|say again|repeat that|say that again|read again|read that again|one more time)$/,
  /^(?:what are )?(?:my )?(?:the )?(?:options|choices)(?: again)?$/,
  /^repeat (?:the )?(?:options|choices)$/
] };
var CAR_COMMANDS_BASE = [CAR_CMD_REPEAT_ALL, CAR_CMD_PAUSE, CAR_CMD_RESUME, CAR_CMD_REPEAT];

// Returns {kind:"pick",n} (1-based) | {kind:<an entry's kind>} | null. `table` is REQUIRED — a host that forgets it hears nothing
// silently otherwise, and silence is the one failure Car Mode must never have.
function parseCarCommand(text, optionCount, table) {
  if (!table || typeof table.length !== "number") throw new Error("parseCarCommand: a command table is required (CAR_COMMANDS_BASE, or the host's own)");
  var t = String(text == null ? "" : text).toLowerCase();
  // apostrophes are DELETED, not spaced — spacing them splits "let's"→"let s" and "I'll"→"I ll",
  // which is exactly the filler the strip below is trying to remove
  t = t.replace(/['’]/g, "").replace(/[.,!?;:"”“]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (!t) return null;
  var prev = null, guard = 0;
  while (t !== prev && guard++ < 4) { prev = t; t = t.replace(CAR_CMD_FILLER, ""); }   // strip stacked filler
  // "the second one" → "second". Anchored to ORDINALS only: a blanket /\s+one$/ strip would turn
  // "choice one" into "choice" and lose a legitimate pick.
  t = t.replace(/^(first|second|third|fourth|last)\s+one$/, "$1");
  if (!t) return null;
  var i, j, entry;
  for (i = 0; i < table.length; i++) {
    entry = table[i];
    for (j = 0; j < entry.say.length; j++) if (entry.say[j].test(t)) return { kind: entry.kind };
  }
  var n = null, m;
  if (CAR_ORDINALS[t] !== undefined) n = CAR_ORDINALS[t];
  else if ((m = /^(?:option|number|choice)\s+(\w+)$/.exec(t)) && CAR_ORDINALS[m[1]] !== undefined) n = CAR_ORDINALS[m[1]];
  else if (/^last$/.test(t)) n = optionCount || 0;
  if (!n) return null;
  if (optionCount && n > optionCount) return null;   // "four" with 3 options is not a pick — let it be an action
  return { kind: "pick", n: n };
}
// #410 — what a spoken PAUSE or RESUME does, as a pure table over the moment it arrives. The Car Mode
// mic opens only AFTER narration (auto-mic on TTS done), so a spoken "pause" can almost never reach a
// playing narrator — the tap and the steering-wheel button already do that. What the word CAN do is
// HOLD the session: close the mic and stop the auto-mic loop re-opening it after every turn (the
// car-park case), until "resume" or a tap. When narration IS playing (cloud STT text arriving late),
// pause maps onto the existing TTS pause toggle, exactly as the tap does.
//   cmdKind: "pause" | "resume";  st: { ttsPlaying, ttsPaused, held }
//   → { op: "ttsPause" | "hold" | "ttsResume" | "release" | "noop", held: bool, status: key of CAR_STR | null }
// car-session.js executes op; ambience (Astra's pilot) subscribes to the "tnd:car-intent" event the
// executor dispatches — pause ends ambience, the next narration start brings it back (owner ruling 1).
function carHoldDispatch(cmdKind, st) {
  var s = st || {};
  if (cmdKind === "pause") {
    if (s.ttsPlaying) return { op: "ttsPause", held: true, status: "paused" };
    return { op: "hold", held: true, status: "pausedHold" };
  }
  if (cmdKind === "resume") {
    if (s.ttsPaused) return { op: "ttsResume", held: false, status: "narratorSpeaking" };
    if (s.held) return { op: "release", held: false, status: "listening" };
    return { op: "noop", held: false, status: "nothingPaused" };
  }
  return { op: "noop", held: !!s.held, status: null };
}
// #77 Layer-2 confirm vocabulary — SAME false-positive discipline as parseCarCommand above:
// whole utterance, anchored ^…$, filler-stripped. "no time to lose" and "yes and I draw my
// sword" are ACTIONS. "again"/"repeat" are safe to claim here because a pending confirmation
// OWNS the utterance (the #78 menu grammar is never consulted while one is pending — the
// interceptor order in stt.js is pinned by the #77 CONFIRM GATE contract in run-tests.js).
// Returns "yes" | "no" | "redo" | "repeat" | null.
function parseConfirmCommand(text) {
  var t = String(text == null ? "" : text).toLowerCase();
  t = t.replace(/['’]/g, "").replace(/[.,!?;:"”“]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (!t) return null;
  var prev = null, guard = 0;
  while (t !== prev && guard++ < 4) { prev = t; t = t.replace(CAR_CMD_FILLER, ""); }
  if (!t) return null;
  if (/^(?:yes|yeah|yep|yup|aye|correct|right|thats right|that is right|confirm|send|send it|yes send it|go ahead|sure)$/.test(t)) return "yes";
  if (/^(?:no|nope|nah|cancel|dont|dont send|dont send it|discard|drop it|never mind|nevermind|scratch that|forget it)$/.test(t)) return "no";
  if (/^(?:redo|retry|try again|again|start over|re do|new take)$/.test(t)) return "redo";
  if (/^(?:repeat|repeat it|say again|what|what did you hear|read it back)$/.test(t)) return "repeat";
  return null;
}
