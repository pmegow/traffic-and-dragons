// bench-rag-memo.js — current/control bench for the RAG wrapper memos.
// DEV TOOL, not loaded by index.html and not wired into run-tests.js.
//   node dev/bench-rag-memo.js
// Loads the canonical engine, builds a synthetic mature campaign
// (120 memory.npcs entries with multi-token names + aliases, 1,500-entry transcript, all GM
// entries pre-stamped with .e so neither pass pays the one-time lazy backfill), then times:
//   (a) 5× ragKnownNames  — the ~5 rebuilds a turn used to pay
//   (b) 2× ragRetrieve    — the main-build + suggestion-build pair
// CONTROL resets each wrapper memo before every call; CURRENT leaves both wrappers live.
var engine=require("./load-engine.js");
var loaded=engine.loadEngine();
if(loaded.join("|")!==engine.FILES.join("|")){
  console.error("BENCH LOAD FAILED: canonical engine load was partial or reordered");
  process.exit(1);
}
addMsg=function(){return{appendChild:function(){},style:{},remove:function(){}};};
showToast=function(){};syncUI=function(){};saveAll=function(){};saveCore=function(){};saveMem=function(){};

// ── synthetic mature campaign ────────────────────────────────────────────────
var FIRST=["Aldara","Belor","Cavren","Daeris","Ekene","Frizwick","Gorim","Halvard","Ionna","Jorven","Kaelis","Lumen","Morwen","Nyssa","Orin","Pella","Quon","Rusk","Sable","Tsuto"];
var SUR=["Ashcombe","Blackwood","Crane","Dunmore","Eastvale","Fenwick","Greymantle","Hemlock","Ironbrand","Kaijitsu","Loamsdown","Marsh","Nightriver","Oakhollow","Pryce","Quill","Ravenscar","Stormont","Thistledown","Underbough"];
var HON=["","","Sheriff ","Captain ","Mistress ","Elder "]; // some honorific-keyed entries → collapse work
function buildFixture(){
  memory=blankMemory();sessionLog=[{role:"user",content:"x"},{role:"assistant",content:"y"}];
  var names=[],i;
  for(i=0;i<120;i++){
    var nm=HON[i%HON.length]+FIRST[i%20]+" "+SUR[(i*7+3)%20]+(i%10===0?" the "+["Bold","Grey","Quiet","Red"][i%4]:"");
    names.push(nm);
    memory.npcs[nm]={attitude:"neutral",knowledge:[],events:[],aliases:(i%3===0?[FIRST[i%20]+" of "+SUR[(i*7+3)%20]]:[]),lastSeenAt:(i%5===0?"Ashfen":null)};
  }
  var tr=[],t;
  for(t=0;t<750;t++){
    var who=names[t%120],who2=names[(t*13+7)%120];
    tr.push({t:t+1,r:"player",x:"I ask "+who+" about the ledger and the toll road while "+who2+" watches."});
    tr.push({t:t+1,r:"gm",x:who+" leans back and speaks of the ledger, the broadsheet, and the road toll. "+who2+" nods. The rain keeps falling on the shutters while the lamplight gutters and the ledger sits between them on the scarred table.",e:{n:[who,who2],l:(t%4?"Ashfen":"Greyford"),q:[]}});
  }
  worldState={ver:10,campId:null,campName:"Bench",character:{name:"Tess",relationships:[],conditions:[],inventory:[],abilities:[],spells:[],storyBeats:[],languages:[],skills:{}},
    world:{location:"Ashfen",region:"R",time:"dusk",weather:"rain",threat:"low",sublocation:null},
    npcs:[{name:names[0],status:"ally",rel:"c",partyMember:true},{name:names[1],status:"ally",rel:"c",partyMember:true}],
    questLog:[{title:"The Toll",status:"active",desc:"",objectives:[],started:1}],
    eventHistory:[],combat:null,turn:800,transcript:tr,ragMemory:true};
  // Reset the memos (when present) so every bench run measures the honest per-turn pattern —
  // first call cold (one real rebuild/pass), subsequent calls hits. Without this the AFTER
  // runs 2+ hit across runs (the rebuilt fixture is byte-identical, so the fingerprint
  // legitimately matches) and the cold cost never shows.
  if(typeof ragKnownNames==="function"&&ragKnownNames._memo!==undefined)ragKnownNames._memo=null;
  if(typeof ragRetrieve==="function"&&ragRetrieve._memo!==undefined)ragRetrieve._memo=null;
}
var INPUT="I ask Sheriff Cavren Fenwick about the ledger and the broadsheet";
function ms(){var h=process.hrtime();return h[0]*1000+h[1]/1e6;}
function bench(label,resetEach){
  buildFixture();
  // (a) 5× ragKnownNames — one turn's worth of rebuilds
  var t0=ms(),i;
  for(i=0;i<5;i++){
    if(resetEach)ragKnownNames._memo=null;
    ragKnownNames();
  }
  var tNames=ms()-t0;
  // (b) 2× ragRetrieve — main prompt build + suggestion build
  if(resetEach)ragRetrieve._memo=null;
  t0=ms();
  var r1=ragRetrieve(INPUT);
  var t1st=ms()-t0;
  if(resetEach)ragRetrieve._memo=null;
  t0=ms();
  var r2=ragRetrieve(INPUT);
  var t2nd=ms()-t0;
  if(r1!==r2)console.error("  !! "+label+": second retrieve diverged from the first — INVESTIGATE");
  console.log(label+": 5x ragKnownNames = "+tNames.toFixed(2)+" ms | ragRetrieve 1st = "+t1st.toFixed(2)+" ms, 2nd = "+t2nd.toFixed(2)+" ms (2x total "+(t1st+t2nd).toFixed(2)+" ms) | block "+r1.length+" chars");
  return {names:tNames,r1:t1st,r2:t2nd};
}
// warm up the JIT on the fixture builder + engine paths once, unmeasured
buildFixture();ragKnownNames();ragRetrieve(INPUT);

console.log("── CONTROL (wrapper memos reset every call) ──");
var c1=bench("control run 1",true),c2=bench("control run 2",true),c3=bench("control run 3",true);

console.log("── CURRENT (wrapper memos live) ──");
var m1=bench("current run 1",false),m2=bench("current run 2",false),m3=bench("current run 3",false);

function med(a,b,c){var s=[a,b,c].sort(function(x,y){return x-y;});return s[1];}
console.log("── medians ──");
console.log("5x ragKnownNames: control "+med(c1.names,c2.names,c3.names).toFixed(2)+" ms → current "+med(m1.names,m2.names,m3.names).toFixed(2)+" ms");
console.log("ragRetrieve 1st (cold): control "+med(c1.r1,c2.r1,c3.r1).toFixed(2)+" ms → current "+med(m1.r1,m2.r1,m3.r1).toFixed(2)+" ms");
console.log("ragRetrieve 2nd (repeat): control "+med(c1.r2,c2.r2,c3.r2).toFixed(2)+" ms → current "+med(m1.r2,m2.r2,m3.r2).toFixed(2)+" ms");
