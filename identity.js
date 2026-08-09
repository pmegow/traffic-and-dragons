// identity.js — #156 THE IDENTITY LAYER, Phase A: the spine + the npc domain. ⛨ DRIFT SURFACE.
//
// The engine keys every canonical store by model-authored name strings, and string equality
// fails in two directions at campaign scale: DRIFT (many names accrete around one thing) and
// COLLISION (one name is reused for a new thing, fusing two entities' canon into one record —
// the three-Savahs class, field-confirmed at t1593). Five stores grew independent partial
// guards; this file is the shared spine they consolidate into (proposal + adjudicated plan:
// DOC/identity_hardening_fable.html §7).
//
// ONE registry (IDENTITY_DOMAINS — the PROVIDERS/BIBLE_TYPES/TAG_TABLE house pattern), ONE
// resolver (resolveEntity), ONE action pair ([ALIAS:domain|a|b] / [MERGE:domain|a|b] — thin
// routes into the battle-tested legacy handlers for npc), and the PROVISIONAL RECORD: an
// upsert-time collision suspect lands in a NEW identity ("Savah °t1530") instead of the
// existing record, so the turn is never blocked AND the fusion never happens (Sol §2 — a
// collision "nudged later" has already fused; the third outcome is create-distinct). A one-shot
// GM decision then folds it back ([NPC_MERGE:]) or renames it ([MERGE:npc|Proper Name|prov]).
//
// Phase A scope: npc (full adapter) + capability/item (already-conforming type domains —
// normalization IS their resolution; merge=null by the TYPE ruling). The location domain lands
// in Phase B on the A0-ruled additive-ID representation; quest/faction wait for evidence
// (Phase C, gated). MATCHING STAYS DOMAIN-TYPED (Sol §6): this shared layer owns dispatch,
// refusal, receipts, and the confirmation protocol — never token heuristics.
//
// Load order: after clock.js, before tag_table.js (whose ALIAS/MERGE entries and NPC handler
// call into here at parse time). Everything here reads worldState/memory as globals, exactly
// like the tag handlers do.

var IDENTITY_DOMAINS={
  npc:{
    keys:function(){return (typeof memory!=="undefined"&&memory&&memory.npcs)?Object.keys(memory.npcs):[];},
    aliases:function(key){var e=memory.npcs&&memory.npcs[key];return (e&&e.aliases)||[];},
    tokens:function(key){return npcCoreTokens(key);},
    resolve:function(name){return resolveNpcName(name);},
    context:function(key){var e=memory.npcs&&memory.npcs[key];return {lastSeenAt:(e&&e.lastSeenAt)||null};},
    /* merge/registerAlias ROUTE INTO the shipping NPC_MERGE / NPC_ALIAS handlers — the years of
       battle-testing (B3 death carry, #144A overflow archiving, epithet routing) ride along and
       the two tag surfaces cannot drift apart. Operands are pipe-refused upstream, so the
       synthesized legacy tag text is unambiguous. */
    merge:function(canonical,duplicate,R){return _identityRouteLegacy("NPC_MERGE",canonical+"|"+duplicate,R);},
    registerAlias:function(canonical,alias,R){return _identityRouteLegacy("NPC_ALIAS",canonical+"|"+alias,R);},
    namingRules:["Never give a new character the name of anyone in KNOWN NPCs — the engine would file the new person into the existing record. Pick a fresh name (AVAILABLE NAMES) or leave them unnamed."]
  },
  capability:{
    keys:function(){var out=Object.keys(typeof CAPABILITY_BIBLE!=="undefined"?CAPABILITY_BIBLE:{}),ov=(typeof worldState!=="undefined"&&worldState&&worldState.capabilityBible)||{},k;for(k in ov){if(out.indexOf(k)<0)out.push(k);}return out;},
    aliases:function(){return [];},
    tokens:function(key){return String(key||"").toLowerCase().split(/\s+/);},
    resolve:function(name){return capBaseName(name);},
    context:function(){return {};},
    merge:null,          /* write-once overlay + normalization-collapse IS the semantics (§7.2) */
    registerAlias:null,
    namingRules:["Spells and abilities resolve by their exact canonical name — use the name as written in the character's list, never a re-worded variant."]
  },
  item:{
    keys:function(){var out=Object.keys(typeof ITEM_BIBLE!=="undefined"?ITEM_BIBLE:{}),ov=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)||{},k;for(k in ov){if(out.indexOf(k)<0)out.push(k);}return out;},
    aliases:function(){return [];},
    tokens:function(key){return String(key||"").toLowerCase().split(/\s+/);},
    resolve:function(name){return itemBaseName(name);},
    context:function(){return {};},
    merge:null,          /* TYPE ruling (#81): eleven iron keys correctly collapse to one type */
    registerAlias:null,
    namingRules:[]
  },
  /* ── Phase B: the location domain ─────────────────────────────────────────────────────────
     Representation (Phase B review call #1, amending the A0 letter with its criteria intact):
     node keys are IMMUTABLE NAME-BORN identifiers — a key never changes after creation — and a
     SPARSE identity overlay (memory.map.identity.entries) carries what indirection needs:
     tombstones (mergedInto), aliases, and repair marks. This keeps every A0 arm-2 property the
     ruling selected for (merge/reparent/split are O(1) pointer writes; historical references
     resolve at read; a missed seam site degrades in code, never corrupts data) while shrinking
     the migration from 1728 rewritten instances to a container init, keeping e.l/lastSeenAt
     historically true in data, and — decisive — keeping an OLD app version on another device
     (the stale-SW window) fully functional instead of writing name keys into an id-keyed store
     and pushing the corruption up. Shipped clients cannot be taught to refuse a new format;
     the only safe breaking change is the one that never happens. */
  location:{
    keys:function(){return (typeof memory!=="undefined"&&memory&&memory.map&&memory.map.nodes)?Object.keys(memory.map.nodes):[];},
    aliases:function(key){var e=_locEntries()&&_locEntries()[key];return (e&&e.aliases)||[];},
    tokens:function(key){return String(key||"").toLowerCase().split(/\s+/);},
    resolve:function(name){return locResolve(name);},
    context:function(key){var n=memory.map&&memory.map.nodes[locResolve(key)];return {parent:(n&&n.parent)||null,kind:(n&&n.kind)||null};},
    merge:function(canonical,duplicate,R){return locMerge(canonical,duplicate,R);},
    registerAlias:function(canonical,alias,R){return locAliasRegister(canonical,alias,R);},
    namingRules:[
      "Name roads, passes and trails by their endpoints in ONE fixed form — e.g. North Road (Magnimar–Sandpoint) — and reuse that exact form every time; the engine treats the pair as unordered, so never invent a reversed twin.",
      "A place inside a known settlement is [SUBLOCATION:], never a new [LOCATION:] with the parent baked into the name."
    ]
  }
};

// ── Location resolution (the sparse-overlay resolver) ───────────────────────────────────────
function _locEntries(){
  if(typeof memory==="undefined"||!memory||!memory.map)return null;
  return (memory.map.identity&&memory.map.identity.entries)||null;
}
function _locEntriesEnsure(){
  if(!memory.map.identity)memory.map.identity={entries:{}};
  if(!memory.map.identity.entries)memory.map.identity.entries={};
  return memory.map.identity.entries;
}
// Resolution memo: the table only changes on repair operations (rare), so resolution is a hash
// hit in steady state. _locResGen bumps on every identity write; the memo resets on the next
// resolve (bounded by distinct queried names per generation — monotonic-resources pass).
var _locResGen=0,_locResMemo=Object.create(null),_locResMemoGen=-1;
function locResolve(name){
  if(name==null||name==="")return name;
  var entries=_locEntries();
  if(!entries)return name;
  if(_locResMemoGen!==_locResGen){_locResMemo=Object.create(null);_locResMemoGen=_locResGen;}
  var hit=_locResMemo[name];
  if(hit!==undefined)return hit;
  var cur=String(name),seen={},guard=0;
  while(guard++<12){
    var e=entries[cur];
    if(e&&e.mergedInto){
      if(seen[cur]){if(typeof console!=="undefined")console.error("[identity] location resolution CYCLE at '"+cur+"' — identity table corrupted; returning the last stable key");break;}
      seen[cur]=1;cur=e.mergedInto;continue;
    }
    var k,hitK=null;
    for(k in entries){var al=entries[k].aliases;if(al&&al.indexOf(cur)>=0){hitK=k;break;}}
    if(hitK&&hitK!==cur){
      if(seen[cur]){if(typeof console!=="undefined")console.error("[identity] location resolution CYCLE (alias) at '"+cur+"' — identity table corrupted");break;}
      seen[cur]=1;cur=hitK;continue;
    }
    break;
  }
  _locResMemo[name]=cur;
  return cur;
}
function locSame(a,b){
  if(a==null||b==null||a===""||b==="")return a===b;
  return locResolve(a)===locResolve(b);
}
// World-ness derives from the PARENT relation, never key shape — a reparented ex-world node is
// a sublocation even though its key has no pipe, and legacy pipe-bearing pseudo-worlds
// ("Sandpoint|Varisia") read by their record, not their punctuation (Sol §5).
function locIsSub(key){
  var n=(typeof memory!=="undefined"&&memory&&memory.map&&memory.map.nodes)?memory.map.nodes[locResolve(key)]:null;
  return !!(n&&n.parent);
}
// Display leaf for multi-segment keys — fixes the flagged split("|")[1] bug (a 3-segment key
// rendered its MIDDLE segment). The identity entry's display name wins when a repair set one.
function locDisplayLeaf(key){
  var e=_locEntries()&&_locEntries()[key];
  if(e&&e.display)return e.display;
  var s=String(key==null?"":key),i=s.lastIndexOf("|");
  return i<0?s:s.slice(i+1);
}

// ── Shared field-merge rules (the A0 §7.4 set — ONE implementation for merge and split) ─────
function locFoldNodeRecords(canonNode,dupNode,canonLabel){
  if(dupNode.firstVisit!=null&&(canonNode.firstVisit==null||dupNode.firstVisit<canonNode.firstVisit))canonNode.firstVisit=dupNode.firstVisit;
  if(dupNode.lastVisit!=null&&(canonNode.lastVisit==null||dupNode.lastVisit>canonNode.lastVisit))canonNode.lastVisit=dupNode.lastVisit;
  canonNode.visits=(canonNode.visits||0)+(dupNode.visits||0);
  if(!canonNode.description&&dupNode.description)canonNode.description=dupNode.description; /* canonical wins; null takes the dup's */
  if(canonNode.size==null&&dupNode.size!=null)canonNode.size=dupNode.size;
  if(canonNode.travelMins==null&&dupNode.travelMins!=null)canonNode.travelMins=dupNode.travelMins;
  var i,j;
  var dn=dupNode.npcs||[];canonNode.npcs=canonNode.npcs||[];
  for(i=0;i<dn.length;i++){if(canonNode.npcs.indexOf(dn[i])<0)canonNode.npcs.push(dn[i]);}
  var di=dupNode.items||[];canonNode.items=canonNode.items||[];
  for(i=0;i<di.length;i++){ /* concat + case-insensitive dedupe — reads are first-ci-match, so twins would shadow */
    var seen=false;
    for(j=0;j<canonNode.items.length;j++){if(String(canonNode.items[j].name).toLowerCase()===String(di[i].name).toLowerCase()){seen=true;break;}}
    if(!seen)canonNode.items.push(di[i]);
  }
  var ds=dupNode.stateNotes||[];
  if(ds.length){ /* chronological under LOC_STATE_CAP; overflow evicts OLDEST to the archive, loudly */
    canonNode.stateNotes=(canonNode.stateNotes||[]).concat(ds);
    canonNode.stateNotes.sort(function(a,b){return (a.t||0)-(b.t||0);});
    while(canonNode.stateNotes.length>LOC_STATE_CAP){
      var ev=canonNode.stateNotes.shift();
      memArchive().locationStates.push({node:canonLabel,note:ev.n,turn:ev.t});
      if(typeof console!=="undefined")console.warn("[identity] "+canonLabel+" state notes over cap ("+LOC_STATE_CAP+") after fold — evicted oldest to the archive: \""+ev.n+"\"");
    }
  }
}

// ── Live-pointer heal + edge compaction (shared by merge and split) ─────────────────────────
// The O(1) live fields are REWRITTEN at repair time (stale values there have per-turn cost);
// the O(n) historical mass (transcript e.l, lastSeenAt, splitLoc history, archives) stays
// as written and resolves at read — that split is the A0 ruling's heart.
function _locHealLivePointers(R){
  var w=worldState.world,heals=0;
  function res(v){return v==null?v:locResolve(v);}
  if(w){
    var eff=w.sublocation?w.location+"|"+w.sublocation:w.location;
    var effR=res(eff);
    if(effR!==eff){var cut=effR.indexOf("|");w.location=cut<0?effR:effR.slice(0,cut);w.sublocation=cut<0?null:effR.slice(cut+1);heals++;}
    else if(res(w.location)!==w.location){w.location=res(w.location);heals++;}
  }
  if(worldState.combat&&worldState.combat.node&&res(worldState.combat.node)!==worldState.combat.node){worldState.combat.node=res(worldState.combat.node);heals++;}
  if(worldState.pendingLocState&&worldState.pendingLocState.node&&res(worldState.pendingLocState.node)!==worldState.pendingLocState.node){worldState.pendingLocState.node=res(worldState.pendingLocState.node);heals++;}
  if(memory.map.lastArrivalFrom&&res(memory.map.lastArrivalFrom)!==memory.map.lastArrivalFrom){memory.map.lastArrivalFrom=res(memory.map.lastArrivalFrom);heals++;}
  var ldn=worldState.locDescNudged,k;
  if(ldn){for(k in ldn){var rk=res(k);if(rk!==k){if(ldn[rk]==null||ldn[k]>ldn[rk])ldn[rk]=ldn[k];delete ldn[k];heals++;}}}
  var party=worldState.npcs||[],i;
  for(i=0;i<party.length;i++){
    var cs=party[i].charSheet,sl=cs&&cs.splitLoc;
    if(!sl||!sl.location)continue;
    var slEff=sl.sublocation?sl.location+"|"+sl.sublocation:sl.location,slR=res(slEff);
    if(slR!==slEff){var c2=slR.indexOf("|");sl.location=c2<0?slR:slR.slice(0,c2);sl.sublocation=c2<0?null:slR.slice(c2+1);heals++;}
  }
  if(heals&&R)R.muts.push(heals+" live location pointer(s) healed");
}
function _locCompactEdges(R){
  var kept=[],sig={},dropped=0,collapsed=0,i;
  for(i=0;i<memory.map.edges.length;i++){
    var e=memory.map.edges[i],a=locResolve(e.from),b=locResolve(e.to);
    if(a===b){dropped++;continue;}
    var s=a<b?a+""+b:b+""+a;
    if(sig[s]){collapsed++;if((e.turn||0)<(sig[s].turn||0))sig[s].turn=e.turn;continue;}
    e.from=a;e.to=b;sig[s]=e;kept.push(e);
  }
  memory.map.edges=kept;
  if((dropped||collapsed)&&R)R.muts.push("edges compacted: "+dropped+" self-loop(s), "+collapsed+" parallel(s)");
}

// ── The three repair executors ──────────────────────────────────────────────────────────────
// Every executor archives a complete pre-image to memory.archive.identityMerges (P12 —
// reversible by construction), emits muts receipts, and bumps the resolution generation.
function locMerge(canonical,duplicate,R){
  canonical=locResolve(canonical);duplicate=locResolve(duplicate);
  if(canonical===duplicate){if(typeof console!=="undefined")console.warn("[identity] location merge no-op — '"+duplicate+"' already resolves to '"+canonical+"'");return false;}
  if(!memory.map.nodes[duplicate]){if(typeof console!=="undefined")console.warn("[identity] location merge refused — duplicate node '"+duplicate+"' not on the map");R.muts.push("location merge refused (unknown duplicate)");return false;}
  if(!memory.map.nodes[canonical]){if(typeof console!=="undefined")console.warn("[identity] location merge refused — canonical node '"+canonical+"' not on the map (locations are never created by merge)");R.muts.push("location merge refused (unknown canonical)");return false;}
  var entries=_locEntriesEnsure();
  memArchive().identityMerges.push({domain:"location",op:"merge",canonical:canonical,duplicate:duplicate,turn:R.turn,
    records:{node:JSON.parse(JSON.stringify(memory.map.nodes[duplicate])),identity:entries[duplicate]?JSON.parse(JSON.stringify(entries[duplicate])):null,locations:memory.locations[duplicate]?JSON.parse(JSON.stringify(memory.locations[duplicate])):null}});
  locFoldNodeRecords(memory.map.nodes[canonical],memory.map.nodes[duplicate],canonical);
  delete memory.map.nodes[duplicate];
  var dupEntry=entries[duplicate]||{},i;
  entries[duplicate]={mergedInto:canonical};
  var canonEntry=entries[canonical]||(entries[canonical]={});
  canonEntry.aliases=canonEntry.aliases||[];
  if(canonEntry.aliases.indexOf(duplicate)<0)canonEntry.aliases.push(duplicate);
  var da=dupEntry.aliases||[];
  for(i=0;i<da.length;i++){if(canonEntry.aliases.indexOf(da[i])<0)canonEntry.aliases.push(da[i]);}
  if(memory.locations[duplicate]){
    if(!memory.locations[canonical])memory.locations[canonical]=memory.locations[duplicate];
    else{
      var lv=memory.locations[duplicate].visited||[],ln=memory.locations[duplicate].notes||[];
      memory.locations[canonical].visited=(memory.locations[canonical].visited||[]).concat(lv);
      memory.locations[canonical].visited.sort(function(a,b){return a-b;});
      for(i=0;i<ln.length;i++){memory.locations[canonical].notes.push(ln[i]);if(memory.locations[canonical].notes.length>5)memory.locations[canonical].notes.shift();}
    }
    delete memory.locations[duplicate];
  }
  _locResGen++;
  _locHealLivePointers(R);
  _locCompactEdges(R);
  R.muts.push("Location merged: "+duplicate+" -> "+canonical);
  if(typeof console!=="undefined")console.info("[identity] location merge: '"+duplicate+"' folded into '"+canonical+"' (pre-image archived)");
  return true;
}
function locReparent(key,newParent,R){
  key=locResolve(key);
  var n=memory.map.nodes[key];
  if(!n){if(typeof console!=="undefined")console.warn("[identity] reparent refused — '"+key+"' not on the map");return false;}
  var target=newParent?locResolve(newParent):null;
  if(target&&!memory.map.nodes[target]){if(typeof console!=="undefined")console.warn("[identity] reparent refused — target parent '"+target+"' not on the map");return false;}
  var guard=0,walk=target; /* a node may never become its own ancestor */
  while(walk&&guard++<12){if(walk===key){if(typeof console!=="undefined")console.warn("[identity] reparent refused — would make '"+key+"' its own ancestor");return false;}var wn=memory.map.nodes[walk];walk=wn&&wn.parent?locResolve(wn.parent):null;}
  memArchive().identityMerges.push({domain:"location",op:"reparent",key:key,from:n.parent||null,to:target,turn:R.turn});
  n.parent=target;
  _locResGen++;
  R.muts.push("Location reparented: "+locDisplayLeaf(key)+" -> "+(target?locDisplayLeaf(target):"(world)"));
  return true;
}
// Split — repair-tool only (allocation is inherently human, §7.1). The fused node's numeric
// record stays with the PRIMARY successor; the spec allocates stateNotes/items/npcs by index or
// name, children by key (their frozen keys stay — only the parent pointer moves), and edges by
// the far endpoint. Anything unallocated stays with the primary. The fused key tombstones to
// the primary, so every historical reference resolves coarse-but-consistent (the A0 trunk rule).
function locSplit(fusedKey,spec,R){
  fusedKey=locResolve(fusedKey);
  var node=memory.map.nodes[fusedKey];
  if(!node){if(typeof console!=="undefined")console.warn("[identity] split refused — '"+fusedKey+"' not on the map");return false;}
  var succ=(spec&&spec.successors)||[],i,j;
  if(succ.length<2||!spec.primary){if(typeof console!=="undefined")console.warn("[identity] split refused — need >=2 successors and a primary");return false;}
  var primaryOk=false;
  for(i=0;i<succ.length;i++){
    if(succ[i].key===spec.primary)primaryOk=true;
    if(memory.map.nodes[succ[i].key]){if(typeof console!=="undefined")console.warn("[identity] split refused — successor key '"+succ[i].key+"' already exists (no partial splits)");return false;}
  }
  if(!primaryOk){if(typeof console!=="undefined")console.warn("[identity] split refused — primary must be one of the successors");return false;}
  var entries=_locEntriesEnsure();
  memArchive().identityMerges.push({domain:"location",op:"split",key:fusedKey,primary:spec.primary,successors:succ.map(function(s){return s.key;}),turn:R.turn,
    records:{node:JSON.parse(JSON.stringify(node)),identity:entries[fusedKey]?JSON.parse(JSON.stringify(entries[fusedKey])):null}});
  var notes=node.stateNotes||[],items=node.items||[],npcs=node.npcs||[];
  var claimedN={},claimedI={},claimedP={};
  for(i=0;i<succ.length;i++){
    var s=succ[i],take=s.take||{};
    var fresh={firstVisit:node.firstVisit,visits:0,description:null,parent:node.parent||null,npcs:[],items:[],size:null,travelMins:null};
    if(s.kind)fresh.kind=s.kind;
    if(s.endpoints)fresh.endpoints=s.endpoints.slice();
    for(j=0;j<(take.stateNotes||[]).length;j++){var ni=take.stateNotes[j];if(notes[ni]){fresh.stateNotes=fresh.stateNotes||[];fresh.stateNotes.push(notes[ni]);claimedN[ni]=1;}}
    for(j=0;j<(take.items||[]).length;j++){var ii=take.items[j];if(items[ii]){fresh.items.push(items[ii]);claimedI[ii]=1;}}
    for(j=0;j<(take.npcs||[]).length;j++){if(npcs.indexOf(take.npcs[j])>=0){fresh.npcs.push(take.npcs[j]);claimedP[take.npcs[j]]=1;}}
    for(j=0;j<(take.children||[]).length;j++){var ck=take.children[j],cn=memory.map.nodes[ck];if(cn)cn.parent=s.key;}
    memory.map.nodes[s.key]=fresh;
  }
  var prim=memory.map.nodes[spec.primary];
  prim.visits=node.visits||0;prim.lastVisit=node.lastVisit;prim.description=node.description;prim.size=node.size;prim.travelMins=node.travelMins;
  for(i=0;i<notes.length;i++){if(!claimedN[i]){prim.stateNotes=prim.stateNotes||[];prim.stateNotes.push(notes[i]);}}
  if(prim.stateNotes)prim.stateNotes.sort(function(a,b){return (a.t||0)-(b.t||0);});
  for(i=0;i<items.length;i++){if(!claimedI[i])prim.items.push(items[i]);}
  for(i=0;i<npcs.length;i++){if(!claimedP[npcs[i]])prim.npcs.push(npcs[i]);}
  for(i=0;i<memory.map.edges.length;i++){
    var e=memory.map.edges[i];
    if(e.from!==fusedKey&&e.to!==fusedKey)continue;
    var far=e.from===fusedKey?e.to:e.from,owner=spec.primary;
    for(j=0;j<succ.length;j++){
      var tk=(succ[j].take&&succ[j].take.edges)||[],x;
      for(x=0;x<tk.length;x++){if(locSame(tk[x],far)){owner=succ[j].key;break;}}
      if(owner!==spec.primary)break;
    }
    if(e.from===fusedKey)e.from=owner;else e.to=owner;
  }
  delete memory.map.nodes[fusedKey];
  entries[fusedKey]={mergedInto:spec.primary};
  _locResGen++;
  _locHealLivePointers(R);
  _locCompactEdges(R);
  R.muts.push("Location split: "+fusedKey+" -> "+succ.map(function(s){return s.key;}).join(" + ")+" (historical references resolve to "+spec.primary+")");
  if(typeof console!=="undefined")console.info("[identity] location split: '"+fusedKey+"' -> "+succ.length+" successors (pre-image archived)");
  return true;
}
function locAliasRegister(canonical,alias,R){
  canonical=locResolve(canonical);
  if(!memory.map.nodes[canonical]){if(typeof console!=="undefined")console.warn("[identity] location alias refused — canonical '"+canonical+"' not on the map");R.muts.push("location alias refused (unknown canonical)");return false;}
  if(memory.map.nodes[alias]){if(typeof console!=="undefined")console.warn("[identity] location alias refused — '"+alias+"' is a LIVE map node (exact-key beats alias; merge instead)");R.muts.push("location alias refused (live key)");return false;}
  var entries=_locEntriesEnsure();
  var e=entries[canonical]||(entries[canonical]={});
  e.aliases=e.aliases||[];
  if(e.aliases.indexOf(alias)<0)e.aliases.push(alias);
  _locResGen++;
  R.muts.push("Location alias: "+alias+" -> "+canonical);
  return true;
}

// THE shared resolver — name → canonical identity through the domain's adapter. For npc this IS
// resolveNpcName (parity engine-tested); legacy tag call sites keep calling resolveNpcName
// directly (deliberate Phase A call: zero parse-path churn buys nothing until the location
// domain needs the shared path in Phase B — recorded in the Phase A review).
function resolveEntity(domain,name){
  var d=IDENTITY_DOMAINS[domain];
  if(!d){if(typeof console!=="undefined")console.warn("[identity] unknown domain '"+domain+"' — name passed through unresolved");return name;}
  return d.resolve(name);
}

// Route a generalized action into the shipping legacy handler out of TAG_TABLE (the
// npc-merge-core precedent: drive the SHIPPING handler, copy nothing).
function _identityRouteLegacy(tag,payload,R){
  var i;
  for(i=0;i<TAG_TABLE.length;i++){
    if(TAG_TABLE[i].t===tag){TAG_TABLE[i].apply("["+tag+":"+payload+"]",R);return true;}
  }
  if(typeof console!=="undefined")console.warn("[identity] legacy handler "+tag+" missing from TAG_TABLE — routing failed");
  return false;
}

// The [ALIAS:domain|a|b] / [MERGE:domain|a|b] parse core (called by the two tag_table entries).
// REFUSALS ARE LOUD AND MUTATION-FREE: a payload that does not split into exactly domain|a|b
// carried a pipe-bearing operand (real location keys contain pipes — Sol §5); those route
// through the Phase B cleanup tool, never through tag grammar. No escaping scheme is invented.
function _identityActionTag(kind,text,R){
  var re=new RegExp("\\["+kind+":([^\\]]+)\\]","g"),m;
  while((m=re.exec(text))){
    var parts=m[1].split("|");
    if(parts.length!==3){
      if(typeof console!=="undefined")console.warn("[identity] ["+kind+":] REFUSED — expected domain|a|b, got "+parts.length+" segment(s) in \""+m[1].slice(0,80)+"\" (pipe-bearing operands route through the cleanup tool, never tag grammar — Sol §5)");
      R.muts.push(kind+" refused (malformed operand)");
      continue;
    }
    var domain=parts[0].trim().toLowerCase(),a=parts[1].trim(),b=parts[2].trim();
    var d=IDENTITY_DOMAINS[domain];
    if(!d){
      if(typeof console!=="undefined")console.warn("[identity] ["+kind+":"+domain+"|…] REFUSED — unknown domain (Phase A registry: "+Object.keys(IDENTITY_DOMAINS).join(", ")+")");
      R.muts.push(kind+" refused (unknown domain '"+domain+"')");
      continue;
    }
    var op=kind==="MERGE"?d.merge:d.registerAlias;
    if(!op){
      if(typeof console!=="undefined")console.warn("[identity] ["+kind+":"+domain+"|…] REFUSED — the "+domain+" domain is not "+(kind==="MERGE"?"merge":"alias")+"-capable (type domains collapse by normalization; structural repairs ride the cleanup tool)");
      R.muts.push(kind+" refused ("+domain+" not capable)");
      continue;
    }
    op(a,b,R);
  }
}

// ── The provisional record (create-distinct — §7.1) ─────────────────────────────────────────
// Called by the [NPC:] handler with the RAW name and RAW relation operand. Returns the key the
// upsert should write: the resolved canonical (normal case) or a freshly minted provisional
// identity when the write is a collision suspect. THE PREDICATE IS NARROW ON PURPOSE — every
// clause below guards a real false-positive class, and a false provisional is one nudge round
// while a missed fusion is permanent canon corruption:
//   introduction-shaped rel  — the Savah t1530 signature ("unknown, not yet met" into a rich
//                              file); an ordinary re-tag ("ally") never mints
//   history-rich record      — a thin record has nothing worth protecting; normal upsert
//   living, non-party        — companions get re-tagged constantly; dead-name reuse stays with
//                              B3's refusal flow (evidence-gated follow-up, Phase A review)
//   under PROVISIONAL_CAP    — beyond it, degrade LOUDLY to today's direct write (the guard
//                              may never be worse than the status quo it replaces)
// Known honest limit (recorded): the t988 class — the model FALSELY asserting familiarity
// ("a woman named Savah who you've dealt with before") — is not engine-detectable; the NAMING
// clause and the suggestion-pool filter attack that side's base rate instead.
function npcUpsertTarget(rawName,rawRel,R){
  var resolved=resolveNpcName(rawName);
  var mem=memory.npcs&&memory.npcs[resolved];
  if(!mem)return resolved;
  if(!NPC_INTRO_REL_RE.test(rawRel||""))return resolved;
  var wsN=(typeof wsNpcByName==="function")?wsNpcByName(resolved):null;
  if(wsN&&wsN.partyMember)return resolved;
  if(mem.dead||(wsN&&wsN.dead))return resolved;
  if(((mem.knowledge||[]).length+(mem.events||[]).length)<2)return resolved;
  var key=resolved+" °t"+R.turn;
  if(memory.npcs[key])return key; /* same-response re-tag accumulates on the one provisional */
  var k,outstanding=0;
  for(k in memory.npcs){if(memory.npcs[k].provisional)outstanding++;}
  if(outstanding>=PROVISIONAL_CAP){
    if(typeof console!=="undefined")console.warn("[identity] provisional cap ("+PROVISIONAL_CAP+") reached — '"+rawName+"' written to the existing record (pre-#156 behavior). Resolve outstanding provisionals via their nudges.");
    return resolved;
  }
  memory.npcs[key]={attitude:"",knowledge:[],events:[],aliases:[],provisional:{of:resolved,turn:R.turn}};
  R.muts.push("⚠ possible name collision: '"+rawName+"' filed as PROVISIONAL '"+key+"'");
  if(typeof console!=="undefined")console.warn("[identity] '"+rawName+"' resolves to a history-rich record but this write is introduction-shaped (\""+rawRel+"\") — filed PROVISIONALLY as '"+key+"' so the established record cannot fuse; the GM decides same/distinct via the next engine note (#156)");
  if(typeof showToast==="function")showToast("⚠ Possible name collision: "+rawName+" — filed separately pending confirmation");
  return key;
}

// The one-shot decision channel: while any provisional is outstanding, ask the GM to settle it —
// SAME person (fold back via the battle-tested [NPC_MERGE:]) or DIFFERENT person (rename via
// [MERGE:npc|Proper Name|provisional], which creates the new canonical and folds the provisional
// in). Re-fires per record every PROVISIONAL_NUDGE_COOLDOWN turns until resolved (an unresolved
// provisional is live fragmentation — the #29/#134 re-fire lesson); one record per turn (note
// pressure); silent mid-combat WITHOUT consuming; latch worldState.provisionalNudged rides
// NOTE_LATCH_FIELDS so the #14 suggestion prompt build can never eat it.
function buildProvisionalNudge(){
  if(!worldState||worldState.combat)return"";
  if(typeof memory==="undefined"||!memory||!memory.npcs)return"";
  var k,best=null;
  for(k in memory.npcs){
    var p=memory.npcs[k].provisional;
    if(!p)continue;
    var last=(worldState.provisionalNudged&&worldState.provisionalNudged[k])||0;
    if(worldState.turn-last<PROVISIONAL_NUDGE_COOLDOWN)continue;
    if(!best||p.turn<memory.npcs[best].provisional.turn)best=k;
  }
  if(!best)return"";
  if(!worldState.provisionalNudged)worldState.provisionalNudged={};
  worldState.provisionalNudged[best]=worldState.turn;
  var of=memory.npcs[best].provisional.of,cm=memory.npcs[of],ev="";
  if(cm&&cm.lastSeenAt)ev=" The established "+of+" was last seen at "+cm.lastSeenAt+".";
  return "[ENGINE NOTE — NAME COLLISION, DECIDE (not a player action): a new \""+of+"\" was introduced and is filed PROVISIONALLY as \""+best+"\" so the established record stays clean."+ev+" Decide from the STORY in THIS response: if they are the SAME person, emit [NPC_MERGE:"+of+"|"+best+"]. If they are a DIFFERENT person, give them their own name and emit [MERGE:npc|<Their Proper Name>|"+best+"] — pick a name not already in KNOWN NPCs. This note re-fires until one tag lands.]";
}

// ── The NAMING clause (stable half — §2.6, amended §7.3) ────────────────────────────────────
// Campaign-constant by construction (cache-safe). States the RULE with the MECHANISM — the
// model has no idea names are primary keys. Domain lines assemble from each adapter's
// namingRules in fixed registry order; the two location-convention lines live here as literals
// until Phase B ships the location adapter (marked, so they move rather than duplicate).
function buildNamingClause(){
  /* Fixed registry order; the location conventions moved from Phase A literals into the
     location adapter's namingRules at Phase B — assembly order keeps the clause BYTE-IDENTICAL
     (stable half, cache-safe; pinned by the capture-stable pre/post diff). */
  var order=["npc","capability","item","location"],lines=[],i,j;
  lines.push("NAMING (identity discipline): The engine files everything by name: the same name IS the same entity, permanently, and a reused name writes into the existing file.");
  for(i=0;i<order.length;i++){
    var nr=IDENTITY_DOMAINS[order[i]].namingRules||[];
    for(j=0;j<nr.length;j++)lines.push(nr[j]);
  }
  return lines.join("\n")+"\n\n";
}
