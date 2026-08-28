// bench-lz-memo.js — transcript-LZ memo bench for serializeWorldState.
// DEV TOOL, not loaded by index.html, not wired into any runner.
//   node dev/bench-lz-memo.js
// Builds a synthetic mature worldState (1,500 transcript entries × ~800 chars — the t308+
// class) and times 3 consecutive serializeWorldState calls:
//   CONTROL = memo reset before every call (3 real compressions);
//   CURRENT = memo live (1 compression + 2 hits — the current 3-saveAll shape).
var engine=require("./load-engine.js");
var loaded=engine.loadEngine();
if(loaded.join("|")!==engine.FILES.join("|")){
  console.error("BENCH LOAD FAILED: canonical engine load was partial or reordered");
  process.exit(1);
}

// ── Synthetic mature save: 1,500 entries × ~800 chars ─────────────────────────
function makePad(seed){
  var s="The party presses on through the "+seed+" dark, torches guttering against a wind that smells of old iron and rain; ";
  while(s.length<800)s+="somewhere behind the walls something heavy shifts its weight, and the sound follows them from room to room like a debt unpaid; ";
  return s.slice(0,800);
}
var tr=[];
for(var n=0;n<1500;n++)tr.push({t:n,r:n%2?"gm":"player",x:makePad(n%7),e:n%2?{n:["Bram","Vyra"],l:"Ashfen",q:["The Iron Debt"]}:undefined});
worldState={ver:10,campId:"bench",campName:"Bench",character:{name:"Tess",hp:14,maxHp:14,gold:25,inventory:[],level:5,xp:9000,abilities:[],spells:[],skills:{},conditions:[],relationships:[],saveModifiers:[],storyBeats:[],coreMemories:[]},
  world:{location:"Ashfen",region:"The Reach",time:"dusk",weather:"rain",threat:"low",sublocation:null},
  npcs:[],questLog:[],eventHistory:[],combat:null,turn:1500,transcript:tr};

var blob=serializeWorldState(); // warm-up + size probe (also JITs the path)
console.log("transcript: "+tr.length+" entries, "+JSON.stringify(tr).length+" chars plain; serialized core "+blob.length+" chars");

function ms(){return Number(process.hrtime.bigint())/1e6;}

// Control: defeat the memo before every call — each serialize pays a full LZ pass.
serializeWorldState._compressions=0;
var controlTimes=[],t0,t1;
for(var b=0;b<3;b++){
  serializeWorldState.invalidateTranscriptMemo(worldState.transcript);
  t0=ms();serializeWorldState();t1=ms();
  controlTimes.push(t1-t0);
}
var controlCompr=serializeWorldState._compressions;

// Current path: first call compresses, the next two hit.
serializeWorldState.invalidateTranscriptMemo(worldState.transcript); // cold start for fairness
serializeWorldState._compressions=0;
var currentTimes=[];
for(var a=0;a<3;a++){
  t0=ms();serializeWorldState();t1=ms();
  currentTimes.push(t1-t0);
}
var currentCompr=serializeWorldState._compressions;

function fmt(x){return x.toFixed(1)+"ms";}
function sum(arr){var s=0,i;for(i=0;i<arr.length;i++)s+=arr[i];return s;}
console.log("CONTROL (memo reset every call): "+controlTimes.map(fmt).join(" + ")+" = "+fmt(sum(controlTimes))+"  ("+controlCompr+" LZ passes)");
console.log("CURRENT (memo live):             "+currentTimes.map(fmt).join(" + ")+" = "+fmt(sum(currentTimes))+"  ("+currentCompr+" LZ pass)");
console.log("memo saving across 3 serializations: "+fmt(sum(controlTimes)-sum(currentTimes)));

// Sanity: memoized output byte-identical to a fresh compression
var hit=serializeWorldState();
serializeWorldState.invalidateTranscriptMemo(worldState.transcript);
var fresh=serializeWorldState();
if(hit!==fresh){console.error("FAIL: memoized blob != fresh blob");process.exit(1);}
console.log("byte-identity: memo hit === fresh compression ✓");
