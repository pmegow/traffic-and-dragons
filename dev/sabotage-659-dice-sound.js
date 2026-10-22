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
  { label: "a brush ticks like a landing",
    find: "if (!(v >= DICE_SOUND_HIT_MIN)) continue;", replace: "if (false) continue;",
    mustFail: "must not tick" },
  { label: "every landing is equally loud",
    find: "g: DICE_SOUND_GAIN.hit * loud,", replace: "g: DICE_SOUND_GAIN.hit,",
    mustFail: "a harder landing must be louder" },
  { label: "a soft landing thuds too",
    find: "if (v >= DICE_SOUND_THUD_MIN) notes.push(", replace: "notes.push(",
    mustFail: "a soft landing must not thud" },
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
    find: "4: { f: 3400, q: 1.6, tip: 1.911 },", replace: "4: { f: 1500, q: 1.6, tip: 1.911 },",
    mustFail: "a d4 must click above a d20" },
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
prove("sw.js", [
  { label: "the app shell drops dice-sound.js",
    find: "  \"/dice-sound.js\",\n", replace: "",
    mustFail: "ride the SW app shell" }
]);
process.exit(code);
