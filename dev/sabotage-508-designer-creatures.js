var sabotage=require('./sabotage.js'),failed=0;
var command=['node',['dev/tests-designer-creatures.js']];
failed+=sabotage.prove({file:'designer-creatures.js',command:command,cases:[
 {label:'fractional count admitted',find:'Math.floor(n)!==n||',replace:'',mustFail:'counts reject empty fractional zero negative and excessive batches'},
 {label:'random uses the first choice forever',find:'v[Math.floor(random()*v.length)]',replace:'v[0]',mustFail:'random resolves independently per creature and fixed picks are authoritative'},
 {label:'duplicate names admitted',find:'if(existing.some(function(c)',replace:'if(false&&existing.some(function(c)',mustFail:'invalid and duplicate model results cannot enter the bestiary'},
 {label:'portrait data sent to text models',find:'k==="portrait"||',replace:'',mustFail:'portraits persist in files but never enter text review payloads'},
 {label:'treasure is silently omitted',find:'". Treasure: "+(choice.treasure||"None")+',replace:'". "+',mustFail:'treasure selection persists in notes and default None avoids unintended loot'},
 {label:'text fix drops portrait',find:'if(previous&&previous.portrait)next.portrait=previous.portrait;',replace:'',mustFail:'text fixes retain existing portraits and cannot invent image attachments'}
]});
failed+=sabotage.prove({file:'blueprint-designer.html',command:command,cases:[
 {label:'canonical rules omitted',find:'if(bp.rules&&bp.rules.length)L.push("HARD CAMPAIGN RULES:\\n"+bp.rules.join("\\n"));',replace:'',mustFail:'creature context includes hard rules and established setting details without images'},
 {label:'stale portrait attaches after text edits',find:'||identity!==JSON.stringify([c.name,c.kind,c.threat,c.notes])',replace:'',mustFail:'portrait text edits during generation preserve the prior image'},
 {label:'cancelled request applies late',find:'if(job.cancelled)throw new Error("Generation cancelled; no creatures were added.");',replace:'',mustFail:'cancelled or replaced drafts never receive late creatures'},
 {label:'replacement draft receives stale creatures',find:'if(bp!==target||JSON.stringify(target.creatures)!==original)',replace:'if(false)',mustFail:'cancelled or replaced drafts never receive late creatures'},
 {label:'partial batch leaks before a failure',find:'entries.push(DesignerCreatures.entry(JSON.parse(repairModelJson(response)),plans[i],target.creatures.concat(entries)));',replace:'target.creatures.push(DesignerCreatures.entry(JSON.parse(repairModelJson(response)),plans[i],target.creatures.concat(entries)));',mustFail:'a failed batch preserves the original bestiary'}
]});
process.exit(failed?1:0);
