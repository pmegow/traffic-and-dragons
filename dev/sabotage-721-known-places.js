var sabotage=require('./sabotage.js'),rc=0,command=['node',['dev/run-tests.js','#721 blueprint places need on-screen names']];
rc|=sabotage.prove({file:'memory.js',command:command,cases:[
 {label:'all blueprint places are known from turn zero again',find:'if(!_vn.blueprintSeeded||_bpKnown[_lkR])_known.push(_lkD);',replace:'_known.push(_lkD);',mustFail:'#721 turn zero lists no never-named blueprint place'},
 {label:'player guesses and rejected branches count as knowledge',find:'e.r!=="gm"||typeof e.x!=="string"||e.bk||e.rf||e.rc||e.db',replace:'typeof e.x!=="string"',mustFail:'#721 only visible GM words establish a named place'},
 {label:'retconned interior transcript entry keeps knowledge',find:'e.bk||e.rf||e.rc||e.db',replace:'e.bk||e.rf||e.db',mustFail:'#721 transcript edits and discarded branches revoke unvisited knowledge'},
 {label:'hidden state tags establish player knowledge',find:'var text=cleanTxt(e.x).toLowerCase();',replace:'var text=e.x.toLowerCase();',mustFail:'#721 only visible GM words establish a named place'},
 {label:'old campaigns also lose their known places',find:'if(!_vn.blueprintSeeded||_bpKnown[_lkR])',replace:'if(_bpKnown[_lkR])',mustFail:'#721 legacy and runtime nodes keep their existing prompt behavior'},
 {label:'split secondaries forget authored provenance',find:'{k:"blueprintSeeded",fold:"or",split:"all"}',replace:'{k:"blueprintSeeded",fold:"or"}',mustFail:'#721 merges preserve provenance and splits keep every secret successor gated'},
 {label:'merging a secret into an ordinary node loses provenance',find:'{k:"blueprintSeeded",fold:"or",split:"all"},',replace:'',mustFail:'#721 merges preserve provenance and splits keep every secret successor gated'}
]});
rc|=sabotage.prove({file:'game.js',command:command,cases:[
 {label:'blueprint seeding drops provenance',find:'description:loc.description||null,blueprintSeeded:true',replace:'description:loc.description||null',mustFail:'#721 provenance is stamped only on a new blueprint node'}
]});
process.exit(rc?1:0);
