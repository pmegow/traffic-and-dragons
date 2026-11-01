// #678: attribution must survive the fixed GAS schema and every tracker surface.
// Browser clauses use dev/cdp-browser.js; a missing Chrome is reported separately from success.
const sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
let failed=0;
failed+=sabotage.prove({file:'error-report.js',command:['node',['dev/tests-678-reporter.js']],cases:[
 {label:'current identity replaced by the stale account cache',find:'user.username : null;',replace:'serverAccount.username : null;',mustFail:'#678 reports use the current signed-in username'},
 {label:'reporter omitted at the shared send boundary',find:'JSON.stringify(erStampReporter(payload,reporter))',replace:'JSON.stringify(payload)',mustFail:'#678 reports use the current signed-in username'},
 {label:'reporter exists only in a field the deployed GAS discards',find:'out[spec.field] = prefix + String(payload[spec.field] || "").slice(0, spec.max - prefix.length);',replace:'out[spec.field] = String(payload[spec.field] || "").slice(0, spec.max);',mustFail:'#678 existing GAS sheet and JSON feed preserve reporter'},
 {label:'late account lookup sends the report a second time',find:'    if (settled) return;',replace:'    /* allow a second resolution */',mustFail:'#678 late identity callback cannot double-send'},
 {label:'identity failure silently drops the original report',find:'    cb(erReporterIdentity(username, state));',replace:'    if(state === "account") cb(erReporterIdentity(username, state));',mustFail:'#678 guest still delivers the report'}
]});
failed+=sabotage.prove({file:'bug_tracker.html',skip:!chrome.path,command:['node',['dev/tests-678-reporter-browser.js']],cases:[
 {label:'live cards drop attribution',find:'  card.appendChild(reporterNode(reporter?[reporter]:[]));',replace:'  card.appendChild(reporterNode([]));',mustFail:'#678 live feed visibly names the reporter'},
 {label:'filed cards drop attribution',find:'  card.appendChild(reporterNode(b.reporters));',replace:'  card.appendChild(reporterNode([]));',mustFail:'#678 synced report visibly names the reporter'},
 {label:'duplicate reporters are lost during parsing',find:'if(item)found.push(item);',replace:'if(item&&found.length===0)found.push(item);',mustFail:'#678 duplicate sync keeps every reporter once'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-678-reporter.js',3,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exitCode=failed?1:0;
