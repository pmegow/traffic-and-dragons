const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root='C:/Projects/traffic-and-dragons',dev=path.join(root,'dev'),logs=[];let selected;
const pool={jobsFrom:()=>({rest:['synthetic-checker-only-diff'],jobs:1}),run:(due,opts,onItem,onDone)=>{selected=due;onDone();}};
const cp={spawnSync:()=>({status:0,stdout:'dev/census-inventory-rows.js\n'})};
vm.runInNewContext(fs.readFileSync(path.join(dev,'run-sabotage-diff.js'),'utf8'),{require:n=>n==='./battery-pool.js'?pool:n==='child_process'?cp:require(n),__dirname:dev,process:{argv:['node','scanner'],env:{},exit:n=>{throw Error('unexpected exit '+n)}},console:{log:x=>logs.push(x),error:x=>logs.push(x)}});
assert(selected.includes('sabotage-599-legacy-census.js'));
const checker=require(path.join(dev,'check-sabotage-applicability.js'));
const clauses=checker.collect(root).clauses.filter(c=>c.battery==='sabotage-599-legacy-census.js');
assert.equal(clauses.length,4);
for(const c of clauses){assert.equal(c.file,'dev/census-inventory-rows.js');const src=fs.readFileSync(path.join(root,c.file),'utf8');assert.notEqual(checker.applyMutation(src,c.spec),src);}
console.log(logs.join('\n'));console.log('PASS unchanged diff scanner selects new battery for checker-only diff; all four original-source clauses captured and applicable.');
