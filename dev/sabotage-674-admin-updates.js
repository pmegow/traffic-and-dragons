// Browser proofs drive dev/cdp-browser.js; missing Chrome is an explicit skip.
const sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
let bad=0;
bad|=sabotage.prove({file:'dev/record-release.js',command:['node',['dev/tests-674-release-notes.js']],cases:[
 {label:'overlong action slips through',find:'.length<25',replace:'.length<26',mustFail:'#674 releases action limit rejects 25 words and malformed data'},
 {label:'failed deploy becomes a release',find:"c.conclusion==='success'",replace:'true',mustFail:'#674 releases only a confirmed production receipt supplies a release date'},
 {label:'duplicate ledger receipt',find:'if(ledger.releases.some(r=>r.commit===commit))return false;',replace:'',mustFail:'#674 releases only a confirmed production receipt supplies a release date'}
]});
bad|=sabotage.prove({file:'admin_console.html',skip:!chrome.path,command:['node',['dev/tests-674-admin-updates-browser.js']],cases:[
 {label:'refresh consumes visit baseline',find:'readAdminActivity(activitySince,visitId,function',replace:'readAdminActivity(null,visitId,function',mustFail:'#674 refresh keeps visit cursor'},
 {label:'player expansion is discarded',find:'row.open=!!expanded[u.userId]',replace:'row.open=false',mustFail:'#674 player expansion survives refresh'}
]});
bad|=sabotage.prove({file:'admin-mail.js',skip:!chrome.path,command:['node',['dev/tests-674-admin-updates-browser.js']],cases:[
 {label:'confirmation bypassed',find:"if(!queue.length||!window.confirm(",replace:"if(!queue.length||false&&window.confirm(",mustFail:'#674 cancelled send does nothing'},
 {label:'ambiguous batch continues',find:'receipt.status!=="accepted"',replace:'false',mustFail:'#674 uncertain delivery is visible'}
]});
bad|=sabotage.prove({file:'admin_console.html',command:['node',['dev/tests-674-release-notes.js']],cases:[
 {label:'cached adapter hides new admin methods',find:'src="storage-adapter.js?admin_console"',replace:'src="storage-adapter.js"',mustFail:'#674 releases service worker refreshes an already-cached release ledger and console scripts'}
]});
if(!chrome.path&&!bad){verdict.reportSkip('sabotage-674-admin-updates.js',4,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exitCode=bad;
