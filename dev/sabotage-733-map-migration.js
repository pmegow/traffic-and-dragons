// #733: prove migration/privacy guards with named tests in the shared scratch-clone harness.
// Historical compatibility uses actual pre-transition source bytes, not today's gate with a lower constant.
"use strict";
const assert=require("assert/strict"),cp=require("child_process"),path=require("path"),vm=require("vm");
const ROOT=path.join(__dirname,".."),PREFIX="FAIL #733 migration ",BOUNDARY="FAIL #733 migration boundary ";
const OLD_CLIENT="84dbb093c67f912bf8342512e5f3631620a612c9";
function sourceAt(ref,file){
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith("GIT_")));
  return cp.execFileSync("git",["-c","safe.directory="+ROOT,"show",ref+":"+file],{cwd:ROOT,env,encoding:"utf8",maxBuffer:8*1024*1024});
}
function checks(){
  const engine=require("./load-engine.js");engine.loadEngine();const at=process.argv.indexOf("--only"),only=at<0?null:process.argv[at+1];
  const rows=[];function test(name,fn){if(!only||name===only)rows.push({name,fn});}
  test("actual SAVE12 client refuses neutral SAVE13 maps at parse load and import doors",()=>{
    engine.makeTestWorld();worldState.world.location="The Boundary Clearing";
    global.showToast=()=>{};const A=atlasCreate("oldclient-733"),result=atlasPublicEnable();assert(result.ok,result.reason);
    atlasKnowledgeCommit("[MAP_REVEAL:new|a hut|hut|W|observed]",null,{commit:"oldclient-proof"});
    const payload=JSON.stringify({worldState,sessionLog,memory}),world=serializeWorldState();
    assert.equal(JSON.parse(world).ver,13);assert.equal(A.knowledge,1);
    const notices=[],disk=Object.create(null),old=vm.createContext({console:{log:()=>{},warn:(...v)=>notices.push(v.join(" ")),info:()=>{},error:(...v)=>notices.push(v.join(" "))},localStorage:{getItem:k=>disk[k]||null,setItem:(k,v)=>{disk[k]=String(v);},removeItem:k=>{delete disk[k];}}});
    for(const file of ["globals.js","helpers.js","state.js"])vm.runInContext(sourceAt(OLD_CLIENT,file),old,{filename:OLD_CLIENT.slice(0,7)+"/"+file});
    assert.equal(old.SAVE_VER,12,"historical gate must actually be the old client");
    old.incomingWorld=world;old.incomingPayload=payload;
    let unchanged=JSON.stringify(disk);
    assert.throws(()=>vm.runInContext("parseWorldState(incomingWorld)",old),e=>e.incompatible===true&&/save v13/.test(e.message)&&/reads v12/.test(e.message));
    assert.equal(JSON.stringify(disk),unchanged);
    disk[old.WSK]=world;disk[old.SLK]="[]";disk[old.MEM_KEY]=JSON.parse(payload).memory?JSON.stringify(JSON.parse(payload).memory):"{}";unchanged=JSON.stringify(disk);
    assert.equal(vm.runInContext("loadState()",old),false);assert.match(old.versionRefusedLoad(),/save v13/);assert.equal(JSON.stringify(disk),unchanged);
    old.worldState={sentinel:"outgoing world"};old.memory={sentinel:"outgoing memory"};old.sessionLog=[{sentinel:"outgoing log"}];
    const live=vm.runInContext("JSON.stringify([worldState,memory,sessionLog])",old);
    assert.throws(()=>vm.runInContext("importSaveData(JSON.parse(incomingPayload))",old),/save v13/);
    assert.equal(vm.runInContext("JSON.stringify([worldState,memory,sessionLog])",old),live);assert.equal(JSON.stringify(disk),unchanged);
    assert(notices.some(n=>n.includes("local load REFUSED")));assert(notices.some(n=>n.includes(".tnd import REFUSED")));
  });
  test("schematic specifications refuse every private source field before rendering",()=>{
    const spec={scale:"wild",title:"Known clearing",features:[]};
    for(const key of ["source","privateDoc","seed","terrain","rooms"]){const bad=Object.assign({},spec,{[key]:{secret:"UNINTRODUCED_STALGIND_CELLAR_733"}});assert.throws(()=>TnDMaps.schematic(bad),/unsupported field/);}
    const bad={scale:"wild",title:"Known clearing",features:[{id:"f1",name:"a hut",kind:"hut",bearing:"W",mode:"observed",owner:"Stalgind"}]};assert.throws(()=>TnDMaps.schematic(bad),/unsupported field/);
  });
  test("schematic document validation refuses nested private metadata",()=>{
    const doc=TnDMaps.schematic({scale:"wild",title:"Known clearing",features:[]});doc.generator.version={secret:"UNINTRODUCED_STALGIND_CELLAR_733"};
    assert.throws(()=>TnDMaps.validate(doc),/generator version/);assert.throws(()=>TnDMaps.scene.build(doc,"ink"),/generator version/);
  });
  let passed=0,failed=0;for(const t of rows){try{t.fn();passed++;console.log("PASS #733 migration boundary "+t.name);}catch(e){failed++;console.error(BOUNDARY+t.name+" — "+e.stack);}}
  if(!rows.length){console.error("matched 0 tests");return 1;}console.log((failed?"FAILED":"ALL GREEN")+" — "+passed+" historical/private-boundary checks");return failed?1:0;
}
if(process.argv.includes("--checks")){process.exitCode=checks();}
else{
  const baseline=cp.spawnSync(process.execPath,[__filename,"--checks"],{cwd:ROOT,encoding:"utf8"});process.stdout.write(baseline.stdout||"");process.stderr.write(baseline.stderr||"");if(baseline.status!==0)process.exit(1);
  const sabotage=require("./sabotage.js"),command=["node",["dev/tests-733-map-migration.js"]];let rc=0;
  rc|=sabotage.prove({file:"atlas-public.js",command,only:PREFIX,cases:[
    {label:"a public read silently performs schema migration",find:'p=atlasKnowledgeProjection(k);',replace:'atlasKnowledgeMigrate();p=atlasKnowledgeProjection(k);',mustFail:PREFIX+"public readers refuse typed legacy knowledge without silently upgrading it"},
    {label:"SAVE12 can activate knowledge it cannot preserve",find:'if(SAVE_VER<13||ATLAS_VER<2)',replace:'if(SAVE_VER<12||ATLAS_VER<2)',mustFail:PREFIX+"public activation requires the neutral save version before any write"},
    {label:"falsy damaged geography is mistaken for absent data",find:'hasKnowledge=Object.prototype.hasOwnProperty.call(memory.map,"geography");',replace:'hasKnowledge=!!memory.map.geography;',mustFail:PREFIX+"damaged and newer existing knowledge is refused without replacing any evidence"},
    {label:"activation is stamped before candidate construction can fail",find:'knowledge=hasKnowledge?memory.map.geography:MapKnowledge.create();',replace:'A.knowledge=1;knowledge=hasKnowledge?memory.map.geography:MapKnowledge.create();',mustFail:PREFIX+"failed candidate construction leaves the complete world-memory pair byte identical"},
    {label:"legacy evidence is discarded instead of backed up",find:'backup=JSON.parse(JSON.stringify(A));',replace:'backup={};',mustFail:PREFIX+"activation retains an exact detached backup of recipes notes visits and identities"},
    {label:"newer knowledge is overwritten on a repeated activation",find:'if(A.knowledge===1){p=MapKnowledge.problem(memory.map.geography);return p?{ok:false,reason:p}:{ok:true,already:true};}',replace:'if(A.knowledge===1){memory.map.geography=MapKnowledge.create();return {ok:true,already:true};}',mustFail:PREFIX+"repeated activation is byte identical and never nests or replaces the backup"},
    {label:"a private sheet identifier crosses the public drawing boundary",find:'if(!A||zoneId!==A.seed)throw new Error("public atlas: that sheet is not available");',replace:'if(!A)throw new Error("public atlas: that sheet is not available");',mustFail:PREFIX+"all five legacy scale recipes remain withheld from every public map surface"},
    {label:"private recipe names enter the public title",find:'title:atlasPublicTitle(),features:p.features.map',replace:'title:A.zones[A.seed].name,features:p.features.map',mustFail:PREFIX+"private-only edits leave the exact public scene and all labels unchanged"}
  ]});
  rc|=sabotage.prove({file:"atlas-knowledge-migrate.js",command,only:PREFIX,cases:[
    {label:"a failed durable backup permits converted memory to be saved",find:'if(saveCore())return true;',replace:'saveCore();return true;',mustFail:PREFIX+"a failed world backup write cannot persist converted legacy memory"},
    {label:"fresh activation bypasses version and legacy atlas backup durability",find:'function atlasKnowledgeCanSaveMemory(){',replace:'function atlasKnowledgeCanSaveMemory(){if(worldState&&worldState.atlas&&!worldState.atlas.legacyKnowledge)return true;',mustFail:PREFIX+"memory-only saves cannot persist fresh activation without its public world and legacy atlas backup"},
    {label:"typed provenance is discarded during schema conversion",find:'if(!backupPresent)A.legacyKnowledge=r.backup;',replace:'if(!backupPresent)A.legacyKnowledge={};',mustFail:PREFIX+"typed legacy knowledge upgrades once with an exact detached provenance backup"},
    {label:"a conflicting existing provenance backup is silently ignored",find:'if(r.upgraded&&backupPresent&&JSON.stringify(A.legacyKnowledge)!==JSON.stringify(r.backup))',replace:'if(false)',mustFail:PREFIX+"a conflicting prior legacy knowledge backup prevents replacement of either store"},
    {label:"invalid typed evidence bypasses migration refusal",find:'if(!r.ok)return {ok:false,changed:false,reason:r.reason};',replace:'',mustFail:PREFIX+"damaged typed legacy upgrades refuse before replacing current evidence or backup"}
  ]});
  rc|=sabotage.prove({file:"atlas.js",command,only:PREFIX,cases:[
    {label:"legacy and public note identities share the old dictionary",find:'return typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()?"publicNotes":"notes";',replace:'return "notes";',mustFail:PREFIX+"legacy note keys cannot attach old notes to unrelated new public identities"},
    {label:"public notes follow labels instead of stable feature handles",find:'return atlasNoteBucket()==="publicNotes"?String(id):zoneId+"|"+id;',replace:'return atlasNoteBucket()==="publicNotes"?atlasThingById(atlasDoc(zoneId),id).name:zoneId+"|"+id;',mustFail:PREFIX+"public notes follow stable feature handles through rename merge save and import"},
    {label:"the public map reader falls through to private procedural recipes",find:'function atlasDoc(zoneId){if(typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()){return atlasPublicDoc(zoneId);}',replace:'function atlasDoc(zoneId){',mustFail:PREFIX+"all five legacy scale recipes remain withheld from every public map surface"}
  ]});
  rc|=sabotage.prove({file:"state.js",command,only:PREFIX,cases:[
    {label:"legacy local load never persists its prepared conversion",find:'if(_mapHealed)saveMem();',replace:'',mustFail:PREFIX+"typed legacy local load persists the full backup before transformed memory"},
    {label:"a later memory save bypasses durable map backup checks",find:'if(typeof atlasKnowledgeCanSaveMemory==="function"&&!atlasKnowledgeCanSaveMemory())return false;',replace:'',mustFail:PREFIX+"a failed world backup write cannot persist converted legacy memory"},
    {label:"local parse ignores the save version gate",find:'var _vi=worldVersionIssue(o);if(_vi)',replace:'var _vi="";if(_vi)',mustFail:PREFIX+"old client refuses activated saves at local and import doors before any write"},
    {label:"tnd import ignores the save version gate",find:'var _ivi=worldVersionIssue(ws);if(_ivi)',replace:'var _ivi="";if(_ivi)',mustFail:PREFIX+"old client refuses activated saves at local and import doors before any write"}
  ]});
  rc|=sabotage.prove({file:"tndmaps.js",command:["node",["dev/sabotage-733-map-migration.js","--checks"]],only:BOUNDARY,cases:[
    {label:"the schematic API accepts a private source document",find:'fields(spec, ["scale", "title", "features"], "schematic specification");',replace:'fields(spec, ["scale", "title", "features", "source"], "schematic specification");',mustFail:BOUNDARY+"schematic specifications refuse every private source field before rendering"},
    {label:"nested private metadata can ride inside a public document",find:'string(doc.generator.version, 40, "schematic generator version");',replace:'',mustFail:BOUNDARY+"schematic document validation refuses nested private metadata"}
  ]});
  process.exitCode=rc?1:0;
}
