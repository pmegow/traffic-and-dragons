// #528: exercise the callers of the portrait gate, not just the gate in isolation.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),loader=require('./load-engine.js');
loader.loadEngine();
const saved=Object.create(null),messages=[];
global.localStorage={getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=String(v),removeItem:k=>delete saved[k]};
function element(){return {style:{},appendChild(){},remove(){},addEventListener(){},setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];}};}
global.document={getElementById:()=>element(),querySelector:()=>null,createElement:()=>element(),body:element()};
global.window=global;for(const f of ['ui-sheets.js','ui-browsers.js'])(0,eval)(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
global.showToast=m=>messages.push(String(m));global.modalShell=()=>element();global.saveAll=()=>{};
const bad="x' onerror='window.__portraitInjected=1",good='data:image/png;base64,iVBORw0KGgo=';
function fresh(){messages.length=0;return loader.makeTestWorld({campId:'portrait-fixture',campName:'Portrait fixture'});}
function refusal(){assert.ok(messages.some(m=>/portrait.*dropped/i.test(m)),'portrait rejection must be visible');}
for(const [label,apply] of [
 ['save import',p=>{const w=fresh();w.character.portrait=p;w.npcs=[{name:'Bram',portrait:p},{name:'Vex',portrait:p,charSheet:{...JSON.parse(JSON.stringify(w.character)),name:'Vex',portrait:p}}];const data=JSON.parse(JSON.stringify({worldState:w,memory,sessionLog:[]}));importSaveData(data);return [worldState.character.portrait,npcPortrait(worldState.npcs[0]),worldState.npcs[1].charSheet.portrait];}],
 ['hero library adoption',p=>{const w=fresh(),copy={...w.character,portrait:p};const result=adoptLibraryHero(copy,123);assert.equal(copy.portrait,p,'library source was mutated');return [result.portrait];}],
 ['companion library adoption',p=>{const w=fresh(),n={name:'Bram',partyMember:true},copy={...w.character,name:'Bram',portrait:p};w.npcs=[n];const result=adoptLibraryCompanion(n,copy,123);assert.equal(copy.portrait,p,'library source was mutated');return [result.portrait];}],
 ['character preview',p=>{const w=fresh(),c={...w.character,portrait:p};showCharImportPreview(c,()=>{},()=>{});return [c.portrait];}],
 ['quick start',p=>{const w=fresh();let received;startGame=c=>received=c;snapshotActiveCamp=()=>true;busy=false;localStorage.setItem(HOME_PENDING_QS_K,JSON.stringify({at:Date.now(),char:{...w.character,portrait:p},bp:{format:'tnd-blueprint-v1',name:'Taster',tone:'swords',premise:'A masquerade.',acts:[]}}));assert.equal(consumeHomeQuickStart(),true);assert.ok(received,'startGame did not receive the imported character');return [received.portrait];}]
]){assert.ok(apply(bad).every(p=>!p),label+': crafted portrait crossed the boundary');refusal();assert.ok(apply(good).every(p=>p===good),label+': valid portrait was lost');console.log('PASS #528 '+label+' rejects crafted portraits visibly and preserves images');}
