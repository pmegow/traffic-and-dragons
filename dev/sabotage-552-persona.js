// dev/sabotage-552-persona.js — proves the #552 guards are guarded (owner 2026-10-02: a character keeps their
// personality between campaigns — verbatim voice lines + a manner line, captured at Save to library, served wherever
// the sheet reaches the GM). Each mutation runs in a disposable clone.
//   node dev/sabotage-552-persona.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#552 the portable persona"]];

rc |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "another speaker's lines are taken too (the speaker map is ignored)",
    find: "var mine=!!(u&&who&&want[who]);", replace: "var mine=!!(u&&who);",
    mustFail: "Thessa's line was taken" },
  { label: "a comma-split span is no longer joined back into one line",
    find: "if(mine&&cur&&cur.spk===u.spk&&cur.last===j-1){if(!cur.verbatim)cur.text+=\" \"+u.text;cur.last=j;continue;}", replace: "",
    mustFail: "was not joined back from the units" },
  { label: "aliases stop counting as the character",
    find: "[name].concat(aliases||[]).forEach", replace: "[name].forEach",
    mustFail: "the alias (the healer) was not honoured" },
  { label: "a one-word line counts as speech worth carrying",
    find: "if(words<3||text.length>PERSONA_LINE_CHARS)continue;", replace: "if(text.length>PERSONA_LINE_CHARS)continue;",
    mustFail: "a one-word line is not speech worth carrying" },
  { label: "a repeated line is carried twice",
    find: "if(seen[key])continue;seen[key]=1;", replace: "seen[key]=1;",
    mustFail: "the repeated line must appear once" },
  { label: "the hero is captured like a resident",
    find: "var hero=ws.character;if(hero&&(sheet===hero||(hero.name&&String(hero.name).toLowerCase()===String(sheet.name).toLowerCase())))return sheet;", replace: "",
    mustFail: "the hero was captured" },
  { label: "a quiet cameo (too few lines) erases the carried voice",
    find: "if(picked.length<PERSONA_LINES_MIN){", replace: "if(false){",
    mustFail: "a quiet cameo erased the carried voice" },
  { label: "the camp stamp is dropped from a captured line",
    find: "sheet.voiceLines=picked.map(function(l){return {text:l.text,turn:l.turn,camp:camp};});", replace: "sheet.voiceLines=picked.map(function(l){return {text:l.text,turn:l.turn};});",
    mustFail: "a voice line lacks its camp stamp" },
  { label: "voiceLines leave the camp-stamped walk",
    find: "\"motivationHistory\",\"voiceLines\"/* #552 */]", replace: "\"motivationHistory\"]",
    mustFail: "voiceLines must ride CAMP_STAMPED_LISTS" },
  { label: "the renderer serves every line instead of the last three",
    find: ".slice(-PERSONA_SERVE_LINES):[];", replace: ":[];",
    mustFail: "more than the last three lines were served" },
  { label: "a blank manner line serves anyway",
    find: "if(typeof cs.manner===\"string\"&&cs.manner.replace(/\\s+/g,\"\"))bits.push", replace: "if(typeof cs.manner===\"string\")bits.push",
    mustFail: "a blank manner line must not serve" }
]});
rc |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the present resident's roster line loses the voice",
    find: "        if(typeof personaPromptBits===\"function\")Array.prototype.push.apply(npcBits,personaPromptBits(_pcs));", replace: "",
    mustFail: "the present resident's voice is missing from the roster" },
  { label: "the companion block loses the voice",
    find: "var _pb=(typeof personaPromptBits===\"function\")?personaPromptBits(cs):[];", replace: "var _pb=[];",
    mustFail: "the party member's voice is missing from the companion block" }
]});
process.exit(rc ? 1 : 0);
