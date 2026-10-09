// Named mutation proofs for dictionary births, admission, copies and own-entry reads.
const sabotage=require('./sabotage.js');let rc=0;function prove(file,cases,command){rc|=sabotage.prove({file,command:command||['node',['dev/run-tests.js','#545']],cases});}
prove('helpers.js',[
{label:'restore inherited dictionary prototype',find:'var out=Object.create(null),keys=source',replace:'var out={},keys=source',mustFail:'#545 new memory dictionaries'},
{label:'follow inherited schema path',find:'if(!Object.prototype.hasOwnProperty.call(o,key))return;',replace:'',mustFail:'#545 schema normalization'},
{label:'omit capability overlay admission',find:'world:["capabilityBible",',replace:'world:[',mustFail:'#545 inflated own reserved keys'},
{label:'lose portable reserved item key',find:'var out=keyedDict(),n=0,ovs=',replace:'var out={},n=0,ovs=',mustFail:'#545 scene cast reserved name'}
]);
prove('identity.js',[
{label:'discard detached dictionary shape',find:'return kind?keyedStores(c,kind):c;',replace:'return c;',mustFail:'#545 detached memory clone'},
{label:'drop reserved scene cast key',find:'if(!set)set=keyedDict();',replace:'if(!set)set={};',mustFail:'#545 scene cast reserved name'}
]);
prove('inventory.js',[{label:'restore inherited item-pair bucket',find:'if(!R[field])R[field]=keyedDict();',replace:'if(!R[field])R[field]={};',mustFail:'#545 item pairing'}]);
prove('tag_table.js',[{label:'admit inherited category enum',find:'if(ownValue(ID_CATS,idc))',replace:'if(ID_CATS[idc])',mustFail:'#545 unknown reserved item categories'}]);
prove('game.js',[{label:'omit generated sheet admission (#599 (b): the attach runs the registry — its stores AND arrays entries both normalize, so the only single-point bypass is dropping the admission, which the ADMISSION CONTRACT names before the #545 test can)',find:'  if(!sheetAdmit(sheet,{door:"generated sheet "+npcName,mode:"same",detach:false,rel:npcName}).ok)return null;',replace:'',mustFail:'ADMISSION CONTRACT'}]);
prove('state.js',[
{label:'birth a missing legacy map with inherited names',find:'if(!memory.map)memory.map={nodes:keyedDict(),edges:[]',replace:'if(!memory.map)memory.map={nodes:{},edges:[]',mustFail:'#545 legacy missing map'},
{label:'omit checkpoint world normalization',find:'keyedStores(ws,"world");keyedStores(mem,"memory");',replace:'keyedStores(mem,"memory");',mustFail:'#545 checkpoint restore'},
{label:'invoke prototype setter on snapshot copy',find:'var snap=ownAssign({},ws);\n  var tr=',replace:'var snap=Object.assign({},ws);\n  var tr=',mustFail:'#545 snapshot own-copy'}
]);
prove('character_editor.html',[{label:'omit editor parsed-sheet normalization',find:'    keyedStores(c,"sheet");',replace:'',mustFail:'editor admission regained dictionary prototype'}],['node',['dev/tests-545-browser.js']]);
process.exit(rc);
