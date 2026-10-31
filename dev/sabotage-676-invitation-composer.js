// Browser proofs drive dev/cdp-browser.js; missing Chrome is an explicit skip.
const sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
let bad=0;
bad|=sabotage.prove({file:'admin-invitations.js',skip:!chrome.path,command:['node',['dev/tests-676-invitation-composer-browser.js']],cases:[
 {label:'send enabled before preview',find:'$("invite-send").disabled=busy||!allowed||!preview;',replace:'$("invite-send").disabled=busy||!allowed;',mustFail:'#676 send is disabled before preview'},
 {label:'preview sends mail immediately',find:'preview={body:body,hash:data.previewHash};',replace:'storageAdapter.sendInvitation(body,function(){});preview={body:body,hash:data.previewHash};',mustFail:'#676 preview never sends'},
 {label:'edits keep stale preview enabled',find:'if(!busy){invalidate();status("Invitation changed.',replace:'if(!busy){status("Invitation changed.',mustFail:'#676 edits invalidate the preview'},
 {label:'resend action sends before review',find:'if(action.key==="resend")compose(r);else revoke(r);',replace:'if(action.key==="resend"){compose(r);storageAdapter.resendInvitation(r.id,{},function(){});}else revoke(r);',mustFail:'#676 resend opens composer without sending'}
]});
if(!chrome.path&&!bad){verdict.reportSkip('sabotage-676-invitation-composer.js',4,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exitCode=bad;
