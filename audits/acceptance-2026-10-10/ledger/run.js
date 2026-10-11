'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const sets={probes:[['probes',['audits/acceptance-2026-10-10/ledger/probes.js']]],existing:['ledger quartet','#518 block','#481 D4','#481 D5','#598 the purse','#481 A2','#481 D2'].map((x,i)=>['section-'+i,['dev/run-tests.js',x]]),batteries:['517-counter-tail','518-pair-block','quartet-ledger','481-d4-want-met','481-d5-coin','598-copper'].map(x=>['sabotage-'+x,['dev/sabotage-'+x+'.js']])};
let bad=0;
for(const [name,args] of sets[process.argv[2]||'probes']){const started=Date.now(),r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:360000,maxBuffer:32*1024*1024});fs.writeFileSync(path.join(__dirname,name+'-utf8.log'),JSON.stringify({command:['node'].concat(args),status:r.status,signal:r.signal,error:r.error&&r.error.message,ms:Date.now()-started})+'\n'+r.stdout+'\n'+r.stderr,'utf8');console.log(name+' status='+r.status+' ms='+(Date.now()-started)+' '+r.stdout.split('\n').filter(x=>/GREEN|SUMMARY|MISSED|MISATTRIBUTED|CAUGHT|passed/.test(x)).slice(-3).join(' | '));if(r.status!==0)bad++;}
process.exitCode=bad?1:0;
