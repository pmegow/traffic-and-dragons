// _bench_A1.js — bench for audit 07-16 row #1 (transcript-LZ memo in serializeWorldState).
// DEV TOOL, not loaded by index.html, not wired into any runner.
//   node dev/_bench_A1.js
// Builds a synthetic mature worldState (1,500 transcript entries × ~800 chars — the t308+
// class) and times 3 consecutive serializeWorldState calls:
//   BEFORE = memo defeated via invalidateTranscriptMemo before every call (the old
//            recompress-every-saveAll behavior, byte-identical output path);
//   AFTER  = memo live (1 compression + 2 hits — the real 3-saveAll-per-turn shape).
// Loader copied from dev/run-tests.js (same files, same order, same indirect-eval).
var fs=require("fs");
var path=require("path");
var root=path.join(__dirname,"..");
var files=["globals.js","compress.js","data.js","capability_bible.js","helpers.js","state.js","storage-adapter.js","memory.js","tag_table.js","api.js","campaign_generator.js","game.js","tts.js"];
var geval=eval; // indirect eval → runs in global scope, so the engine's `var`s become globals
for(var i=0;i<files.length;i++){
  try{geval(fs.readFileSync(path.join(root,files[i]),"utf8"));}
  catch(e){console.error("ENGINE LOAD FAILED in "+files[i]+": "+e.message);process.exit(1);}
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

// BEFORE: defeat the memo before every call — each serialize pays a full LZ pass
serializeWorldState._compressions=0;
var beforeTimes=[],t0,t1;
for(var b=0;b<3;b++){
  serializeWorldState.invalidateTranscriptMemo(worldState.transcript);
  t0=ms();serializeWorldState();t1=ms();
  beforeTimes.push(t1-t0);
}
var beforeCompr=serializeWorldState._compressions;

// AFTER: memo live — first call compresses, the next two hit
serializeWorldState.invalidateTranscriptMemo(worldState.transcript); // cold start for fairness
serializeWorldState._compressions=0;
var afterTimes=[];
for(var a=0;a<3;a++){
  t0=ms();serializeWorldState();t1=ms();
  afterTimes.push(t1-t0);
}
var afterCompr=serializeWorldState._compressions;

function fmt(x){return x.toFixed(1)+"ms";}
function sum(arr){var s=0,i;for(i=0;i<arr.length;i++)s+=arr[i];return s;}
console.log("BEFORE (recompress every call): "+beforeTimes.map(fmt).join(" + ")+" = "+fmt(sum(beforeTimes))+"  ("+beforeCompr+" LZ passes)");
console.log("AFTER  (memoized):              "+afterTimes.map(fmt).join(" + ")+" = "+fmt(sum(afterTimes))+"  ("+afterCompr+" LZ pass)");
console.log("per-turn saving (3 saveAlls): "+fmt(sum(beforeTimes)-sum(afterTimes)));

// Sanity: memoized output byte-identical to a fresh compression
var hit=serializeWorldState();
serializeWorldState.invalidateTranscriptMemo(worldState.transcript);
var fresh=serializeWorldState();
if(hit!==fresh){console.error("FAIL: memoized blob != fresh blob");process.exit(1);}
console.log("byte-identity: memo hit === fresh compression ✓");
