var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'game.js',command:['node',['dev/run-tests.js','#397 scene-led render poses']],cases:[
 {label:'stillness permission is removed',find:'Stillness is valid. ',replace:'',mustFail:'#397 quiet and moving scenes'},
 {label:'unconditional action poses return',find:'Stillness is valid. ',replace:'Stillness is valid. Give every character a mid-action pose. ',mustFail:'#397 quiet and moving scenes'},
 {label:'motion loses its scene constraint',find:'Movement and its intensity must be supported by the scene',replace:'Movement is always preferred',mustFail:'#397 quiet and moving scenes'},
 {label:'camera framing demands motion again',find:'Include motion cues only when the scene describes movement',replace:'Include motion cues in every frame',mustFail:'#397 quiet and moving scenes'},
 {label:'reference portraits force action again',find:"Follow each character's WRITTEN posture, activity and orientation exactly, including stillness.",replace:'Re-stage every figure in a NEW mid-action pose.',mustFail:'#397 reference-image instructions preserve written posture'}
]}));
