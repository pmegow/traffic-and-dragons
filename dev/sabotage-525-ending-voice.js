// dev/sabotage-525-ending-voice.js — proves the #525 guards are guarded. The campaign ending is written to "you" (owner
// rulings 2026-10-01; game words and modern idiom belong to the campaign's chosen voice), and its last line, "RECORD: <one
// third-person sentence naming the hero>", is the defining moment the party carries. Before, the closing paragraph was
// filed in the prose's own person: The Princess put the hero's "I spent nineteen levels…" on four sheets. Each mutation
// runs in a disposable clone.
//   node dev/sabotage-525-ending-voice.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#525"]], SCREEN = ["node", ["dev/tests-525-ending-screen.js"]];
var code = 0;
function prove(file, cases, cmd) { if (!code) code = sabotage.prove({ file: file, command: cmd || CMD, cases: cases }); }
var PROMPT = "both ending prompts", SPLIT = "denouementSplit takes the RECORD line", REPRO = "the repro", FALL = "no RECORD line", HEAL = "the heal:", LOAD = "the load path runs the heal";
prove("api.js", [
  { label: "the death ending no longer asks for the second person",
    find: "300-500 words.\"+DENOUEMENT_VOICE_RULE+\" Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. End on the world", replace: "300-500 words. Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. End on the world",
    mustFail: PROMPT },
  { label: "the told-tale ending no longer asks for the second person",
    find: "300-500 words.\"+DENOUEMENT_VOICE_RULE+\" Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. The hero lives", replace: "300-500 words. Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. The hero lives",
    mustFail: PROMPT },
  { label: "game words and modern idiom are allowed whatever the voice",
    find: "and modern idiom only if the VOICE below calls for them; otherwise use none.", replace: "and modern idiom freely.",
    mustFail: PROMPT },
  { label: "the endings no longer ask for the RECORD line",
    find: "var DENOUEMENT_RECORD_RULE=\" After the prose, on its own final line, write \\\"RECORD: \\\" and ONE plain sentence in the third person, past tense, naming the hero by name,", replace: "var DENOUEMENT_RECORD_RULE=\" Then stop. Add nothing after the prose,",
    mustFail: PROMPT }
]);
prove("helpers.js", [
  { label: "the RECORD line is never found",
    find: "if(!L[i].trim())continue;m=L[i].match(", replace: "if(!L[i].trim())continue;m=null&&L[i].match(",
    mustFail: SPLIT },
  { label: "a closing sentence that says 'record:' is taken for the line",
    find: "m=L[i].match(/^[\\s*_`>#]*record", replace: "m=L[i].match(/[\\s*_`>#]*record",
    mustFail: SPLIT },
  { label: "the RECORD line stays in the prose (shown, read aloud, transcribed)",
    find: "  L.splice(i,1);\n  return {prose:L.join(\"\\n\").trim(),record:m[1].trim()};", replace: "  return {prose:L.join(\"\\n\").trim(),record:m[1].trim()};",
    mustFail: SPLIT },
  { label: "a text that never names the hero is filed bare (a companion carries 'You…' as her own)",
    find: "  return w+\"'s ending: \"+t;", replace: "  return t;",
    mustFail: FALL },
  { label: "a moment that names the hero is prefixed anyway",
    find: "  if(new RegExp(\"\\\\b\"+first+\"\\\\b\").test(t))return t;\n", replace: "",
    mustFail: REPRO },
  { label: "the heal rewrites other kinds of moment",
    find: "    if(!m||m.kind!==\"ending\"||!m.who||typeof m.text!==\"string\")return;", replace: "    if(!m||!m.who||typeof m.text!==\"string\")return;",
    mustFail: HEAL },
  { label: "the heal skips the companions' sheets",
    find: "  var sheets=[ws.character],i;for(i=0;i<(ws.npcs||[]).length;i++)if(ws.npcs[i]&&ws.npcs[i].charSheet)sheets.push(ws.npcs[i].charSheet);\n  sheets.forEach(function(cs){if(!cs)return;(cs.coreMemories||[]).forEach(function(m){", replace: "  var sheets=[ws.character],i;\n  sheets.forEach(function(cs){if(!cs)return;(cs.coreMemories||[]).forEach(function(m){",
    mustFail: HEAL }
]);
prove("game.js", [
  { label: "the moment is the closing paragraph in the prose's own person again (the reported defect)",
    find: "  if(_rec&&typeof fileCoreMemory===\"function\")fileCoreMemory(\"ending\",_hero,_rec);", replace: "  var _p2=t.split(/\\n\\s*\\n/);if(typeof fileCoreMemory===\"function\")fileCoreMemory(\"ending\",_hero,String(_p2[_p2.length-1]||\"\").trim().slice(0,240));",
    mustFail: REPRO },
  { label: "the transcript and the chapter keep the RECORD line",
    find: "var _ds=denouementSplit(text),t=_ds.prose;if(!t)return \"\";", replace: "var _ds=denouementSplit(text),t=String(text||\"\").trim();if(!t)return \"\";",
    mustFail: REPRO },
  { label: "the hero's fate line stays empty under a second-person ending",
    find: "line:line(sheet.name)||fallback||\"\",", replace: "line:line(sheet.name),",
    mustFail: REPRO },
  { label: "with no RECORD line the closing paragraph is filed bare",
    find: "_rec=_lastP?endingMomentText(_hero,snippetAtSentence(_lastP,220)):\"\";", replace: "_rec=_lastP?snippetAtSentence(_lastP,220):\"\";",
    mustFail: FALL },
  { label: "a missing RECORD line is silent",
    find: "if(typeof console!==\"undefined\")console.warn(\"[denouement] the ending carried no RECORD line", replace: "if(false)console.warn(\"[denouement] the ending carried no RECORD line",
    mustFail: FALL },
  { label: "a long record sentence is filed whole",
    find: "_rec=_ds.record?snippetAtSentence(endingMomentText(_hero,_ds.record),240):\"\";", replace: "_rec=_ds.record?endingMomentText(_hero,_ds.record):\"\";",
    mustFail: FALL }
]);
prove("game.js", [
  { label: "the screen and the voice get the raw reply, RECORD line and all",
    find: "var _df=denouementFrame(_shown||text);", replace: "var _df=denouementFrame(text);",
    mustFail: "the screen shows the prose" }
], SCREEN);
prove("state.js", [
  { label: "the load path never runs the heal",
    find: "if(typeof healEndingMoments===\"function\"){var _hem=healEndingMoments(worldState);", replace: "if(false){var _hem=healEndingMoments(worldState);",
    mustFail: LOAD }
]);
process.exit(code ? 1 : 0);
