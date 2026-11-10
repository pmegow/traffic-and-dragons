// Browser clauses use dev/cdp-browser.js; unavailable Chrome produces an explicit skip.
var sabotage=require('./sabotage.js'),rc=0;
var chrome=require('./cdp-browser.js').locateChrome(),verdict=require('./battery-verdict.js');
var cmd=['node',['dev/tests-724-designer-assistant.js']];
rc|=sabotage.prove({file:'designer-assistant.js',command:cmd,cases:[
 {label:'padded targets are not canonicalized',find:'if(old&&idField)identity=old[idField];',replace:'',mustFail:'resolved padded targets really change the intended object'},
 {label:'gate conflict silently widened',find:"if(sec==='creatures'&&owns(p.item,'availableActs')&&owns(p.item,'revealAct'))throw",replace:'if(false)throw',mustFail:'conflicting gates and wrong field types never reach the draft'},
 {label:'truthy string booleans accepted',find:"type=fieldTypes[k]||'text';if(!valueTypes[type](value))",replace:"type=fieldTypes[k]||'text';if(false)",mustFail:'conflicting gates and wrong field types never reach the draft'},
 {label:'preview ignores normalized value',find:'if(change.top)change.after=candidate[change.top];',replace:'',mustFail:'preview reflects the final normalized value'},
 {label:'new long class prose accepted',find:'if(value.length>limit&&value!==before)',replace:'if(false)',mustFail:'limits cover every explicit write without borrowing another items exception'},
 {label:'preview mutates live draft' ,find:'var candidate=copy(bp),changes=',replace:'var candidate=bp,changes=',mustFail:'ten habitat soldiers are previewed then applied atomically'},
 {label:'old context accepts a reply',find:'current(bp,stamp,host);',replace:'',mustFail:'stale response stale apply and replacement drafts are refused'},
 {label:'old proposal overwrites manual edits',find:'current(bp,proposal.stamp,host);',replace:'',mustFail:'stale response stale apply and replacement drafts are refused'},
 {label:'parseable truncation accepted',find:'if(opts.finish&&opts.finish.cut)',replace:'if(false)',mustFail:'truncated malformed excessive and overlong output are refused'},
 {label:'portrait enters text prompt',find:"k==='portrait'||",replace:'',mustFail:'advice uses text-only current context and never changes the draft'},
 {label:'partial edit drops optional fields',find:'p.item=Object.assign({},old||{},p.item);',replace:'p.item=Object.assign({},p.item);',mustFail:'custom classes update restricted roster and preview implicit changes'},
 {label:'class added but unavailable',find:'if(sec===\'customClasses\')roster(candidate,old&&old.name,action===\'delete\'?\'\':p.item.name);',replace:'',mustFail:'custom classes update restricted roster and preview implicit changes'},
 {label:'overlong prose accepted',find:'if(value.length>limit&&value!==before)',replace:'if(false)',mustFail:'truncated malformed excessive and overlong output are refused'},
 {label:'unknown edit target becomes an upsert',find:"else if(matchesAt.length!==1)throw",replace:"else if(false)throw",mustFail:'wrong actions duplicate targets ambiguous identities and invalid late edits are atomic'}
]});
rc|=sabotage.prove({file:'blueprint-designer.html',command:cmd,cases:[{label:'assistant inherits review deletions',find:'var deletedBefore=deletedContext||_batchDeleted;',replace:'var deletedBefore=_batchDeleted;',mustFail:'partial updates preserve public fields images and gates without review deletion state'}]});
rc|=sabotage.prove({file:'designer-assistant-ui.js',skip:!chrome.path,command:['node',['dev/tests-724-designer-assistant-browser.js']],cases:[
 {label:'assistant reply executes markup',find:'reply.textContent=proposal.reply;',replace:'reply.innerHTML=proposal.reply;',mustFail:'#724 reply is rendered as text'},
 {label:'late error changes reopened window',find:'catch(e){if(live()){',replace:'catch(e){if(true){status=document.querySelector("#ask-status")||status;',mustFail:'#724 closed requests cannot populate a new modal'},
 {label:'advice offers misleading Apply',find:'applyButton.hidden=!proposal.patches.length;',replace:'applyButton.hidden=false;',mustFail:'#724 advice offers no apply action'}
]});
if(!chrome.path&&!rc){verdict.reportSkip('sabotage-724-designer-assistant.js',3,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(rc?1:0);
