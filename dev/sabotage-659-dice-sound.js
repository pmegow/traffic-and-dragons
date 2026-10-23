// dev/sabotage-659-dice-sound.js — proves the #659 guards (the sound of a die roll): the brush floor, the loudness by
// landing speed, the thud under a hard landing, the taps spaced by the die's tip angle, the offset, the sorted notes,
// the small-die brightness, the recipe object through Sound.play, the missing-record warning said once, the sound
// played inside the clip's play() promise and the two files in the load order, the app shell and the engine manifest
// must each turn the #659 section red.
//   node dev/sabotage-659-dice-sound.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#659"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("dice-sound.js", [
  { label: "a brush clacks like a landing",
    find: "if (!(v >= DICE_SOUND_HIT_MIN)) continue;", replace: "if (false) continue;",
    mustFail: "must not clack" },
  { label: "every landing is equally loud",
    find: 'diceSoundClack(notes, t, DICE_SOUND_GAIN.hit * loud, tone, 1, 1, "hit");', replace: 'diceSoundClack(notes, t, DICE_SOUND_GAIN.hit, tone, 1, 1, "hit");',
    mustFail: "a harder landing must be louder" },
  { label: "a soft landing thumps and settles too (the second, soft hit's cascade breaks the first one's order — the cascade check fires before the soft-landing check)",
    find: "if (v >= DICE_SOUND_THUD_MIN) {", replace: "if (true) {",
    mustFail: "settles in a cascade" },
  { label: "the landing loses its body",
    find: "  for (i = 0; i < DICE_SOUND_BODY.length; i++) {\n    var p = DICE_SOUND_BODY[i];", replace: "  for (i = 0; i < 0; i++) {\n    var p = DICE_SOUND_BODY[i];",
    mustFail: "the landing's body partials" },
  { label: "the settle cascade is one clack",
    find: "var n = Math.min(DICE_SOUND_SETTLE.gaps.length, 2 + Math.round(3 * s)), ts = t;", replace: "var n = 1, ts = t;",
    mustFail: "settles in a cascade" },
  { label: "the taps lose their pitch differences",
    find: "tone, 0.6, 0.94 + 0.12 * h2, \"tap\");", replace: "tone, 0.6, 1, \"tap\");",
    mustFail: "the taps must differ a little in pitch" },
  { label: "the taps lose their loudness differences",
    find: "* (0.75 + 0.5 * h1), tone, 0.6,", replace: "* 1, tone, 0.6,",
    mustFail: "the taps must differ a little in loudness" },
  { label: "the taps ignore the die's shape",
    find: "rate = w / tone.tip;", replace: "rate = w / 1.571;",
    mustFail: "an icosahedron clatters faster than a cube" },
  { label: "the offset is dropped",
    find: "off = offset > 0 ? offset : 0;", replace: "off = 0;",
    mustFail: "an offset must move every note" },
  { label: "the notes come unsorted",
    find: "notes.sort(function (a, b) { return a.t - b.t; });", replace: "",
    mustFail: "notes must come sorted" },
  { label: "the d4 clicks low",
    find: "4: { f: 1900, q: 0.9, tip: 1.911, body: 1.3 },", replace: "4: { f: 1200, q: 0.9, tip: 1.911, body: 1.3 },",
    mustFail: "a d4 must click above a d20" },
  { label: "the audition's force never reaches Sound.play",
    find: "return Sound.play(recipe, !!force);", replace: "return Sound.play(recipe);",
    mustFail: "force must reach Sound.play" },
  { label: "a missing record nags every roll",
    find: "if (!_diceSoundSaid[key] && typeof console !== \"undefined\") { _diceSoundSaid[key] = true;", replace: "if (typeof console !== \"undefined\") {",
    mustFail: "said once, not every roll" }
]);
prove("sound.js", [
  { label: "Sound.play refuses a recipe object",
    find: "var recipe = (id && typeof id === \"object\" && id.notes) ? id : SOUND_LIB[id];", replace: "var recipe = SOUND_LIB[id];",
    mustFail: "a recipe object must not be an unknown id" }
]);
prove("ui-dice.js", [
  { label: "the sound plays before the clip does",
    find: "      if(p&&typeof p.then===\"function\")p.then(function(){if(!closed&&it.die&&typeof DiceSound!==\"undefined\")DiceSound.play(it.die.sides,it.die.face,0);},",
    replace: "      if(it.die&&typeof DiceSound!==\"undefined\")DiceSound.play(it.die.sides,it.die.face,0);\n      if(p&&typeof p.then===\"function\")p.then(function(){},",
    mustFail: "must play inside the clip's play() promise" },
  { label: "the tiles forget their die",
    find: "videos.push({v:v,src:src,die:dice&&dice[i]});", replace: "videos.push({v:v,src:src});",
    mustFail: "each tile must carry its die" }
]);
prove("index.html", [
  /* a script tag gone from index.html is caught before any test runs: CLAUDE.md's load order no longer matches (the
     DOC FACTS CONTRACT, run first) — the #659 wiring test is the second guard */
  { label: "dice-sound.js is not loaded",
    find: "<script src=\"dice-sound.js\"></script>\n", replace: "",
    mustFail: "DOC FACTS CONTRACT" },
  { label: "the data file is not loaded",
    find: "<script src=\"dice/manifest.js\"></script>\n", replace: "",
    mustFail: "DOC FACTS CONTRACT" }
]);
prove("dev/dice-review.html", [
  { label: "the review page's click goes silent",
    find: "var ok=DiceSound.play(sides,n,0,true);", replace: "var ok=true;",
    mustFail: "must sound through DiceSound.play with force" }
]);
prove("sw.js", [
  { label: "the app shell drops dice-sound.js",
    find: "  \"/dice-sound.js\",\n", replace: "",
    mustFail: "ride the SW app shell" }
]);
process.exit(code);
