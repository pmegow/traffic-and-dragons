// CLI preflight checks for dev/census-inventory-rows.js (gate 7 since #599 (c)) — synthetic exports only; no owner saves,
// no runtime writes. The tool heals every sheet through THE ENGINE (invHealSheet) and judges by its own oracle; a legacy
// string sheet, a row sheet and every refusal class below is exercised. The names are the sabotage battery's attribution
// anchors (dev/sabotage-599-legacy-census.js) — keep them.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),tool=process.env.CENSUS_TOOL||path.join(__dirname,'census-inventory-rows.js'),base=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-599-census-test-'));
let passed=0,failed=0;const positiveOnly=process.argv.includes('--positive');
function fixture(inv,worn,extra){return {worldState:{character:Object.assign({name:'Fixture',inventory:inv},worn===undefined?{}:{worn},extra||{}),npcs:[]}};}
function check(name,data,status,reason){if(positiveOnly&&status!==0)return;const dir=path.join(base,String(passed+failed));fs.mkdirSync(dir);const file=path.join(dir,'fixture.tnd');if(data!==undefined)fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data));const hash=()=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):'';const before=hash();
  const r=cp.spawnSync(process.execPath,[tool,dir,'--all'],{cwd:root,encoding:'utf8'});const out=String(r.stdout||'')+String(r.stderr||'');const ok=r.status===status&&out.indexOf(reason)>=0&&hash()===before;
  if(ok){passed++;console.log('PASS '+name);}else{failed++;console.log('FAIL '+name+': '+(r.status!==status?'exit '+r.status+' (want '+status+')':hash()!==before?'the fixture was written':'missing diagnostic '+reason)+'\n'+out.split('\n').filter(l=>!/^\[/.test(l)).join('\n'));}}
try {
check('legacy census ordinary strings',fixture(['Torch x3','Rope','__proto__']),0,'items 3');
check('legacy census unit conservation',fixture(['Arrow x3']),0,'units lost or gained 0');
check('legacy census equipped membership',fixture(['Shield','Torch'],['Torch']),0,'equipped sheets 1');
check('legacy census authorized worn pack order',fixture(['Shield','Torch'],['Torch','Shield']),0,'order changes 1');
check('legacy census empty carried list',fixture([]),0,'sheets 1');
check('census row sheet',fixture([{name:'Rope',qty:2,equipped:true,unknown:{kept:true}},{name:'Torch',qty:1,equipped:false}],undefined,{sheetVer:11}),0,'rows 1');
check('census row sheet before the stamp',fixture([{name:'Rope',qty:2,equipped:false}]),0,'rows 1');
check('census row sheet equipped',fixture([{name:'Rope',qty:2,equipped:true}],undefined,{sheetVer:11}),0,'equipped sheets 1');
check('legacy census unreadable input','{broken',1,'unreadable');
check('legacy census missing world',{},1,'no worldState');
check('legacy census malformed world',{worldState:3},1,'worldState is not an object');
check('legacy census nonarray inventory',fixture({name:'Rope'}),1,'inventory is not a list');
check('legacy census unsupported mixed',fixture(['Rope',{name:'Torch',qty:2}]),1,'mixed or unreadable inventory entries');
check('legacy census junk entry',fixture([null]),1,'mixed or unreadable inventory entries');
check('legacy census blank entry',fixture([' ']),1,'empty inventory entry');
check('legacy census malformed roster',{worldState:{character:{inventory:[]},npcs:{}}},1,'npcs is not an array');
check('legacy census malformed worn',fixture(['Rope'],{}),1,'worn is not a list');
check('census row sheet with a worn list',fixture([{name:'Rope',qty:1,equipped:false}],['Rope']),1,'still carries a worn list');
check('legacy census invalid worn entry',fixture(['Rope'],[7]),1,'unsupported worn entry');
check('legacy census unmatched worn',fixture(['Rope'],['Hat']),1,'matches no carried item');
check('legacy census grammar split',fixture(['Arrow x0']),1,'count grammars disagree');
check('legacy census over the bound',fixture(['Arrow x10000']),1,'the heal refused');
check('legacy census aggregate overflow',fixture(['Arrow x9007199254740991','arrow']),1,'the heal refused');
check('legacy census unsafe units',fixture(['Arrow x9007199254740992']),1,'the heal refused');
check('legacy census duplicate text change',fixture(['Torch','TORCH']),1,'inventory text/order changed');
check('legacy census whitespace text change',fixture([' Rope ']),1,'inventory text/order changed');
check('legacy census zero usable corpus',undefined,1,'no inventory sheets found');
check('legacy census only skipped inventory',{worldState:{character:{name:'No inventory'}}},1,'no inventory sheets found');
check('legacy census reports skipped inventory',{worldState:{character:{inventory:['Rope']},npcs:[{name:'No inventory',charSheet:{}}]}},0,'skipped (no inventory field) 1');
} finally {
  const resolved=fs.realpathSync(base),temp=fs.realpathSync(os.tmpdir());
  if(path.dirname(resolved)!==temp || !path.basename(resolved).startsWith('tnd-599-census-test-')) throw Error('unexpected fixture cleanup path');
  fs.rmSync(resolved,{recursive:true,force:true});
}
console.log('inventory census CLI: '+passed+' passed, '+failed+' failed');process.exitCode=failed?1:0;
