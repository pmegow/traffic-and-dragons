// #437: prove the real editor's settlement controls, persistence, and stale-dialog refusal.
// Chrome discovery and its loud skip share dev/cdp-browser.js with the browser proof.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
var cases=[
 {label:'history edits leave a stale settlement status',find:'if(L.check)render();else syncFieldActions();',replace:'if(L.check)render();',mustFail:'#437 editor: history edits left a stale settled status'},
 {label:'settlement stops using the shared lifecycle',find:'var rec=motivationSettle(ch,reason,0,camp);',replace:'var rec={how:reason};',mustFail:'#437 editor: settlement must clear the standing purpose'},
 {label:'an empty reason retires the purpose',find:'if(!reason){err.textContent="Describe how the purpose ended before settling it.";',replace:'if(false){err.textContent="Describe how the purpose ended before settling it.";',mustFail:'#437 editor: empty reason retired the purpose'},
 {label:'a stale dialog retires another character',find:'if(ch!==target||ch.motivation!==purpose){',replace:'if(false){',mustFail:'#437 editor: stale dialog retired another sheet'},
 {label:'loading a saved sheet drops its settlement history',find:'ch=healChar(JSON.parse(JSON.stringify(c)));dirty=false;render();',replace:'ch=healChar(JSON.parse(JSON.stringify(c)));ch.motivationHistory=[];dirty=false;render();',mustFail:'#437 editor: file/library round trip lost settlement history'}
];
var failed=sabotage.prove({file:'character_editor.html',skip:!chrome.path,command:['node',['dev/tests-437-editor-browser.js']],cases:cases});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-437-editor.js',cases.length,chrome.why);process.exit(verdict.SKIP_EXIT);}process.exit(failed?1:0);
