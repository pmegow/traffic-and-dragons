// dev/sabotage-659-dice-sound.js — proves the #659 guards (the sound of a die roll — a recording placed by what the die
// did): the motion read off the record, the nearest take, the landing alignment, the partway start, the offset, the sample
// note's position, the fit check, the two said-once paths, the force flag, sound.js's sample shape, the sound played inside
// the clip's play() promise, the preload at game start and on the review page, the three files in the load order, the app
// shell and the SW's sprite path must each turn the #659 section red.
//   node dev/sabotage-659-dice-sound.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#659"]], LOADER = ["node", ["dev/tests-659-dice-loader.js"]];
var code = 0;
function prove(file, cases, cmd) { if (!code) code = sabotage.prove({ file: file, command: cmd || CMD, cases: cases }); }
/* the loader (v1.1315: the live context must never be born in the preload) — proven through its own async suite */
prove("dice-sound.js", [
  { label: "the preload decodes on the live context (born suspended before a gesture)",
    find: "  var ctx = diceSoundDecoder();\n  if (!ctx || typeof ctx.decodeAudioData !== \"function\")", replace: "  var ctx = Sound.context();\n  if (!ctx || typeof ctx.decodeAudioData !== \"function\")",
    mustFail: "NEVER create or touch the live AudioContext" },
  { label: "a second preload in flight starts a second load",
    find: "  if (_diceSfx.loading) return _diceSfx.loading;\n  var man", replace: "  var man",
    mustFail: "share the first's promise" },
  { label: "a load failure is said but never reported",
    find: "  if (detail && typeof reportError === \"function\") reportError(\"dice-sfx\", msg, detail);\n", replace: "",
    mustFail: "said once and reported once" },
  { label: "every retry of a failed load mails the owner again",
    find: "  if (_diceSfx.said[key]) return;\n  _diceSfx.said[key] = true;\n  if (typeof console !== \"undefined\") console.warn(\"[dice-sound] \" + msg);\n  if (detail", replace: "  if (_diceSfx.said[key]) { if (detail && typeof reportError === \"function\") reportError(\"dice-sfx\", msg, detail); return; }\n  _diceSfx.said[key] = true;\n  if (typeof console !== \"undefined\") console.warn(\"[dice-sound] \" + msg);\n  if (detail",
    mustFail: "said once, not every call" },
  { label: "a misfit decode is adopted anyway",
    find: "    _diceSfx.failed = bad; diceSoundSay(\"fit\", bad, { duration: buffer && buffer.duration });\n    return false;", replace: "    _diceSfx.failed = bad; diceSoundSay(\"fit\", bad, { duration: buffer && buffer.duration });\n    _diceSfx.buffer = buffer; return false;",
    mustFail: "never adopted" }
], LOADER);
prove("dice-sound.js", [
  { label: "the motion ignores the rolling stretches",
    find: "for (i = 0; i < cue.roll.length; i++) if (cue.roll[i][1] > last) last = cue.roll[i][1];", replace: "",
    mustFail: "end of the rolling stretch" },
  { label: "the first take wins whatever its length",
    find: "if (Math.abs(takes[i].length - length) < Math.abs(takes[best].length - length)) best = i;", replace: "if (false) best = i;",
    mustFail: "nearest the motion's length" },
  { label: "the later take wins a tie",
    find: "if (Math.abs(takes[i].length - length) < Math.abs(takes[best].length - length)) best = i;", replace: "if (Math.abs(takes[i].length - length) <= Math.abs(takes[best].length - length)) best = i;",
    mustFail: "earlier take wins a tie" },
  { label: "the take starts at the clip's landing, its own landing forgotten",
    find: "start = off + motion.landing - take.landing, into = 0;", replace: "start = off + motion.landing, into = 0;",
    mustFail: "landing falls on the clip's" },
  { label: "an early clip landing clamps the start instead of starting partway in",
    find: "if (start < 0) { into = -start; start = 0; }", replace: "if (start < 0) { start = 0; }",
    mustFail: "starts the take partway in" },
  { label: "the offset is dropped",
    find: "off = offset > 0 ? offset : 0,", replace: "off = 0,",
    mustFail: "offset delays the start" },
  { label: "the sample note plays from the sprite's start",
    find: "notes: [{ type: \"sample\", t: p.at, d: p.d, from: p.from, buffer: buffer, g: 1, role: \"take\" }]", replace: "notes: [{ type: \"sample\", t: p.at, d: p.d, from: 0, buffer: buffer, g: 1, role: \"take\" }]",
    mustFail: "from its position" },
  { label: "the fit check passes a sprite the cut list runs past",
    find: "if (!(takes[i].cut && takes[i].cut[1] <= buffer.duration + DICE_SFX_FIT_SLACK))", replace: "if (false)",
    mustFail: "refused naming the take" },
  { label: "a missing take nags every roll",
    find: "  if (_diceSfx.said[key]) return;\n  _diceSfx.said[key] = true;", replace: "  if (false) return;",
    mustFail: "said once, not every roll" },
  { label: "a roll before the load plays silent without a word",
    find: "    diceSoundSay(\"not-loaded\", \"the dice sprite is not loaded (\" + (_diceSfx.failed || \"still loading\") + \") — this roll plays silent\");\n", replace: "",
    mustFail: "say so once and play silent" },
  { label: "the audition's force never reaches Sound.play",
    find: "return Sound.play(diceSoundRecipe(sides, face, offset, _diceSfx.buffer), !!force);", replace: "return Sound.play(diceSoundRecipe(sides, face, offset, _diceSfx.buffer));",
    mustFail: "force must reach Sound.play" }
]);
prove("sound.js", [
  { label: "Sound.play refuses a recipe object",
    find: "var recipe = (id && typeof id === \"object\" && id.notes) ? id : SOUND_LIB[id];", replace: "var recipe = SOUND_LIB[id];",
    mustFail: "a recipe object must not be an unknown id" },
  { label: "the sample shape is gone",
    find: "    if (note.type === \"sample\") { _sample(ctx, bus, st, note); return; }\n", replace: "",
    mustFail: "schedule a sample note" },
  { label: "the sample plays from the sprite's start for its whole length",
    find: "src.start(st, note.from || 0, note.d);", replace: "src.start(st);",
    mustFail: "schedule a sample note" }
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
prove("ui-shell.js", [
  { label: "the game never preloads the sprite",
    find: "  if(typeof DiceSound!==\"undefined\")DiceSound.preload();", replace: "",
    mustFail: "showGame must preload" }
]);
prove("index.html", [
  /* a script tag gone from index.html is caught before any test runs: CLAUDE.md's load order no longer matches (the
     DOC FACTS CONTRACT, run first) — the #659 wiring test is the second guard */
  { label: "dice-sound.js is not loaded",
    find: "<script src=\"dice-sound.js\"></script>\n", replace: "",
    mustFail: "DOC FACTS CONTRACT" },
  { label: "the clip manifest is not loaded",
    find: "<script src=\"dice/manifest.js\"></script>\n", replace: "",
    mustFail: "DOC FACTS CONTRACT" },
  { label: "the sprite receipt is not loaded",
    find: "<script src=\"dice/sfx/manifest.js\"></script>\n", replace: "",
    mustFail: "DOC FACTS CONTRACT" }
]);
prove("dev/dice-review.html", [
  { label: "the review page's click goes silent",
    find: "var ok=DiceSound.play(sides,n,0,true);", replace: "var ok=true;",
    mustFail: "must sound through DiceSound.play with force" },
  { label: "the click no longer wakes the live context",
    find: "v.onclick=function(){if(v.paused){unlock();start();}else v.pause();};", replace: "v.onclick=function(){if(v.paused){start();}else v.pause();};",
    mustFail: "INSIDE the click" },
  { label: "a waking context plays before its resume resolves",
    find: "if(ctx&&ctx.state!==\"running\"&&typeof ctx.resume===\"function\")ctx.resume().then(go,function(e){note(\"audio refused for d\"+sides+\" \"+n+\": \"+(e&&e.message||e));});else go();", replace: "go();",
    mustFail: "after its resume resolves" },
  { label: "the review page never preloads the sprite",
    find: "if(typeof DiceSound!==\"undefined\")DiceSound.preload({base:\"../\"})", replace: "if(false)DiceSound.preload({base:\"..\"})",
    mustFail: "preload the sprite from its own folder" }
]);
prove("sw.js", [
  { label: "the app shell drops the sprite receipt",
    find: "  \"/dice/sfx/manifest.js\",\n", replace: "",
    mustFail: "ride the SW app shell" },
  { label: "the SW forgets the sprite",
    find: "|sfx\\/dice-rolls-v\\d+\\.mp3)$/.test(new URL(e.request.url).pathname)", replace: ")$/.test(new URL(e.request.url).pathname)",
    mustFail: "keep the sprite in DICE_CACHE" }
]);
process.exit(code);
