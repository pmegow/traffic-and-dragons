var sabotage=require('./sabotage.js'),code=0;
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',command],also:['ui-sheets.js'],cases:cases});}
prove('tts.js',['dev/run-tests.js','Character primary and backup voices'],[
 /* Fable review 2026-09-11: the three filters dispatch through ONE predicate (castGenderMatches); the mutation targets it */
 {label:'allow all genders in character filter',find:'return (gender === "M" || gender === "F") ? actorGender === gender : true;',replace:'return true;',mustFail:'#402 voice lists restrict binary genders and show both only for non-binary characters'},
 {label:'route the sheet filter around the shared predicate',find:'return voices.filter(function(v) { return castGenderMatches(gender, v.g); });',replace:'return voices.filter(function(v) { return gender === "NB" || v.g === gender; });',mustFail:'#402 ONE gender predicate: the sheet filter, the creation assignment and the auto-cast pool agree for every gender value'},
 {label:'bypass starred actor filter',find:'    if (char) st = filterCharacterVoices(char, st);',replace:'',mustFail:'#402 Piper stars filter metadata while narrator settings retain the full bank'}
]);
prove('ui-sheets.js',['dev/tests-402-character-voices.js'],[
 {label:'let base metadata override edited stars',find:'  vs=vs.filter(function(v){return !allStars.some(function(star){return star.id===v.id;});});',replace:'',mustFail:'#402 sheet renderers filter both actor lists without changing saved pins'},
 {label:'show unfiltered Speechify catalog',find:'voices=TTS.filterCharacterVoices(char,catalog);',replace:'voices=catalog;',mustFail:'#402 sheet renderers filter both actor lists without changing saved pins'},
 {label:'show unfiltered Piper single voices',find:'vs=TTS.filterCharacterVoices(char,TTS.voices())',replace:'vs=TTS.voices()',mustFail:'#402 sheet renderers filter both actor lists without changing saved pins'},
 {label:'offer mismatched saved actors as choices',find:' selected disabled hidden>Saved voice',replace:' selected>Saved voice',mustFail:'#402 sheet renderers filter both actor lists without changing saved pins'}
]);
process.exit(code);
