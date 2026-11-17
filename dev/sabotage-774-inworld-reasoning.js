// #774 Inworld reasoning rides every request — every guard proven by mutation in a disposable clone.
//   node dev/sabotage-774-inworld-reasoning.js
var sabotage=require('./sabotage.js'),code=0;
var ALSO=['dev/tests-402-character-voices.js'];
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',Array.isArray(command)?command:[command]],also:ALSO,cases:cases});}
var MUST='#774 every Inworld request asks the model to direct the line';
prove('tts.js',['dev/tests-402-character-voices.js'],[
 {label:'reasoning is switched off',find:'var out = { reasoning: "REASONING_ON" }, note',replace:'var out = { reasoning: "REASONING_UNSPECIFIED" }, note',mustFail:MUST},
 {label:'the instruction field comes back',find:'synthesisContext: _inworldReasoning(direction),',replace:'instruction: direction, synthesisContext: _inworldReasoning(direction),',mustFail:MUST},
 {label:'a saved model-level direction rides again',find:'return VOICE_MODELS[id].direction ? c.direction : "";',replace:'return c.direction;',mustFail:MUST},
 {label:'the character note is dropped',find:'if (note) out.reasoningContext = ',replace:'if (false) out.reasoningContext = ',mustFail:MUST},
 {label:'the note is no longer cut at 600',find:'.slice(0, INWORLD_REASONING_NOTE_MAX);',replace:';',mustFail:MUST},
 {label:'the sheet Test loses the character direction',find:'_voiceTest(d, TTS_TEST_LINE, actor, onPhase, Number(char.voiceRate) || 0, char.voiceDirection || "");',replace:'_voiceTest(d, TTS_TEST_LINE, actor, onPhase, Number(char.voiceRate) || 0);',mustFail:MUST},
 {label:'the audition ignores a uniform direction',find:'(voices.directions && voices.directions[i]) || voices.direction)) || "";',replace:'(voices.directions && voices.directions[i]))) || "";',mustFail:MUST},
 {label:'the Inworld entry declares a model-level direction again',find:' key: true,/* #774: no model-level',replace:' key: true, direction: true,/* #774: no model-level',mustFail:MUST}
]);
process.exit(code);
