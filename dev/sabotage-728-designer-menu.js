// Browser driver: dev/cdp-browser.js; unavailable Chrome is reported as a skip.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
var failed=sabotage.prove({file:'designer-menu.js',skip:!chrome.path,command:['node',['dev/tests-728-designer-menu-browser.js']],cases:[
 {label:'Escape leaves the File disclosure open',find:'event.key==="Escape"&&menu.open',replace:'false',mustFail:'#728 Escape outside click and keyboard keep File usable'},
 {label:'action leaves File open behind the file picker',find:'if(button&&panel.contains(button)){menu.open=false;focusDesignerFile();}',replace:'if(button&&panel.contains(button)){}',mustFail:'#728 file actions retain their handlers and dialogs return visible focus'},
 {label:'selected model is not persisted',find:'store.set(RENDER_MDL_K,renderModel);',replace:'',mustFail:'#728 render choice persists and every new model uses the actual queued portrait body'},
 {label:'memory fallback is mistaken for a durable model choice',find:'if(localStorage.getItem(RENDER_MDL_K)!==renderModel)',replace:'if(false)',mustFail:'#728 browser storage denial never claims the image choice is saved'},
 {label:'closed file dialogs lose keyboard focus',find:'function focusDesignerFile(){document.getElementById("designer-file-toggle").focus();}',replace:'function focusDesignerFile(){}',mustFail:'#728 file actions retain their handlers and dialogs return visible focus'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-728-designer-menu.js',5,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
