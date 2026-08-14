// npc-merge-core.js — the SHARED UA29 merge engine (spec: RESOLVE_NPC_INVARIANTS.md §7).
// Environment-neutral: consumed by BOTH dev/npc-merge-tool.js (node CLI) and
// dev/npc-merge-studio.html (browser UI). ONE implementation of grouping, surgery, and
// verification — the two hosts only differ in how they load a .tnd and render output.
// DEV TOOL support file, NOT loaded by index.html.
//
// CONTRACT: expects the real engine to be loaded first (globals→…→tag_table load order) and
// the globals `worldState` / `memory` / `sessionLog` to point at the save under surgery.
// It calls the SHIPPING resolveNpcName / npcCoreTokens / ragKnownNames / ragRetrieve and
// drives the SHIPPING NPC_MERGE handler out of TAG_TABLE — no copied engine logic, so this
// file cannot drift from the game.
//
// All output goes through a caller-supplied `log(level, text)` callback,
// level ∈ "info" | "ok" | "note" | "warn" | "fatal". Nothing here reads argv, fs, or DOM.

// ── tiny helpers ──
function nmcTrim(s,max){s=String(s==null?"":s).replace(/\s+/g," ");if(s.length>max)s=s.slice(0,max-1)+"…";return s;}
function nmcLiveKeys(){return Object.keys(memory.npcs||{});}
function nmcIsLive(name){return !!(memory.npcs&&Object.prototype.hasOwnProperty.call(memory.npcs,name));}
function nmcWsEntry(name){var i,l=worldState.npcs||[];for(i=0;i<l.length;i++){if(l[i].name===name)return l[i];}return null;}
function nmcTr(){return worldState.transcript||[];}
function nmcPlayerName(){return (worldState.character&&worldState.character.name)||"";}
// eligibility mirror of ragRetrieve's candidate filter (recent-window + rc + meta-exchange)
function nmcRagCutT(){var skipN=Math.max(2,Math.ceil(((typeof sessionLog!=="undefined"&&sessionLog)?sessionLog.length:0)/2)+1);return (worldState.turn||0)-skipN;}
function nmcStampedEntries(name){ // GM transcript entries whose write-time e.n index carries `name`, ragRetrieve-eligible
  var out=[],cutT=nmcRagCutT(),TR=nmcTr(),i;
  for(i=0;i<TR.length;i++){
    var en=TR[i];
    if(en.r!=="gm"||!en.e||!en.e.n)continue;
    if(en.e.n.indexOf(name)<0)continue;
    if(en.t>cutT)continue;
    if(en.rc)continue;
    var prev=i>0&&TR[i-1].r==="player"?String(TR[i-1].x).toLowerCase():"";
    if(/^\s*gm\s*[:,]/.test(prev))continue;
    out.push(i);
  }
  return out;
}
function nmcStampCount(name){var c=0,TR=nmcTr(),i;for(i=0;i<TR.length;i++){var en=TR[i];if(en.r==="gm"&&en.e&&en.e.n&&en.e.n.indexOf(name)>=0)c++;}return c;}
function nmcResolveClass(name){
  if(nmcIsLive(name))return {cls:"live"};
  var r=resolveNpcName(name);
  if(r!==name&&nmcIsLive(r))return {cls:"resolves",to:r};
  if(name===nmcPlayerName())return {cls:"player"};
  return {cls:"unresolved"};
}
function nmcFindMergeHandler(){
  var i;
  for(i=0;i<TAG_TABLE.length;i++){if(TAG_TABLE[i].t==="NPC_MERGE")return TAG_TABLE[i];}
  return null;
}

// ── proposal engine ──
// Links: (a) token-subset pairs — same predicate as resolver stage 4, over real
// npcCoreTokens; (b) alias-claims — live key K2 sitting in K1.aliases (a corruption:
// exact-key beats alias, so K2 writes never reach K1). Union-find into groups; a group
// with >=2 distinct maximal token identities is AMBIGUOUS (the two-Aldaras hazard, E4).
function nmcBuildGroups(){
  var keys=nmcLiveKeys(),cores={},i,j;
  for(i=0;i<keys.length;i++)cores[keys[i]]=npcCoreTokens(keys[i]);
  var parent={};
  function find(x){while(parent[x]!==x)x=parent[x]=parent[parent[x]];return x;}
  function union(a,b){var ra=find(a),rb=find(b);if(ra!==rb)parent[ra]=rb;}
  for(i=0;i<keys.length;i++)parent[keys[i]]=keys[i];
  var aliasClaims=[]; // {owner, claimed}
  for(i=0;i<keys.length;i++){
    for(j=0;j<keys.length;j++){
      if(i===j)continue;
      var a=keys[i],b=keys[j];
      var als=memory.npcs[a].aliases||[];
      if(als.indexOf(b)>=0){union(a,b);aliasClaims.push({owner:a,claimed:b});}
      if(j>i){
        var ca=cores[a],cb=cores[b];
        if(ca.length&&cb.length){ // empty cores never link — I3
          var shortT=ca.length<=cb.length?ca:cb,longT=ca.length<=cb.length?cb:ca,ok=true,t;
          for(t=0;t<shortT.length;t++){if(longT.indexOf(shortT[t])<0){ok=false;break;}}
          if(ok)union(a,b);
        }
      }
    }
  }
  var byRoot={},groups=[];
  for(i=0;i<keys.length;i++){
    var r=find(keys[i]);
    if(!byRoot[r])byRoot[r]=[];
    byRoot[r].push(keys[i]);
  }
  for(i in byRoot){if(byRoot[i].length>1)groups.push(byRoot[i]);}
  var out=[],g;
  for(g=0;g<groups.length;g++){
    var mem=groups[g],maximal=[],sigs={},m,n;
    for(m=0;m<mem.length;m++){
      var cm=cores[mem[m]],dominated=false;
      for(n=0;n<mem.length&&!dominated;n++){
        if(m===n)continue;
        var cn=cores[mem[n]];
        if(!cm.length){dominated=cn.length>0;continue;} // empty-core member defers to any named member
        if(cn.length<=cm.length)continue;
        var isSub=true,t2;
        for(t2=0;t2<cm.length;t2++){if(cn.indexOf(cm[t2])<0){isSub=false;break;}}
        if(isSub)dominated=true; // strictly larger superset exists → not maximal
      }
      if(!dominated){
        maximal.push(mem[m]);
        sigs[cm.slice().sort().join("␟")]=1;
      }
    }
    var sigCount=Object.keys(sigs).length;
    // proposed canonical: most tokens, then longest raw string (only when unambiguous)
    var canon=null;
    if(sigCount<=1){
      for(m=0;m<maximal.length;m++){
        if(!canon)canon=maximal[m];
        else{
          var cc=cores[canon],cm2=cores[maximal[m]];
          if(cm2.length>cc.length||(cm2.length===cc.length&&maximal[m].length>canon.length))canon=maximal[m];
        }
      }
      if(!canon)canon=mem[0]; // all-empty-core group linked by alias claims only
    }
    out.push({members:mem,maximal:maximal,ambiguous:sigCount>1,canonical:canon,cores:cores});
  }
  return {groups:out,aliasClaims:aliasClaims};
}

// evidence struct for one key — hosts format it (text for the CLI, DOM for the studio)
function nmcKeyEvidence(k){
  var e=memory.npcs[k]||{};
  var ws=nmcWsEntry(k);
  return {
    key:k,
    tokens:npcCoreTokens(k),
    aliases:e.aliases||[],
    attitude:e.attitude||"",
    knowledge:e.knowledge||[],
    events:e.events||[],
    firstEncounter:e.firstEncounter||"",
    lastSeenAt:e.lastSeenAt||"",
    stamps:nmcStampCount(k),
    roster:ws?{status:ws.status||"",rel:ws.rel||"",met:ws.met,partyMember:!!ws.partyMember,
               charSheet:ws.charSheet?{level:ws.charSheet.level,cls:ws.charSheet.cls}:null,
               pronouns:ws.pronouns||""}:null
  };
}

// hazard notes for a group (used by both hosts alongside the ambiguity flag)
function nmcGroupHazards(group){
  var out=[],party=0,sheets=0,prons={},j;
  for(j=0;j<group.members.length;j++){
    var w=nmcWsEntry(group.members[j]);
    if(w&&w.partyMember)party++;
    if(w&&w.charSheet)sheets++;
    if(w&&w.pronouns)prons[w.pronouns]=1;
  }
  if(party>1)out.push(party+" members are flagged partyMember — merging keeps the flag, but verify these really are one person");
  if(sheets>1)out.push(sheets+" members carry a charSheet — the merge keeps ONLY the canonical's sheet; the other sheet(s) would be DROPPED. Review before applying.");
  var pk=Object.keys(prons);
  if(pk.length>1)out.push("conflicting pronouns across members: "+pk.join(" vs ")+" — possible distinct people");
  return out;
}

// ── plan validation (shared by CLI args and studio selections) ──
// plan = [{canonical:"...", dupes:["...",...]}] — returns [] when valid, else error strings.
function nmcValidatePlan(plan){
  var errs=[],seenDupe={},canons={},g,d;
  if(!plan||!plan.length)return ["merge plan is empty"];
  for(g=0;g<plan.length;g++){
    var c=plan[g].canonical;
    if(!c||!plan[g].dupes||!plan[g].dupes.length){errs.push("plan entry "+(g+1)+" needs a canonical and at least one dupe");continue;}
    if(!nmcIsLive(c))errs.push("canonical \""+c+"\" is not a live memory.npcs key (keys are case-sensitive)");
    if(/[\[\]|]/.test(c))errs.push("canonical \""+c+"\" contains [ ] or | — cannot route through the NPC_MERGE handler");
    canons[c]=1;
    for(d=0;d<plan[g].dupes.length;d++){
      var dd=plan[g].dupes[d];
      if(!nmcIsLive(dd))errs.push("dupe \""+dd+"\" is not a live memory.npcs key");
      if(dd===c)errs.push("\""+c+"\" listed as its own dupe");
      if(seenDupe[dd])errs.push("dupe \""+dd+"\" appears in two merge groups");
      if(/[\[\]|]/.test(dd))errs.push("dupe \""+dd+"\" contains [ ] or | — cannot route through the NPC_MERGE handler");
      seenDupe[dd]=1;
    }
  }
  for(g=0;g<plan.length;g++){
    if(seenDupe[plan[g].canonical])errs.push("\""+plan[g].canonical+"\" is a canonical in one group and a dupe in another — order-dependent; restructure the plan");
  }
  return errs;
}

// ── the surgery (spec §7) ──
// Runs the REAL live NPC_MERGE handler for items 1–5, then the residue sites the handler
// misses (item 6). Throws on a handler no-op so hosts can abort before writing anything.
function nmcMergePair(canonical,dupe,log){
  log("info","merging \""+dupe+"\" ⇒ \""+canonical+"\"");
  var dupEntry=memory.npcs[dupe];
  var dupLastSeen=dupEntry?dupEntry.lastSeenAt:null;
  var dupWs=nmcWsEntry(dupe),canWsBefore=nmcWsEntry(canonical);
  if(dupWs&&dupWs.charSheet&&canWsBefore&&canWsBefore.charSheet)
    log("warn","BOTH carry a charSheet — the dupe's sheet (Lv"+(dupWs.charSheet.level||"?")+" "+(dupWs.charSheet.cls||"?")+") is DROPPED, canonical's kept (live-handler behavior)");
  // 1–5: the REAL live handler (memory.npcs absorb + bridge alias, worldState.npcs,
  // npcGraph, player relationships) driven with a synthetic tag.
  var handler=nmcFindMergeHandler();
  if(!handler)throw new Error("NPC_MERGE handler not found in TAG_TABLE — tag_table.js changed shape?");
  var R={turn:worldState.turn||0,muts:[]};
  handler.apply("[NPC_MERGE:"+canonical+"|"+dupe+"]",R);
  if(!R.muts.length)throw new Error("live NPC_MERGE handler reported no mutation for \""+dupe+"\" ⇒ \""+canonical+"\"");
  log("info","handler: "+R.muts.join("; "));
  var can=memory.npcs[canonical];
  // spec §7.1: pre-trim events to the newest 8 by turn (steady-state shape)
  if(can.events&&can.events.length>8){
    can.events.sort(function(a,b){return (a.turn||0)-(b.turn||0);});
    var dropped=can.events.length-8;
    can.events=can.events.slice(-8);
    log("info","events pre-trimmed to newest 8 (dropped "+dropped+" oldest)");
  }
  // defensive: canonical's own name must never sit in its alias list
  if(can.aliases){var si=can.aliases.indexOf(canonical);if(si>=0){can.aliases.splice(si,1);log("warn","removed self-alias \""+canonical+"\" from its own alias list");}}
  // ── residue site 1: memory.map node npcs[] + lastSeenAt (spec §7.6) ──
  var nodesTouched=0,k;
  if(memory.map&&memory.map.nodes){
    for(k in memory.map.nodes){
      var nl=memory.map.nodes[k].npcs||[];
      var di=nl.indexOf(dupe);
      if(di>=0){
        if(nl.indexOf(canonical)>=0)nl.splice(di,1);
        else nl[di]=canonical;
        nodesTouched++;
      }
    }
  }
  if(nodesTouched)log("info","map nodes rewritten: "+nodesTouched+" node npcs[] entries \""+dupe+"\" → \""+canonical+"\"");
  if(dupLastSeen){
    if(!can.lastSeenAt){can.lastSeenAt=dupLastSeen;log("info","lastSeenAt adopted from dupe: \""+dupLastSeen+"\"");}
    else if(can.lastSeenAt!==dupLastSeen&&memory.map&&memory.map.nodes){
      var cn=memory.map.nodes[can.lastSeenAt],dn=memory.map.nodes[dupLastSeen];
      var cStamp=cn?(cn.lastVisit||cn.firstVisit||0):0,dStamp=dn?(dn.lastVisit||dn.firstVisit||0):0;
      if(dStamp>cStamp){log("info","lastSeenAt: dupe's \""+dupLastSeen+"\" (node stamp t"+dStamp+") is newer than canonical's \""+can.lastSeenAt+"\" (t"+cStamp+") — adopted");can.lastSeenAt=dupLastSeen;}
      else log("info","lastSeenAt: kept canonical's \""+can.lastSeenAt+"\" (t"+cStamp+" ≥ dupe's t"+dStamp+")");
    }
  }
  // ── residue site 2: companion charSheet relationships (spec §7.6) ──
  var relTouched=0,i,j;
  for(i=0;i<worldState.npcs.length;i++){
    var n=worldState.npcs[i];
    if(!n.charSheet||!n.charSheet.relationships)continue;
    var out=[],seen={};
    for(j=0;j<n.charSheet.relationships.length;j++){
      var r=n.charSheet.relationships[j];
      if(r.entity===dupe){r.entity=canonical;relTouched++;}
      /* P4b (#169): first-wins used to DROP the later row wholesale — a rekeyed duplicate
         carrying the only bond lost it silently. Empty axes now backfill from the dropped
         row; a genuine conflict stays first-wins but says so. */
      if(!seen[r.entity]){seen[r.entity]=r;out.push(r);}
      else{var kept=seen[r.entity];
        if(r.bond&&!kept.bond){kept.bond=r.bond;kept.bondTurn=r.bondTurn;}
        if(r.dynamic&&!kept.dynamic){kept.dynamic=r.dynamic;kept.dynamicTurn=r.dynamicTurn;}
        if(r.bond&&kept.bond&&r.bond!==kept.bond)console.warn("[merge-core] conflicting bond on "+r.entity+" dropped (kept '"+kept.bond+"', lost '"+r.bond+"')");
      }
    }
    n.charSheet.relationships=out;
  }
  if(relTouched)log("info","companion-sheet relationship entities rewritten: "+relTouched);
  // ── residue site 3: coreMemories .who, live + archive (spec §7.6) ──
  var whoTouched=0;
  var cms=worldState.coreMemories||[];
  for(i=0;i<cms.length;i++){if(cms[i].who===dupe){cms[i].who=canonical;whoTouched++;}}
  var acm=(memory.archive&&memory.archive.coreMemories)||[];
  for(i=0;i<acm.length;i++){if(acm[i].who===dupe){acm[i].who=canonical;whoTouched++;}}
  if(whoTouched)log("info","coreMemories .who rewritten: "+whoTouched);
  // graph hygiene the bulk merge can create: self-edges and exact duplicates
  if(memory.npcGraph&&memory.npcGraph.edges){
    var ed=memory.npcGraph.edges,kept=[],sig={},selfDropped=0,dupDropped=0;
    for(i=0;i<ed.length;i++){
      if(ed[i].a===ed[i].b){selfDropped++;continue;}
      var s=JSON.stringify([ed[i].a<ed[i].b?ed[i].a:ed[i].b,ed[i].a<ed[i].b?ed[i].b:ed[i].a,ed[i].rel||""]);
      if(sig[s]){dupDropped++;continue;}
      sig[s]=1;kept.push(ed[i]);
    }
    if(selfDropped||dupDropped){memory.npcGraph.edges=kept;log("info","npcGraph hygiene: dropped "+selfDropped+" self-edge(s), "+dupDropped+" duplicate edge(s) created by the rewrite");}
    var nf=memory.npcGraph.npcFactions;
    if(nf&&nf[canonical]&&nf[canonical].length>1){
      var fOut=[],fSig={};
      for(i=0;i<nf[canonical].length;i++){var fs2=JSON.stringify(nf[canonical][i]);if(!fSig[fs2]){fSig[fs2]=1;fOut.push(nf[canonical][i]);}}
      if(fOut.length<nf[canonical].length){log("info","npcFactions deduped for canonical ("+(nf[canonical].length-fOut.length)+" dropped)");nf[canonical]=fOut;}
    }
  }
  // NOT touched, by design (spec §7.6 + closing list): keyDecisions/lore prose,
  // transcript text and e.n stamps — the alias trail written above keeps them resolvable.
}
function nmcApplyPlan(plan,log){
  var g,d;
  for(g=0;g<plan.length;g++){
    log("info","GROUP: \""+plan[g].canonical+"\" absorbs "+plan[g].dupes.length+" dupe(s)");
    for(d=0;d<plan[g].dupes.length;d++)nmcMergePair(plan[g].canonical,plan[g].dupes[d],log);
  }
}

// ── post-checks (spec §7 items 2 + 9) — returns fatal count; write is gated on 0 ──
function nmcPostChecks(plan,log){
  var fatal=0,g,d,i,j;
  // A. every dupe resolves to its canonical via the REAL resolver (bridge = stage-3 alias)
  for(g=0;g<plan.length;g++){
    for(d=0;d<plan[g].dupes.length;d++){
      var got=resolveNpcName(plan[g].dupes[d]);
      if(got===plan[g].canonical)log("ok","A. resolveNpcName(\""+plan[g].dupes[d]+"\") → \""+got+"\"");
      else{fatal++;log("fatal","A. resolveNpcName(\""+plan[g].dupes[d]+"\") → \""+got+"\" (expected \""+plan[g].canonical+"\") — THE BRIDGE IS BROKEN");}
    }
  }
  // B. I10: alias uniqueness + no live-key shadowing
  var owner={},keys=nmcLiveKeys(),bFatal=0;
  for(i=0;i<keys.length;i++){
    var als=memory.npcs[keys[i]].aliases||[];
    for(j=0;j<als.length;j++){
      if(owner[als[j]]&&owner[als[j]]!==keys[i]){bFatal++;log("fatal","B. I10: alias \""+als[j]+"\" claimed by \""+owner[als[j]]+"\" AND \""+keys[i]+"\"");}
      else owner[als[j]]=keys[i];
      if(nmcIsLive(als[j])){bFatal++;log("fatal","B. alias \""+als[j]+"\" (of \""+keys[i]+"\") is still a LIVE key — exact-key beats alias, bridge dead");}
    }
  }
  fatal+=bFatal;
  if(!bFatal)log("ok","B. I10 holds post-merge: no alias claimed twice, none shadowed by a live key");
  // C. RAG bridge probe — real ragRetrieve on a throwaway clone (never dirties the output:
  //    retrieval lazily backfills .e on old entries, and the probe forces the flag on).
  for(g=0;g<plan.length;g++){
    var canonical=plan[g].canonical,stamped=[],dupSet={};
    for(d=0;d<plan[g].dupes.length;d++){
      dupSet[plan[g].dupes[d]]=1;
      stamped=stamped.concat(nmcStampedEntries(plan[g].dupes[d]));
    }
    if(!stamped.length){
      log("note","C. \""+canonical+"\": no ragRetrieve-eligible transcript entries stamped with a merged dupe — probe vacuous (nothing for the bridge to carry). PASS with note.");
      continue;
    }
    var savedWS=worldState,savedMem=memory,savedSL=sessionLog,hit=false,rendered=false,probeText="";
    try{
      worldState=JSON.parse(JSON.stringify(savedWS));
      memory=JSON.parse(JSON.stringify(savedMem));
      sessionLog=JSON.parse(JSON.stringify(savedSL));
      worldState.ragMemory=true; // clone-only: force the flag so the probe runs even on RAG-off saves
      probeText="Tell me everything about "+canonical+" and what happened with "+plan[g].dupes.join(" and ");
      var block=ragRetrieve(probeText);
      var cands=ragRetrieve._cands||[];
      for(i=0;i<cands.length&&!hit;i++){
        var en=worldState.transcript[cands[i].i];
        if(en&&en.e&&en.e.n){for(j=0;j<en.e.n.length;j++){if(dupSet[en.e.n[j]]){hit=true;break;}}}
      }
      if(hit&&block){
        for(i=0;i<cands.length;i++){var en2=worldState.transcript[cands[i].i];if(en2&&block.indexOf("[Turn "+en2.t)>=0&&en2.e&&en2.e.n){for(j=0;j<en2.e.n.length;j++){if(dupSet[en2.e.n[j]]){rendered=true;break;}}}}
      }
    }finally{
      worldState=savedWS;memory=savedMem;sessionLog=savedSL;
    }
    if(hit){
      log("ok","C. \""+canonical+"\": ragRetrieve probe surfaced a dupe-stamped pre-merge entry as a candidate ("+stamped.length+" eligible stamped entries"+(rendered?", one made the rendered excerpt block":", outranked below the rendered cut but scoring through the bridge")+")");
    }else{
      // mechanical fallback: distinguish "outranked past the candidate cap" from "bridge dead".
      // An entry stamped e.n=[dupe] scores iff resolveNpcName(dupe) lands on a weighted name;
      // the probe names the canonical, so w[canonical] is set iff the scan finds it.
      var mech=false;
      for(d=0;d<plan[g].dupes.length&&!mech;d++){
        if(resolveNpcName(plan[g].dupes[d])===canonical&&probeText.toLowerCase().indexOf(canonical.toLowerCase())>=0)mech=true;
      }
      if(mech)log("note","C. \""+canonical+"\": dupe-stamped entries exist but were outranked out of the top-12 candidates by stronger matches; the bridge itself verifies mechanically (dupe → canonical → probe weight). PASS with note — spot-check in game if paranoid.");
      else{fatal++;log("fatal","C. \""+canonical+"\": "+stamped.length+" dupe-stamped entries exist and NONE scores through the bridge — pre-merge scenes would go INVISIBLE to RAG (the t198 regression class)");}
    }
  }
  // D. dangling-reference sweep (WARN-grade: bare pre-existing names can be legitimately
  //    unresolvable under the 2-candidate rule — listed so the human sees them, not fatal)
  var dangles=0;
  function sweep(site,name){
    if(name==null)return;
    var rc=nmcResolveClass(name);
    if(rc.cls==="unresolved"){dangles++;log("warn","D. "+site+": \""+name+"\" neither live nor resolvable (pre-existing residue, not created by this run — consider a follow-up merge)");}
  }
  if(memory.map&&memory.map.nodes){var k2;for(k2 in memory.map.nodes){var nl2=memory.map.nodes[k2].npcs||[];for(i=0;i<nl2.length;i++)sweep("map node \""+k2+"\"",nl2[i]);}}
  for(i=0;i<worldState.npcs.length;i++){var nn=worldState.npcs[i];if(nn.charSheet&&nn.charSheet.relationships){for(j=0;j<nn.charSheet.relationships.length;j++)sweep("companion \""+nn.name+"\" rel",nn.charSheet.relationships[j].entity);}}
  for(i=0;i<(worldState.character.relationships||[]).length;i++)sweep("player rel",worldState.character.relationships[i].entity);
  for(i=0;i<(worldState.coreMemories||[]).length;i++)sweep("coreMemories.who",worldState.coreMemories[i].who);
  if(memory.npcGraph){var ed2=memory.npcGraph.edges||[];for(i=0;i<ed2.length;i++){sweep("graph edge",ed2[i].a);sweep("graph edge",ed2[i].b);}}
  if(!dangles)log("ok","D. no dangling references at the swept sites");
  return fatal;
}

// ── residue + health scans (report-side) ──
function nmcResidueScan(log){
  var findings=0;
  function report(site,name,extra){
    var rc=nmcResolveClass(name);
    if(rc.cls==="live"||rc.cls==="player")return;
    findings++;
    if(rc.cls==="resolves")log("note",site+": \""+name+"\" is not a live key but resolves → \""+rc.to+"\""+(extra?"  ("+extra+")":""));
    else log("warn",site+": \""+name+"\" — NOT a live key and does NOT resolve"+(extra?"  ("+extra+")":""));
  }
  var i,j,k;
  if(memory.map&&memory.map.nodes){
    for(k in memory.map.nodes){
      var nl=memory.map.nodes[k].npcs||[];
      for(i=0;i<nl.length;i++)report("map node \""+k+"\" npcs[]",nl[i]);
    }
  }
  for(i=0;i<worldState.npcs.length;i++){
    var n=worldState.npcs[i];
    if(n.charSheet&&n.charSheet.relationships){
      for(j=0;j<n.charSheet.relationships.length;j++)
        report("companion \""+n.name+"\" relationship entity",n.charSheet.relationships[j].entity,nmcTrim((n.charSheet.relationships[j].bond||"")+(n.charSheet.relationships[j].dynamic?" | dynamic: "+n.charSheet.relationships[j].dynamic:""),60));
    }
  }
  var prels=(worldState.character.relationships||[]);
  for(i=0;i<prels.length;i++)report("player relationship entity",prels[i].entity,nmcTrim((prels[i].bond||"")+(prels[i].dynamic?" | dynamic: "+prels[i].dynamic:""),60));
  var cms=(worldState.coreMemories||[]);
  for(i=0;i<cms.length;i++){if(cms[i].who)report("coreMemories[].who (t"+cms[i].turn+")",cms[i].who,nmcTrim(cms[i].text,50));}
  var acm=(memory.archive&&memory.archive.coreMemories)||[];
  for(i=0;i<acm.length;i++){if(acm[i].who)report("archive.coreMemories[].who",acm[i].who);}
  if(memory.npcGraph){
    var ed=memory.npcGraph.edges||[];
    for(i=0;i<ed.length;i++){report("npcGraph edge .a",ed[i].a);report("npcGraph edge .b",ed[i].b);}
    for(k in (memory.npcGraph.npcFactions||{}))report("npcFactions key",k);
  }
  // transcript e.n orphan census (aggregate — the load the bridge is carrying)
  var orphan={},resolves=0,dead=0,TR=nmcTr();
  for(i=0;i<TR.length;i++){
    var en=TR[i];
    if(en.r!=="gm"||!en.e||!en.e.n)continue;
    for(j=0;j<en.e.n.length;j++){var nm=en.e.n[j];if(!nmcIsLive(nm)&&!orphan[nm])orphan[nm]=1;}
  }
  var okeys=Object.keys(orphan),deadList=[];
  for(i=0;i<okeys.length;i++){
    var rc2=nmcResolveClass(okeys[i]);
    if(rc2.cls==="resolves"||rc2.cls==="player")resolves++;
    else{dead++;deadList.push(okeys[i]);}
  }
  log("info","transcript e.n orphans (stamped names no longer live keys): "+okeys.length+
      " distinct — "+resolves+" resolve via the bridge/heuristic, "+dead+" do NOT");
  if(deadList.length)log("warn","unresolvable e.n orphans (their excerpts are invisible to RAG entity scoring): "+deadList.map(function(d){return "\""+d+"\"";}).join(", "));
  if(!findings)log("info","(no residue found at the named sites)");
}
function nmcHealthScan(built,log){
  var owner={},dupAliases=0,liveClaims=0,i,j,keys=nmcLiveKeys();
  for(i=0;i<keys.length;i++){
    var als=memory.npcs[keys[i]].aliases||[];
    for(j=0;j<als.length;j++){
      if(owner[als[j]]&&owner[als[j]]!==keys[i]){
        dupAliases++;
        log("warn","I10 VIOLATION: alias \""+als[j]+"\" claimed by BOTH \""+owner[als[j]]+"\" and \""+keys[i]+"\" — resolution is insertion-order-dependent");
      }else owner[als[j]]=keys[i];
      if(nmcIsLive(als[j])&&als[j]!==keys[i]){
        liveClaims++;
        log("warn","live key \""+als[j]+"\" is claimed as an alias of \""+keys[i]+"\" — exact-key wins (I1), so the alias is DEAD and writes fork. Merging \""+als[j]+"\" into \""+keys[i]+"\" repairs this.");
      }
    }
  }
  if(!dupAliases&&!liveClaims)log("ok","alias uniqueness (I10) holds; no live key shadowed by an alias claim");
  if(built&&built.aliasClaims.length){
    for(i=0;i<built.aliasClaims.length;i++)
      log("info","(alias-claim link fed to grouping: \""+built.aliasClaims[i].claimed+"\" claimed by \""+built.aliasClaims[i].owner+"\")");
  }
}
