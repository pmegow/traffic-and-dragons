// Browser proofs drive dev/cdp-browser.js; missing Chrome is an explicit skip.
const sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
let bad=0;
bad|=sabotage.prove({file:'invitation.js',command:['node',['dev/tests-675-invitations.js']],cases:[
 {label:'server refusal becomes approval',find:'if(error||!data||data.ok!==true)',replace:'if(false)',mustFail:'#675 acceptance waits for explicit Google login and a successful server result'},
 {label:'late authentication bypasses timeout',find:'if(id!==attempt)return;clearTimeout(deadline);',replace:'clearTimeout(deadline);',mustFail:'#675 timed out authentication cannot approve from a late callback'}
]});
bad|=sabotage.prove({file:'admin-invitations.js',skip:!chrome.path,command:['node',['dev/tests-675-invitations-browser.js']],cases:[
 {label:'invitation confirmation bypassed',find:'if(!window.confirm(prompt))return;\n    var key="send:"',replace:'if(false&&!window.confirm(prompt))return;\n    var key="send:"',mustFail:'#675 cancelled invitation sends nothing'}
]});
bad|=sabotage.prove({file:'invitation.js',skip:!chrome.path,command:['node',['dev/tests-675-invitations-browser.js']],cases:[
 {label:'invitation accepts through GitHub',find:'},"google");',replace:'},"github");',mustFail:'#675 acceptance uses Google only'},
 {label:'wrong account exposes play',find:'if(error||!data||data.ok!==true){lock(false);',replace:'if(error||!data||data.ok!==true){$("invitation-play").hidden=false;lock(false);',mustFail:'#675 rejected acceptance cannot enter play'}
]});
if(!chrome.path&&!bad){verdict.reportSkip('sabotage-675-invitations.js',3,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exitCode=bad;
