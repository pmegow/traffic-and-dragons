// loc-repair-core.js — the #156 Phase B LOCATION REPAIR core (census + plan apply).
// Environment-neutral, the npc-merge-core precedent: consumed by BOTH the headless suite
// (dev/run-tests.js loads it after the engine) and the map_cleanup.html satellite. It drives
// the SHIPPING executors (locMerge/locReparent/locSplit/locAliasRegister, identity.js) — no
// copied engine logic, so this file cannot drift from the game. DEV TOOL support file, NOT in
// the index.html shell.
//
// CONTRACT: engine loaded first; `worldState`/`memory` point at the save under repair.
//
// The census PROPOSES groups with typed evidence and classifies NOTHING — every group starts
// "undecided"; classification (merge / reparent / split / leave) is human adjudication in the
// tool, per pair, never a batch (Sol §1). Evidence kinds, all domain-typed (Sol §6):
//   shadow                — world-level key X coexisting with a sub key whose LEAF is X
//   identical-description — two nodes carrying byte-identical non-null descriptions
//   leaf-variant          — two sub keys under the SAME resolved parent whose leaf token sets
//                           strictly contain one another (Rusty Dragon ⊂ Sandpoint - Rusty Dragon)
//   containment           — two world-level names whose token sets strictly contain one another
//                           ("Sandpoint" ⊂ "Sandpoint, Varisia")

function _lrcTokens(s){
  var raw=String(s||"").toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9\s]/g," ").split(/\s+/),out=[],i;
  for(i=0;i<raw.length;i++){if(raw[i]&&raw[i].length>=3)out.push(raw[i]);}
  return out;
}
function _lrcLeaf(k){var i=String(k).lastIndexOf("|");return i<0?String(k):String(k).slice(i+1);}
function _lrcSubset(a,b){ // strict: a ⊂ b
  if(!a.length||a.length>=b.length)return false;
  var i;for(i=0;i<a.length;i++){if(b.indexOf(a[i])<0)return false;}
  return true;
}
function locRepairCensus(){
  var nodes=memory.map.nodes,keys=Object.keys(nodes),groups=[],seenPair={},i,j;
  function propose(evidence,members,note){
    var sig=members.slice().sort().join("");
    if(seenPair[sig])return;
    seenPair[sig]=1;
    groups.push({evidence:evidence,members:members,note:note||"",classification:"undecided"});
  }
  var isSub={},leafLc={};
  for(i=0;i<keys.length;i++){isSub[keys[i]]=!!nodes[keys[i]].parent;leafLc[keys[i]]=_lrcLeaf(keys[i]).toLowerCase();}
  for(i=0;i<keys.length;i++){
    for(j=0;j<keys.length;j++){
      if(i===j)continue;
      var A=keys[i],B=keys[j];
      /* shadow: world-level A vs any other key whose leaf equals A (the "Sandpoint - Rusty
         Dragon" world node beside "Sandpoint|Sandpoint - Rusty Dragon") */
      if(!isSub[A]&&A.indexOf("|")<0&&B!==A&&leafLc[B]===A.toLowerCase())propose("shadow",[A,B],"world-level key coexists with a nested twin");
      if(j>i){
        var dA=nodes[A].description,dB=nodes[B].description;
        if(dA&&dB&&dA===dB)propose("identical-description",[A,B],"byte-identical descriptions");
        var tA=_lrcTokens(leafLc[A]),tB=_lrcTokens(leafLc[B]);
        var bothSub=isSub[A]&&isSub[B]&&typeof locSame==="function"&&nodes[A].parent&&nodes[B].parent&&locSame(nodes[A].parent,nodes[B].parent);
        var bothWorld=!isSub[A]&&!isSub[B]&&A.indexOf("|")<0&&B.indexOf("|")<0;
        if((bothSub||bothWorld)&&(_lrcSubset(tA,tB)||_lrcSubset(tB,tA))){
          propose(bothSub?"leaf-variant":"containment",[A,B],bothSub?"same parent, leaf token containment":"world-name token containment");
        }
      }
    }
  }
  return groups;
}

// Apply a repair plan — a list of classified operations:
//   {op:"merge",   canonical, duplicate}
//   {op:"reparent",key, newParent}          (newParent null = promote to world)
//   {op:"split",   key, spec}               (spec per locSplit)
//   {op:"alias",   canonical, alias}
// opts.dry=true runs the WHOLE plan against deep clones behind swapped globals (the UA1
// shadow-mode calling convention — executors read `worldState`/`memory` as globals) and
// returns the diff WITHOUT touching the real state; opts.dry=false runs it for real. The
// returned diff is one entry per op: {op, ok, receipts:[muts]}.
function locRepairApply(plan,opts){
  var dry=!!(opts&&opts.dry);
  var svM,svW;
  if(dry){
    svM=memory;svW=worldState;
    memory=JSON.parse(JSON.stringify(svM));
    worldState=JSON.parse(JSON.stringify(svW));
  }
  var diff=[],i;
  try{
    for(i=0;i<plan.length;i++){
      var p=plan[i],R={muts:[],turn:(worldState&&worldState.turn)||0},ok=false;
      if(p.op==="merge")ok=locMerge(p.canonical,p.duplicate,R);
      else if(p.op==="reparent")ok=locReparent(p.key,p.newParent||null,R);
      else if(p.op==="split")ok=locSplit(p.key,p.spec,R);
      else if(p.op==="alias")ok=locAliasRegister(p.canonical,p.alias,R);
      else if(typeof console!=="undefined")console.warn("[loc-repair] unknown op '"+p.op+"' — skipped");
      diff.push({op:p.op,ok:!!ok,receipts:R.muts});
    }
  }finally{
    if(dry){memory=svM;worldState=svW;if(typeof _locResGen!=="undefined")_locResGen++;/* drop memo entries primed against the clone */}
  }
  return diff;
}

// node CLI self-test / repair driver:
//   node dev/loc-repair-core.js census <save.tnd>
//   node dev/loc-repair-core.js apply  <save.tnd> <plan.json> <out.tnd>   (omit out = dry-run)
if(typeof module!=="undefined"&&typeof require!=="undefined"&&require.main===module){
  (function(){
    addMsg=function(){};escHtml=function(s){return s;};showToast=function(){};updateCombat=function(){};syncUI=function(){};
    var eng=require("./load-engine.js");eng.loadEngine("game.js");
    var fs=require("fs");
    var mode=process.argv[2],save=process.argv[3];
    if(!mode||!save){console.log("usage: node dev/loc-repair-core.js census|apply <save.tnd> [plan.json] [out.tnd]");process.exit(2);}
    var d=JSON.parse(fs.readFileSync(save,"utf8"));
    worldState=d.worldState;memory=d.memory;sessionLog=[];
    if(mode==="census"){
      var g=locRepairCensus();
      console.log(JSON.stringify(g,null,2));
      console.log("// "+g.length+" suspected group(s) — classification is yours, per pair");
      return;
    }
    if(mode==="apply"){
      var plan=JSON.parse(fs.readFileSync(process.argv[4],"utf8"));
      var out=process.argv[5];
      var diff=locRepairApply(plan,{dry:!out});
      console.log(JSON.stringify(diff,null,2));
      if(out){
        d.worldState=worldState;d.memory=memory;
        fs.writeFileSync(out,JSON.stringify(d,null,2));
        console.log("// repaired save -> "+out);
      }else console.log("// DRY RUN — nothing written");
      return;
    }
    console.log("unknown mode "+mode);process.exit(2);
  })();
}
