// #781 Inworld narration is read plain; reasoning rides a character's lines only - every guard proven by mutation in a disposable clone.
//   node dev/sabotage-781-inworld-narrator-plain.js
var sabotage=require('./sabotage.js'),code=0;
var ALSO=['dev/tests-402-character-voices.js'];
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',Array.isArray(command)?command:[command]],also:ALSO,cases:cases});}
var MUST='#781 Inworld narration is read plain';
prove('tts.js',['dev/tests-402-character-voices.js'],[
 {label:'narration asks for reasoning again',find:'synthesisContext: g.cast ? _inworldReasoning(direction) : undefined,',replace:'synthesisContext: _inworldReasoning(direction),',mustFail:MUST},
 {label:'the grouper never marks a character line',find:'var cast = !!(useCast && voices && (voices[i] || voices.cast));',replace:'var cast = false;',mustFail:MUST},
 {label:'speech and narration on one actor share a group',find:' && !!cur.cast === cast && ',replace:' && ',mustFail:MUST},
 {label:'the reader caps drop the flag',find:'cast: !!(m && m.unitCast)/* #781 */',replace:'cast: false/* #781 */',mustFail:MUST},
 {label:'Inworld no longer declares the flag',find:' unitCast: true,/* #781: a character',replace:' unitCast: false,/* #781: a character',mustFail:MUST},
 {label:'the sheet Test is read as narration',find:'char.voiceDirection || "", true);/* #457; #774',replace:'char.voiceDirection || "");/* #457; #774',mustFail:MUST},
 {label:'the grouper ignores the audition flag',find:'(voices[i] || voices.cast)',replace:'(voices[i])',mustFail:MUST},
 {label:'the audition drops the flag',find:'cast: !!cast } : null',replace:'cast: false } : null',mustFail:MUST},
 {label:'Speechify splits narration from speech for nothing',find:'depth: 1, key: true, rate: true, unitRate: true,/* #481 E6 */ languages: ["en-US"],',replace:'depth: 1, key: true, rate: true, unitRate: true, unitCast: true,/* #481 E6 */ languages: ["en-US"],',mustFail:MUST}
]);
process.exit(code);
