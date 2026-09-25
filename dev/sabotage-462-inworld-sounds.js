// #462 Inworld non-verbal sounds stand in their own bracket — every guard proven by mutation in a disposable clone.
//   node dev/sabotage-462-inworld-sounds.js
var sabotage=require('./sabotage.js'),code=0;
var ALSO=['dev/tests-402-character-voices.js','dev/engine-tests.js'];
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',Array.isArray(command)?command:[command]],also:ALSO,cases:cases});}
prove('tts.js',['dev/run-tests.js','#96 [SAY:]'],[
 {label:'the sound table loses laugh',find:'var INWORLD_SOUNDS = ["laugh", "giggle",',replace:'var INWORLD_SOUNDS = ["giggle",',mustFail:'#462 Inworld non-verbal sounds stand in their own bracket'},
 {label:'sounds fold into the steering bracket again',find:'if (table.indexOf(k) >= 0) { if (sounds.indexOf(k) < 0) sounds.push(k); } else steer.push(p);',replace:'steer.push(p);',mustFail:'#462 Inworld non-verbal sounds stand in their own bracket'},
 {label:'the sounds fire before the steering',find:'    var out = steer.length ? "[speak " + steer.join(", ") + "] " : "";\n    for (i = 0; i < sounds.length; i++) out += "[" + sounds[i] + "] ";',replace:'    var out = "";\n    for (i = 0; i < sounds.length; i++) out += "[" + sounds[i] + "] ";\n    if (steer.length) out += "[speak " + steer.join(", ") + "] ";',mustFail:'#462 Inworld non-verbal sounds stand in their own bracket'},
 {label:'the Inworld entry loses its table',find:'sounds: INWORLD_SOUNDS,/* #462: non-verbal tags stand alone */ ',replace:'',mustFail:'#462 Inworld non-verbal sounds stand in their own bracket'}
]);
prove('tts.js',['dev/tests-402-character-voices.js'],[
 {label:'the group text goes back to one bracket',find:'return Object.assign({}, g, { text: _markupPrefix(m, mood) + g.text });',replace:'return Object.assign({}, g, { text: "[" + mood + "] " + g.text });',mustFail:'#462 a real Inworld read splits a mood'}
]);
process.exit(code);
