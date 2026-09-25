// #458 per-line mood for Inworld ([SAY:Name|mood]) — every guard proven by mutation in a disposable clone.
// The engine manifest's working set rides into the clone; the standalone voice suite and the doc golden ride via `also`.
//   node dev/sabotage-458-say-mood.js
var sabotage=require('./sabotage.js'),code=0;
var ALSO=['dev/tests-402-character-voices.js','dev/golden/tag-table-doc.golden','dev/engine-tests.js'];
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',Array.isArray(command)?command:[command]],also:ALSO,cases:cases});}
var SAY='#96 [SAY:]';
prove('game.js',['dev/run-tests.js',SAY],[
 {label:'the deriver never records the mood beside the speaker',find:'if(segs[j].mood){moods[i]=segs[j].mood;anyMood=true;}',replace:'',mustFail:'#458 the SAY mood: [SAY:Name|mood] keeps the name AND the mood'},
 {label:'the shape gate is bypassed — a sentence rides as a mood',find:'prevMood=sayMoodShape(m[2]);',replace:'prevMood=String(m[2]);',mustFail:'#458 the SAY mood: [SAY:Name|mood] keeps the name AND the mood'},
 {label:'speakerVoiceMap drops the persisted mood',find:'if(sp.m&&sp.m[_ix]){if(!out.moods)out.moods={};out.moods[_ix]=sp.m[_ix];}',replace:'',mustFail:'#458 speakerVoiceMap carries the persisted mood under moods'}
]);
prove('helpers.js',['dev/run-tests.js',SAY],[
 {label:'the 40-character cap is gone',find:'if(!s||s.length>SAY_MOOD_MAX)return "";',replace:'if(!s)return "";',mustFail:'#458 sayMoodShape is the ONE gate'},
 {label:'punctuation passes the gate',find:'return /^[A-Za-z][A-Za-z ,-]*$/.test(s)?s:"";',replace:'return s;',mustFail:'#458 sayMoodShape is the ONE gate'}
]);
prove('helpers.js',['dev/run-tests.js','#6 the village — phase E/F'],[
 {label:'the trade gate reads "Name|mood" as the counterparty',find:'_spk.push(_sm[_si].slice(5,-1).split("|")[0].trim());',replace:'_spk.push(_sm[_si].slice(5,-1).trim());',mustFail:'#458 the trade gate reads a mooded [SAY:Name|mood] keeper by NAME'}
]);
prove('tts.js',['dev/run-tests.js',SAY],[
 {label:'the grouper merges two moods',find:' && (cur.mood || "") === md',replace:'',mustFail:'#458 cloud grouping never merges two moods'},
 {label:'Inworld stops declaring markups',find:'markups: true,/* #458: square-bracket steering tags ride the text */ ',replace:'',mustFail:'#458 only a reader declaring markups (Inworld)'},
 {label:'every reader gets the bracket',find:'if (!m || !m.markups || !g || !g.mood) return g;',replace:'if (!g || !g.mood) return g;',mustFail:'#458 only a reader declaring markups (Inworld)'},
 {label:'the send-time re-check is gone',find:'var mood = (typeof sayMoodShape === "function") ? sayMoodShape(g.mood) : "";',replace:'var mood = String(g.mood);',mustFail:'#458 only a reader declaring markups (Inworld)'}
]);
prove('tts.js',['dev/tests-402-character-voices.js'],[
 {label:'the request skips the markup step',find:'body: JSON.stringify(m.request(_markupGroup(m, g), c, direction))',replace:'body: JSON.stringify(m.request(g, c, direction))',mustFail:'#458 a real Inworld read prefixes a mooded group'}
]);
prove('tag_table.js',['dev/run-tests.js',SAY],[
 {label:'the doc line stops teaching restraint',find:'Use it ONLY when the feeling is not obvious from the words themselves, and never on every line -- most lines carry none.',replace:'Use it on every spoken line.',mustFail:'#458 the SAY doc line teaches the optional |mood'}
]);
process.exit(code);
