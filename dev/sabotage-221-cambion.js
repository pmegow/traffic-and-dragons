// #221: prove the canonical rename, exact-field compatibility and each entry boundary.
const sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
const chrome=require('./cdp-browser.js').locateChrome();let failed=0;
const engine=['node',['dev/run-tests.js','Cambion ancestry']];
const browser=['node',['dev/tests-221-cambion-browser.js']];
function prove(file,command,cases,browserCase){failed+=sabotage.prove({file,command,cases,skip:browserCase&&!chrome.path});}
prove('data.js',engine,[
 {label:'canonical id remains retired',find:'{id:"cambion",nm:"Cambion",',replace:'{id:"tiefling",nm:"Cambion",',mustFail:'Cambion replaces the ancestry'},
 {label:'GM is still instructed to use retired race',find:'gnomes, cambions, hollow-born',replace:'gnomes, tieflings, hollow-born',mustFail:'default GM rules call the ancestry cambions'}
]);
prove('state.js',engine,[
 {label:'display-name mapping stops renaming',find:'"Tiefling":"Cambion"',replace:'"Tiefling":"Tiefling"',mustFail:'ancestry migration accepts old name'},
 {label:'migration damages unrelated fields',find:'c.ancestry=next;return true;',replace:'c.ancestry=next;c.subrace="";return true;',mustFail:'ancestry migration accepts old name'},
 {label:'hero load skips migration',find:'if(migrateAncestryNames(c))_mig=true;',replace:'',mustFail:'save migration renames hero'},
 {label:'NPC sheet load skips migration',find:'if(migrateAncestryNames(_crs))_mig=true;',replace:'',mustFail:'save migration renames hero'},
 {label:'NPC metadata skips migration',find:'if(migrateAncestryNames(worldState.npcs[_cri]))_mig=true;',replace:'',mustFail:'save migration renames hero'}
]);
prove('storage-adapter.js',['node',['dev/tests-c13-adapter.js']],[
 {label:'library metadata stays stale',find:'migrateAncestryNames(entry);if(entry)',replace:'if(entry)',mustFail:'Cambion library migration'},
 {label:'library sheets stay stale',find:'if(entry)migrateAncestryNames(entry.character);',replace:'',mustFail:'Cambion library migration'}
]);
prove('char-creation.js',browser,[
 {label:'creation loses Infernal on the renamed id',find:'cambion:"Infernal"',replace:'tiefling:"Infernal"',mustFail:'Cambion creation retains Infernal'}
],true);
prove('ui-browsers.js',browser,[
 {label:'portable import keeps retired ancestry',find:'  migrateAncestryNames(char);',replace:'',mustFail:'portable import preview migrates'}
],true);
prove('character_editor.html',browser,[
 {label:'editor skips ancestry migration',find:'if(typeof migrateAncestryNames==="function")migrateAncestryNames(c);',replace:'',mustFail:'editor imports old name and id'},
 {label:'editor cannot select a saved display name',find:'v:ch.ancestry===ANCS[i].nm?ANCS[i].nm:ANCS[i].id,',replace:'v:ANCS[i].id,',mustFail:'editor imports old name and id'}
],true);
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-221-cambion.js',4,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
