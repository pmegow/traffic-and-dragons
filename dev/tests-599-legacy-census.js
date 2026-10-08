// CLI preflight checks use synthetic exports only; no owner saves or runtime writes.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),tool=process.env.CENSUS_TOOL||path.join(__dirname,'census-inventory-rows.js'),base=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-599-census-test-'));
let passed=0,failed=0;const positiveOnly=process.argv.includes('--positive');
function fixture(inv,worn){return {worldState:{character:{name:'Fixture',inventory:inv,...(worn===undefined?{}:{worn})},npcs:[]}};}
function check(name,data,status,reason){if(positiveOnly&&status!==0)return;const dir=path.join(base,String(passed+failed));fs.mkdirSync(dir);const file=path.join(dir,'fixture.tnd');if(data!==undefined)fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data));const hash=()=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null,before=hash();const r=cp.spawnSync(process.execPath,[tool,dir,'--all'],{cwd:root,encoding:'utf8'}),output=r.stdout+r.stderr;try{if(r.status!==status)throw Error('expected exit '+status+', got '+r.status+'\n'+output);if(reason&&!output.includes(reason))throw Error('missing diagnostic '+reason+'\n'+output);if(hash()!==before)throw Error('source input changed');console.log('PASS '+name);passed++;}catch(e){console.error('FAIL '+name+': '+e.message);failed++;}}
try {
check('legacy census ordinary strings',fixture(['Torch x3','Rope','__proto__']),0,'items 3');
check('legacy census unit conservation',fixture(['Arrow x3']),0,'units lost or gained 0');
check('legacy census equipped membership',fixture(['Shield','Torch'],['Torch']),0,'equipped lines 1');
check('legacy census authorized worn pack order',fixture(['Shield','Torch'],['Torch','Shield']),0,'order changes 1');
check('legacy census empty carried list',fixture([]),0,'sheets 1');
check('legacy census unreadable input','{broken',1,'unreadable');
check('legacy census missing world',{},1,'no worldState');
check('legacy census malformed world',{worldState:3},1,'worldState is not an object');
check('legacy census nonarray inventory',fixture({name:'Rope'}),1,'inventory is not an array');
check('legacy census unsupported row',fixture([{name:'Rope',qty:2,unknown:{kept:true}}]),1,'unsupported non-string inventory entry');
check('legacy census unsupported mixed',fixture(['Rope',{name:'Torch',qty:2}]),1,'unsupported non-string inventory entry');
check('legacy census junk entry',fixture([null]),1,'unsupported non-string inventory entry');
check('legacy census blank entry',fixture([' ']),1,'empty inventory entry');
check('legacy census malformed roster',{worldState:{character:{inventory:[]},npcs:{}}},1,'npcs is not an array');
check('legacy census malformed worn',fixture(['Rope'],{}),1,'worn is not an array');
check('legacy census invalid worn entry',fixture(['Rope'],[7]),1,'unsupported worn entry');
check('legacy census unmatched worn',fixture(['Rope'],['Hat']),1,'matches no carried item');
check('legacy census grammar split',fixture(['Arrow x0']),1,'count grammars disagree');
check('legacy census aggregate overflow',fixture(['Arrow x9007199254740991','arrow']),1,'safe positive integer');
check('legacy census unsafe units',fixture(['Arrow x9007199254740992']),1,'safe positive integer');
check('legacy census infinite units',fixture(['Arrow x'+'9'.repeat(310)]),1,'safe positive integer');
check('legacy census duplicate text change',fixture(['Torch','TORCH']),1,'inventory text/order changed');
check('legacy census whitespace text change',fixture([' Rope ']),1,'inventory text/order changed');
check('legacy census zero usable corpus',undefined,1,'no usable legacy inventory sheets');
check('legacy census only skipped inventory',{worldState:{character:{name:'No inventory'}}},1,'no usable legacy inventory sheets');
check('legacy census reports skipped inventory',{worldState:{character:{inventory:['Rope']},npcs:[{name:'No inventory',charSheet:{}}]}},0,'skipped missing inventory 1');
} finally {
  const resolved=fs.realpathSync(base),temp=fs.realpathSync(os.tmpdir());
  if(path.dirname(resolved)!==temp || !path.basename(resolved).startsWith('tnd-599-census-test-')) throw Error('unexpected fixture cleanup path');
  fs.rmSync(resolved,{recursive:true,force:true});
}
console.log('legacy census CLI: '+passed+' passed, '+failed+' failed');process.exitCode=failed?1:0;
