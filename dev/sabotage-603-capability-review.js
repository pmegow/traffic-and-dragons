const sabotage=require('./sabotage.js');
const storeFailures=sabotage.prove({file:'dev/capability-review-store.js',command:['node',['dev/tests-603-capability-review.js']],cases:[
 {label:'stale review overwrites a newer file',find:'if(payload.revision!==current.revision)',replace:'if(false)',mustFail:'stale review must be refused'},
 {label:'failed atomic replacement destroys the saved review',find:'fs.renameSync(temp,file);',replace:'fs.writeFileSync(file,text);fs.renameSync(temp,file);',mustFail:'failed replacement must preserve previous review'}
]});
const retirementFailures=sabotage.prove({file:'audits/capability_vulnerabilities.html',command:['node',['dev/tests-603-capability-review.js']],cases:[
 {label:'retired duplicate remains active',find:'function isActive(row){return !row.retired;}',replace:'function isActive(row){return true;}',mustFail:'remove the later 7d8/DEX entry from active review'},
 {label:'retired record inflates optional count',find:'if(!isActive(row))return;active++;',replace:'active++;',mustFail:'retired entries must not count as optional'}
]});
process.exit(storeFailures||retirementFailures?1:0);
