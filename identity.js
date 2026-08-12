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
// #164: does this world node have any KNOWN interior places? Parent relation through the
// identity table (the locIsSub rule), no recency cutoff — interior-ness is structural, unlike
// the geo block's prompt-lean 20-turn window. Decides whether a bare==bare co-location is
// "same place" (a camp — fold) or a granularity gap (a town — 'somewhere in Sandpoint' is
// not 'with the party'; the GM decides via the split audit).
function locHasInteriors(worldKey){
  var nodes=(typeof memory!=="undefined"&&memory&&memory.map&&memory.map.nodes)?memory.map.nodes:null;
  if(!nodes)return false;
  var ks=Object.keys(nodes),i;
  for(i=0;i<ks.length;i++){var n=nodes[ks[i]];if(n&&n.parent&&locSame(n.parent,worldKey))return true;}
  return false;
}
// Display leaf for multi-segment keys — fixes the flagged split("|")[1] bug (a 3-segment key
// rendered its MIDDLE segment). The identity entry's display name wins when a repair set one.
function locDisplayLeaf(key){
  var e=_locEntries()&&_locEntries()[key];
  if(e&&e.display)return e.display;
  var s=String(key==null?"":key),i=s.lastIndexOf("|");
  return i<0?s:s.slice(i+1);
}

// W5: a bare [LOCATION:leaf] must not mint a world twin of an already-known child under the
// current world. Resolution/parent relations are authoritative; punctuation in the key is not.
// A genuine live world node with the same display name wins and remains a legal destination.
function locationWorldTwinConflict(name){
  var nodes=(typeof memory!=="undefined"&&memory&&memory.map&&memory.map.nodes)?memory.map.nodes:null;
  if(!nodes||!worldState||!worldState.world)return null;
  var raw=String(name||"").trim(),target=locResolve(raw),direct=nodes[target];
  if(direct&&!direct.parent)return null;
  var current=locResolve(worldState.world.location),leaf=locDisplayLeaf(target).toLowerCase(),ks=Object.keys(nodes),i,k,n;
  for(i=0;i<ks.length;i++){
    k=locResolve(ks[i]);n=nodes[k]||nodes[ks[i]];
    if(!n||!n.parent||!locSame(n.parent,current))continue;
    if(locSame(k,target)||locDisplayLeaf(k).toLowerCase()===leaf)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};
  }
  return null;
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

// ── Relationship identity + axis adapter (#168 W7) ───────────────────────────
// A relationship is one DIRECTED edge with two independent facts: bond is durable canon;
// dynamic is the current posture between those people. Every reader and writer routes here so
// a passing scene can never overwrite a marriage, oath, kinship, or enmity by accident.
var REL_AXIS_CHOICE_CAP=8,REL_BOND_CHANGE_CAP=8,REL_NOTE_COOLDOWN=3,REL_VALUE_MAX=240;
function relationshipOwnerKey(who){return who?resolveNpcName(String(who).trim()):"@player";}
function relationshipEntityKey(entity){var raw=String(entity||"").trim();if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(raw)&&worldState&&worldState.character)return worldState.character.name;return resolveNpcName(raw);}
function relationshipEdgeKey(who,entity){return relationshipOwnerKey(who)+"\u001f"+relationshipEntityKey(entity);}
function relationshipSheet(who){
  if(!worldState)return null;
  if(!who)return worldState.character||null;
  var owner=resolveNpcName(String(who).trim()),ns=worldState.npcs||[],i;
  for(i=0;i<ns.length;i++)if(resolveNpcName(ns[i].name)===owner)return ns[i].charSheet||null;
  return null;
}
function _relationshipWarn(msg){if(typeof console!=="undefined")console.warn("[relationship] "+msg);}
function _relationshipValue(raw,label,R){
  var val=String(raw||"").trim();
  if(val.length<=REL_VALUE_MAX)return val;
  _relationshipWarn((label||"relationship value")+" is "+val.length+" characters (max "+REL_VALUE_MAX+") — refused without changing canon");
  if(R)R.muts.push("Relationship value REFUSED ("+val.length+" > "+REL_VALUE_MAX+")");
  return null;
}
function _relationshipQueueAxis(who,entity,value,kind,R){
  if(!worldState)return false;
  var own=who?resolveNpcName(who):null,ent=relationshipEntityKey(entity),val=_relationshipValue(value,"relationship proposal",R),i;if(val===null)return false;
  var q=worldState.relAxisChoices||(worldState.relAxisChoices=[]);
  for(i=0;i<q.length;i++)if((q[i].who||null)===(own||null)&&q[i].entity===ent&&q[i].value===val&&q[i].kind===kind)return true;
  if(q.length>=REL_AXIS_CHOICE_CAP){_relationshipWarn("axis-choice queue full ("+REL_AXIS_CHOICE_CAP+") — '"+ent+"' was refused without changing canon");if(R)R.muts.push("Relationship axis proposal REFUSED (queue full): "+ent);return false;}
  q.push({who:own,entity:ent,value:val,kind:kind,turn:worldState.turn||0,lastFire:null});
  if(R)R.muts.push("Relationship axis review queued: "+(own?own+" → ":"")+ent);
  return true;
}
function _relationshipClearAxis(who,entity,value){
  if(!worldState||!worldState.relAxisChoices)return 0;
  var own=who?resolveNpcName(who):null,ent=relationshipEntityKey(entity),val=String(value||"").trim(),before=worldState.relAxisChoices.length;
  worldState.relAxisChoices=worldState.relAxisChoices.filter(function(x){return (x.who||null)!==(own||null)||relationshipEntityKey(x.entity)!==ent||String(x.value||"").trim()!==val;});
  if(!worldState.relAxisChoices.length)delete worldState.relAxisChoices;
  return before-(worldState.relAxisChoices?worldState.relAxisChoices.length:0);
}
function _relationshipClearDowngrade(who,entity){
  if(!worldState||!worldState.relDowngrades)return;
  var own=who?resolveNpcName(who):null,ent=relationshipEntityKey(entity);
  worldState.relDowngrades=worldState.relDowngrades.filter(function(x){return (x.who||null)!==(own||null)||relationshipEntityKey(x.entity)!==ent;});
  if(!worldState.relDowngrades.length)delete worldState.relDowngrades;
}
function _relationshipGuard(who,entity){
  if(!worldState||!worldState.relDowngrades)return null;
  var own=who?resolveNpcName(who):null,ent=relationshipEntityKey(entity),i;
  for(i=0;i<worldState.relDowngrades.length;i++){var x=worldState.relDowngrades[i];if((x.who||null)===(own||null)&&relationshipEntityKey(x.entity)===ent)return x;}
  return null;
}
function relationshipGuards(who){
  if(!worldState||!worldState.relDowngrades)return[];var own=who?resolveNpcName(who):null;
  return worldState.relDowngrades.filter(function(x){return (x.who||null)===(own||null);});
}
function _relationshipPortableAxis(sheet,entity,value,kind){
  var val=_relationshipValue(value,"portable relationship proposal",null);if(val===null)return false;
  var q=sheet.relationshipAxisProposals||(sheet.relationshipAxisProposals=[]),i;for(i=0;i<q.length;i++)if(q[i].entity===entity&&q[i].value===val&&q[i].kind===kind)return true;
  if(q.length<REL_AXIS_CHOICE_CAP){q.push({entity:entity,value:val,kind:kind});return true;}
  _relationshipWarn("portable axis-choice queue full — conflicting value for '"+entity+"' remains in its legacy source row");return false;
}
function relationshipMigrateSheet(sheet,who,opts){
  if(!sheet)return [];
  if(sheet.relationshipAxisProposals&&!(opts&&opts.portable)&&worldState){var _pa=sheet.relationshipAxisProposals,_pk=[];for(var _pi=0;_pi<_pa.length;_pi++){if(!_relationshipQueueAxis(who,_pa[_pi].entity,_pa[_pi].value,_pa[_pi].kind,null))_pk.push(_pa[_pi]);}if(_pk.length)sheet.relationshipAxisProposals=_pk;else delete sheet.relationshipAxisProposals;}
  var src=Array.isArray(sheet.relationships)?sheet.relationships:[],out=[],i,j;
  for(i=0;i<src.length;i++){
    var old=src[i];if(!old||typeof old!=="object")continue;
    var row=old;/* preserve object identity: prompt/UI reads may normalize repeatedly, and callers can safely retain an edge reference across turns. */
    row.entity=(opts&&opts.portable)?String(row.entity||"").trim():relationshipEntityKey(row.entity);if(!row.entity){_relationshipWarn("relationship row with no entity was refused during migration");continue;}
    var legacy=row.descriptor!=null?String(row.descriptor).trim():"";
    row.bond=row.bond!=null?String(row.bond).trim():"";
    row.dynamic=row.dynamic!=null?String(row.dynamic).trim():"";
    var keepLegacy=false;
    if(legacy&&!row.bond&&!row.dynamic){row.bond=legacy;row.bondTurn=typeof row.turn==="number"?row.turn:null;row.axisReview=true;}
    else if(legacy&&legacy!==row.bond&&legacy!==row.dynamic){var _hq=(opts&&opts.portable)?_relationshipPortableAxis(sheet,row.entity,legacy,"hybrid"):_relationshipQueueAxis(who,row.entity,legacy,"hybrid",null);if(!_hq)keepLegacy=true;row.axisConflict=true;}
    if(row.bondTurn===undefined)row.bondTurn=null;if(row.dynamicTurn===undefined)row.dynamicTurn=null;
    if(!keepLegacy){delete row.descriptor;delete row.turn;}
    var hit=null;for(j=0;j<out.length;j++)if(out[j].entity===row.entity){hit=out[j];break;}
    if(!hit){out.push(row);continue;}
    var keepDuplicate=false;
    if(row.bond){if(!hit.bond){hit.bond=row.bond;hit.bondTurn=row.bondTurn;}else if(hit.bond!==row.bond){var _bq=(opts&&opts.portable)?_relationshipPortableAxis(sheet,row.entity,row.bond,"alias-bond-conflict"):_relationshipQueueAxis(who,row.entity,row.bond,"alias-bond-conflict",null);if(!_bq)keepDuplicate=true;hit.axisConflict=true;}}
    if(row.dynamic){if(!hit.dynamic){hit.dynamic=row.dynamic;hit.dynamicTurn=row.dynamicTurn;}else if(hit.dynamic!==row.dynamic){var _dq=(opts&&opts.portable)?_relationshipPortableAxis(sheet,row.entity,row.dynamic,"alias-dynamic-conflict"):_relationshipQueueAxis(who,row.entity,row.dynamic,"alias-dynamic-conflict",null);if(!_dq)keepDuplicate=true;hit.axisConflict=true;}}
    if(row.axisReview)hit.axisReview=true;
    if(keepDuplicate){row.axisUnmigrated=true;out.push(row);_relationshipWarn("relationship alias collision for '"+row.entity+"' remains in an inactive source row until proposal capacity is available");}else delete row.axisUnmigrated;
  }
  sheet.relationships=out;return out;
}
function relationshipMigrateWorld(){
  if(!worldState)return;
  relationshipMigrateSheet(worldState.character,null);
  var ns=worldState.npcs||[],i;for(i=0;i<ns.length;i++)if(ns[i].charSheet)relationshipMigrateSheet(ns[i].charSheet,ns[i].name);
  if(worldState.pendingLegacy)relationshipMigrateSheet(worldState.pendingLegacy,"@legacy:"+(worldState.pendingLegacy.name||"character"),{portable:true});
}
function relationshipAdoptPortableProposals(sheet,who){
  if(!sheet||!worldState)return true;relationshipMigrateSheet(sheet,"@legacy:"+(sheet.name||"character"),{portable:true});
  var kept=[],q=sheet.relationshipAxisProposals||[],i;for(i=0;i<q.length;i++)if(!_relationshipQueueAxis(who,q[i].entity,q[i].value,q[i].kind,null))kept.push(q[i]);
  if(kept.length)sheet.relationshipAxisProposals=kept;else delete sheet.relationshipAxisProposals;
  var rows=sheet.relationships||[],all=kept.length===0;for(i=0;i<rows.length;i++)if(rows[i]&&rows[i].axisReview&&rows[i].bond){if(!_relationshipQueueAxis(who,rows[i].entity,rows[i].bond,"migration",null))all=false;}
  return all;
}
function relationshipFind(sheet,entity,who){
  if(!sheet)return null;var rows=relationshipMigrateSheet(sheet,who),ent=relationshipEntityKey(entity),i;
  for(i=0;i<rows.length;i++)if(rows[i].entity===ent)return rows[i];return null;
}
function relationshipRows(sheet,who,opts){return relationshipMigrateSheet(sheet,who,opts).filter(function(x){return !x.axisUnmigrated&&!!(x.bond||x.dynamic);});}
function relationshipBond(row){return row&&row.bond?row.bond:"";}
function relationshipDynamic(row){return row&&row.dynamic?row.dynamic:"";}
function _relationshipPending(who,entity,next,pair){
  var q=worldState.relBondChanges||[],key=relationshipEdgeKey(who,entity),i;for(i=0;i<q.length;i++)if(q[i].key===key&&(next===undefined||(q[i].next===next&&!!q[i].pair===!!pair)))return q[i];return null;
}
function _relationshipRemovePending(key){
  if(!worldState.relBondChanges)return;worldState.relBondChanges=worldState.relBondChanges.filter(function(x){return x.key!==key;});if(!worldState.relBondChanges.length)delete worldState.relBondChanges;
}
function _relationshipReceipt(who,entity,prev,next,turn,prevDynamic,nextDynamic){
  if(!worldState.relBondReceipts)worldState.relBondReceipts={};var key=relationshipEdgeKey(who,entity);
  worldState.relBondReceipts[key]={who:who?resolveNpcName(who):null,entity:relationshipEntityKey(entity),prev:prev,next:next,turn:turn};
  if(prevDynamic!==undefined){worldState.relBondReceipts[key].prevDynamic=prevDynamic;worldState.relBondReceipts[key].nextDynamic=nextDynamic;}
}
function _relationshipCommitBond(who,row,next,R,pair){
  var prev=row.bond||"",prevDynamic=row.dynamic||"";row.bond=next;row.bondTurn=worldState.turn;row.axisReview=false;delete row.axisConflict;
  if(pair){row.dynamic="";row.dynamicTurn=worldState.turn;}
  if(worldState.relAxisReviewFired)delete worldState.relAxisReviewFired[relationshipEdgeKey(who,row.entity)];
  _relationshipReceipt(who,row.entity,prev,next,worldState.turn,pair?prevDynamic:undefined,pair?"":undefined);_relationshipRemovePending(relationshipEdgeKey(who,row.entity));_relationshipClearAxis(who,row.entity,next);_relationshipClearDowngrade(who,row.entity);
  R.muts.push((who?who+": ":"")+(pair?"relationship pair ":"bond ")+row.entity+(next?" ("+next+")":" removed"));
  if(typeof bondToast==="function")bondToast(who,row.entity,next||null,next?"updated":"ended");
}
function relationshipWrite(who,entity,axis,value,R){
  var sheet=relationshipSheet(who),ent=relationshipEntityKey(entity),next=axis==="pair"?"":_relationshipValue(value,"relationship "+axis,R);if(next===null)return false;
  if(!sheet){_relationshipWarn("no character sheet for '"+(who||"player")+"' — relationship tag refused");return false;}
  relationshipMigrateSheet(sheet,who);var row=relationshipFind(sheet,ent,who),rows=sheet.relationships;
  if(!row){
    if(!next){var absentResolved=_relationshipClearAxis(who,ent,"");if(absentResolved){R.muts.push("Legacy relationship removal resolved: "+(who?who+" → ":"")+ent+" is already absent");return true;}_relationshipWarn("no relationship edge "+(who?who+" → ":"")+ent+" exists — removal refused");if(R)R.muts.push("Relationship removal REFUSED (pair absent): "+(who?who+" → ":"")+ent);return false;}
    row={entity:ent,bond:"",bondTurn:null,dynamic:"",dynamicTurn:null};rows.push(row);
  }
  var guard=_relationshipGuard(who,ent);
  if(axis==="dynamic"){
    var oldDynamic=row.dynamic||"";
    if(!next&&!oldDynamic&&!guard){var emptyDynamicResolved=_relationshipClearAxis(who,ent,"");if(emptyDynamicResolved){R.muts.push("Legacy relationship removal resolved on empty dynamic: "+(who?who+" → ":"")+ent);return true;}_relationshipWarn("no dynamic on "+(who?who+" → ":"")+ent+" exists — removal refused");if(R)R.muts.push("Dynamic removal REFUSED (axis already empty): "+(who?who+" → ":"")+ent);return false;}
    if(guard){var corruptBond=row.bond||"";row.bond=String(guard.prev||"");row.bondTurn=guard.prevTurn||guard.turn||null;row.axisReview=false;_relationshipReceipt(who,ent,corruptBond,row.bond,worldState.turn);R.muts.push("Protected bond restored before dynamic write: "+(who?who+" → ":"")+ent+" ("+row.bond+")");}
    else if(row.axisReview&&row.bond===next){row.bond="";row.bondTurn=null;row.axisReview=false;if(worldState.relAxisReviewFired)delete worldState.relAxisReviewFired[relationshipEdgeKey(who,ent)];}
    row.dynamic=next;row.dynamicTurn=worldState.turn;delete row.axisConflict;
    _relationshipClearAxis(who,ent,next);if(guard)_relationshipClearDowngrade(who,ent);
    if(oldDynamic!==next)R.muts.push((who?who+": ":"")+"dynamic "+ent+(next?" ("+next+")":" removed"));
    return oldDynamic!==next||!!guard;
  }
  if(axis!=="bond"&&axis!=="pair"){_relationshipWarn("unknown relationship axis '"+axis+"'");return false;}
  var prev=row.bond||"";
  if(guard){var guardedCurrent=prev,protectedPrev=String(guard.prev||"");row.bond=protectedPrev;row.bondTurn=guard.prevTurn||guard.turn||null;prev=protectedPrev;_relationshipReceipt(who,ent,guardedCurrent,protectedPrev,worldState.turn);R.muts.push("Protected bond preimage restored: "+(who?who+" → ":"")+ent+" ("+protectedPrev+")");if(next===protectedPrev&&axis==="bond"){row.axisReview=false;delete row.axisConflict;_relationshipClearAxis(who,ent,next);_relationshipClearDowngrade(who,ent);return true;}}
  if(axis==="pair"&&!prev){var pd=row.dynamic||"";if(!pd){var emptyPairResolved=_relationshipClearAxis(who,ent,"");if(emptyPairResolved){R.muts.push("Legacy relationship removal resolved: "+(who?who+" → ":"")+ent+" is already empty");return true;}_relationshipWarn("relationship pair "+ent+" is already empty — removal refused");return false;}row.dynamic="";row.dynamicTurn=worldState.turn;_relationshipReceipt(who,ent,"","",worldState.turn,pd,"");_relationshipClearAxis(who,ent,"");R.muts.push((who?who+": ":"")+"relationship pair "+ent+" removed");return true;}
  if(!next&&!prev){var emptyBondResolved=_relationshipClearAxis(who,ent,"");if(emptyBondResolved){R.muts.push("Legacy relationship removal resolved on empty bond: "+(who?who+" → ":"")+ent);return true;}_relationshipWarn("no bond on "+(who?who+" → ":"")+ent+" exists — removal refused");if(R)R.muts.push("Bond removal REFUSED (axis already empty): "+(who?who+" → ":"")+ent);return false;}
  if(prev===next&&axis==="bond"){delete row.axisConflict;if(row.axisReview){row.axisReview=false;if(worldState.relAxisReviewFired)delete worldState.relAxisReviewFired[relationshipEdgeKey(who,ent)];R.muts.push((who?who+": ":"")+"bond axis confirmed: "+ent+" ("+next+")");}_relationshipClearAxis(who,ent,next);if(guard)_relationshipClearDowngrade(who,ent);return true;}
  if(!prev&&axis==="bond"){row.bond=next;row.bondTurn=worldState.turn;row.axisReview=false;_relationshipClearAxis(who,ent,next);_relationshipClearDowngrade(who,ent);R.muts.push((who?who+": ":"")+"bond "+ent+" ("+next+")");if(typeof bondToast==="function")bondToast(who,ent,next,"new");return true;}
  var key=relationshipEdgeKey(who,ent),pending=_relationshipPending(who,ent,next,axis==="pair");
  if(pending){
    if(pending.turn>=worldState.turn)return false;
    _relationshipCommitBond(who,row,next,R,axis==="pair");return true;
  }
  if(_relationshipPending(who,ent)!==null){_relationshipWarn("bond change for "+ent+" refused — a different proposal is already awaiting confirmation");return false;}
  var q=worldState.relBondChanges||(worldState.relBondChanges=[]);
  if(q.length>=REL_BOND_CHANGE_CAP){_relationshipWarn("bond-change queue full ("+REL_BOND_CHANGE_CAP+") — "+ent+" stayed '"+prev+"'");if(R)R.muts.push("Bond change REFUSED (queue full): "+ent);return false;}
  q.push({key:key,who:who?resolveNpcName(who):null,entity:ent,prev:prev,next:next,pair:axis==="pair",turn:worldState.turn,lastFire:null});if(guard)_relationshipClearDowngrade(who,ent);
  R.muts.push((axis==="pair"?"Pair removal":"Bond change")+" staged: "+(who?who+" → ":"")+ent+" (\""+prev+"\" → "+(next?'"'+next+'"':"removed")+"; canon unchanged)");return true;
}
function relationshipLegacyProposal(who,entity,value,kind,R){
  var sheet=relationshipSheet(who);if(!sheet){_relationshipWarn("legacy relationship tag for unknown owner '"+(who||"player")+"' refused");return false;}
  relationshipMigrateSheet(sheet,who);return _relationshipQueueAxis(who,entity,value,kind,R);
}
function relationshipAxisReviews(){
  var out=[],scan=function(sheet,who){var rows=relationshipMigrateSheet(sheet,who),i;for(i=0;i<rows.length;i++)if(rows[i].axisReview&&rows[i].bond&&!_relationshipGuard(who,rows[i].entity)){var key=relationshipEdgeKey(who,rows[i].entity);out.push({who:who||null,entity:rows[i].entity,value:rows[i].bond,kind:"migration",turn:rows[i].bondTurn||0,lastFire:worldState.relAxisReviewFired&&worldState.relAxisReviewFired[key],key:key,row:rows[i]});}};
  if(!worldState)return out;scan(worldState.character,null);var ns=worldState.npcs||[],i;for(i=0;i<ns.length;i++)if(ns[i].charSheet)scan(ns[i].charSheet,ns[i].name);return out;
}
function relationshipSwapOwners(newPlayer,oldPlayer){
  if(!worldState)return;
  function swap(who){if(!who)return oldPlayer;if(resolveNpcName(who)===resolveNpcName(newPlayer))return null;return who;}
  var qs=[worldState.relAxisChoices||[],worldState.relBondChanges||[],worldState.relDowngrades||[]],i,j;
  for(i=0;i<qs.length;i++)for(j=0;j<qs[i].length;j++){qs[i][j].who=swap(qs[i][j].who);if(qs[i][j].key)qs[i][j].key=relationshipEdgeKey(qs[i][j].who,qs[i][j].entity);}
  if(worldState.relBondReceipts){var old=worldState.relBondReceipts,fresh={},ks=Object.keys(old);for(i=0;i<ks.length;i++){var rec=old[ks[i]];rec.who=swap(rec.who);fresh[relationshipEdgeKey(rec.who,rec.entity)]=rec;}worldState.relBondReceipts=fresh;}
  if(worldState.relAxisReviewFired){var rf=worldState.relAxisReviewFired,rn={},rks=Object.keys(rf);for(i=0;i<rks.length;i++){var parts=rks[i].split("\u001f"),rw=parts[0]==="@player"?null:parts[0],re=parts.slice(1).join("\u001f");rn[relationshipEdgeKey(swap(rw),re)]=rf[rks[i]];}worldState.relAxisReviewFired=rn;}
  delete worldState.reciprocityNudged;/* player-relative latch keys are invalid after a heavy anchor swap; bonds re-evaluate from their new direction. */
  worldState.relAuditDue=worldState.turn;
}
function relationshipMergeSheets(canonicalSheet,duplicateSheet,canonical,duplicate){
  if(!canonicalSheet||!duplicateSheet||canonicalSheet===duplicateSheet)return canonicalSheet||duplicateSheet||null;
  relationshipMigrateSheet(canonicalSheet,canonical);relationshipMigrateSheet(duplicateSheet,duplicate);
  canonicalSheet.relationships=(canonicalSheet.relationships||[]).concat(duplicateSheet.relationships||[]);
  if(duplicateSheet.relationshipAxisProposals)canonicalSheet.relationshipAxisProposals=(canonicalSheet.relationshipAxisProposals||[]).concat(duplicateSheet.relationshipAxisProposals);
  relationshipMigrateSheet(canonicalSheet,canonical);return canonicalSheet;
}
function relationshipRekeyEntity(canonical,duplicate){
  if(!worldState)return;var can=(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(canonical))?worldState.character.name:resolveNpcName(String(canonical)),dup=String(duplicate),lists=[worldState.relAxisChoices||[],worldState.relBondChanges||[],worldState.relDowngrades||[]],i,j;
  function merged(v){var raw=String(v||"");return raw===dup||(can===worldState.character.name&&typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(raw))||resolveNpcName(raw)===can;}
  function scan(sheet,who){if(!sheet)return;var rows=sheet.relationships||[],k;for(k=0;k<rows.length;k++)if(rows[k]&&merged(rows[k].entity))rows[k].entity=can;relationshipMigrateSheet(sheet,who);}
  scan(worldState.character,null);for(i=0;i<(worldState.npcs||[]).length;i++)if(worldState.npcs[i].charSheet)scan(worldState.npcs[i].charSheet,worldState.npcs[i].name);
  for(i=0;i<lists.length;i++)for(j=0;j<lists[i].length;j++){var item=lists[i][j];if(merged(item.entity))item.entity=can;if(item.who&&merged(item.who))item.who=can;if(item.key)item.key=relationshipEdgeKey(item.who,item.entity);}
  if(worldState.relAxisChoices){var aq=[],seen={};for(i=0;i<worldState.relAxisChoices.length;i++){var ac=worldState.relAxisChoices[i],ak=(ac.who||"@player")+"\u001f"+ac.entity+"\u001f"+ac.kind+"\u001f"+ac.value;if(!seen[ak]){seen[ak]=1;aq.push(ac);}}worldState.relAxisChoices=aq;}
  if(worldState.relBondReceipts){var old=worldState.relBondReceipts,fresh={},ks=Object.keys(old);for(i=0;i<ks.length;i++){var rec=old[ks[i]];if(merged(rec.entity))rec.entity=can;if(rec.who&&merged(rec.who))rec.who=can;var key=relationshipEdgeKey(rec.who,rec.entity);if(fresh[key])_relationshipWarn("two reversible bond receipts converged during identity merge; canonical edge kept the newer receipt");if(!fresh[key]||(fresh[key].turn||0)<=(rec.turn||0))fresh[key]=rec;}worldState.relBondReceipts=fresh;}
  if(worldState.relAxisReviewFired){var rf=worldState.relAxisReviewFired,rn={},rks=Object.keys(rf);for(i=0;i<rks.length;i++){var parts=rks[i].split("\u001f"),rw=parts[0]==="@player"?null:parts[0],re=parts.slice(1).join("\u001f");if(merged(re))re=can;if(rw&&merged(rw))rw=can;rn[relationshipEdgeKey(rw,re)]=rf[rks[i]];}worldState.relAxisReviewFired=rn;}
  delete worldState.reciprocityNudged;worldState.relAuditDue=worldState.turn;
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
// #168 W2: scene-scoped referential integrity. Names remain durable keys, while short scene
// handles let observed anonymous people exist without being substituted for a known NPC.
function _w2Copy(v){return JSON.parse(JSON.stringify(v));}
function _sceneRefNode(){if(typeof currentNodeKey==="function")return locResolve(currentNodeKey());return worldState&&worldState.world?String(worldState.world.location||""):"";}
function _sceneRefFresh(node,serial){return {scene:serial,node:node,startTurn:worldState.turn,actors:[],negatives:[],acknowledged:false};}
function sceneRefsEnsure(){
  if(!worldState)return null;
  var node=_sceneRefNode(),s=worldState.sceneRefs;
  if(!s){s=worldState.sceneRefs={serial:1,active:_sceneRefFresh(node,1),sealed:[],overflow:null};return s;}
  if(!s.sealed)s.sealed=[];
  if(!s.active)s.active=_sceneRefFresh(node,s.serial||1);
  if(s.active.node!==node){
    var old=s.active,has=(old.actors&&old.actors.length)||(old.negatives&&old.negatives.length);old.endTurn=worldState.turn;
    if(has){if(s.sealed.length<SCENE_REF_SEALED_CAP)s.sealed.push(old);else{s.overflow=s.overflow||{kind:"sealed",turn:worldState.turn,node:old.node,scene:old.scene,frame:old};if(typeof console!=="undefined")console.warn("[identity] scene-frame cap reached - accepted frames preserved; referential writes fail closed until a structured summary succeeds");}}
    s.serial=(s.serial||1)+1;s.active=_sceneRefFresh(node,s.serial);
  }
  return s;
}
function sceneRefsEvidence(){var s=sceneRefsEnsure();return {actors:s.active.actors,negatives:s.active.negatives,sealed:s.sealed,overflow:s.overflow,active:s.active,serial:s.serial};}
function sceneRefsSummarySuccess(){var s=sceneRefsEnsure();if(!s)return;if(s.sealed.length)s.sealed=[];s.active.acknowledged=true;if(s.overflow&&s.overflow.scene!==s.active.scene)s.overflow=null;}
function sceneRefsSummaryFailure(){/* Typed evidence survives every retry and degraded fallback. */}
function _sceneRefFrames(){var s=worldState&&worldState.sceneRefs;if(!s)return[];var fs=[s.active].concat((s.sealed||[]).slice().reverse());if(s.overflow&&s.overflow.frame&&fs.indexOf(s.overflow.frame)<0)fs.push(s.overflow.frame);return fs;}
function _sceneRefActor(handle,sourceTurn){
  var fs=_sceneRefFrames(),i,j,h=String(handle||"").toLowerCase();
  for(i=0;i<fs.length;i++){var a=(fs[i]&&fs[i].actors)||[];for(j=0;j<a.length;j++)if(String(a[j].handle).toLowerCase()===h&&(sourceTurn==null||a[j].sourceTurn===sourceTurn))return {actor:a[j],frame:fs[i]};}
  return null;
}
function _sceneRefExplicitNegative(frame,handle,entity){
  var ns=(frame&&frame.negatives)||[],h=String(handle||"").toLowerCase(),e=String(entity||"").toLowerCase(),i;
  for(i=0;i<ns.length;i++)if(!ns[i].resolved&&ns[i].mode==="explicit"&&String(ns[i].handle).toLowerCase()===h&&String(ns[i].entity).toLowerCase()===e)return ns[i];
  return null;
}
function _sceneRefOverflow(kind){var s=sceneRefsEnsure();if(!s.overflow)s.overflow={kind:kind,turn:worldState.turn,node:s.active.node,scene:s.active.scene};if(typeof console!=="undefined")console.warn("[identity] scene evidence overflow ("+kind+") - accepted evidence preserved; irreversible identity writes fail closed");}
function sceneRefBind(handle,entity,R){
  var s=sceneRefsEnsure(),h=String(handle||"").trim(),raw=String(entity||"").trim();if(!h||s.overflow)return false;
  var a=_sceneRefActor(h),canon=(raw==="?"||raw==="-"||!raw)?null:resolveNpcName(raw);
  if(a&&a.frame===s.active){if(a.actor.entity&&canon&&a.actor.entity!==canon){_w2Conflict(canon,h,"scene handle already binds to "+a.actor.entity);return false;}if(!a.actor.entity&&canon)a.actor.entity=canon;return true;}
  if(s.active.actors.length>=SCENE_REF_ACTOR_CAP){_sceneRefOverflow("actors");return false;}
  s.active.actors.push({handle:h,entity:canon,sourceTurn:worldState.turn,authority:"state_tag",epistemic:"explicit",revealed:false,present:true});if(R)R.muts.push("Scene ref: "+h+" -> "+(canon||"anonymous"));return true;
}
function sceneRefExclude(handle,entity,mode,R){
  var s=sceneRefsEnsure(),h=String(handle||"").trim(),canon=resolveNpcName(String(entity||"").trim()),m=String(mode||"").toLowerCase()==="inference"?"inference":"explicit",i;if(!h||!canon||s.overflow)return false;
  var found=_sceneRefActor(h);if(!found||found.frame!==s.active)sceneRefBind(h,"?",R);
  for(i=0;i<s.active.negatives.length;i++)if(s.active.negatives[i].handle===h&&s.active.negatives[i].entity===canon&&s.active.negatives[i].mode===m)return true;
  if(s.active.negatives.length>=SCENE_REF_NEGATIVE_CAP){_sceneRefOverflow("negatives");return false;}
  s.active.negatives.push({handle:h,entity:canon,mode:m,sourceTurn:worldState.turn,resolved:false});if(R)R.muts.push("Scene ref: "+h+" "+(m==="explicit"?"is not ":"may not be ")+canon);return true;
}
function sceneRefReveal(handle,entity,R){
  var s=sceneRefsEnsure(),hit=_sceneRefActor(handle),canon=resolveNpcName(String(entity||"").trim()),i;
  if(!hit||hit.frame!==s.active||!canon){_w2Conflict(canon||"unknown",handle,"reveal names no active observed handle");return false;}
  if(hit.actor.entity&&hit.actor.entity!==canon){_w2Conflict(canon,handle,"reveal conflicts with established binding to "+hit.actor.entity);return false;}
  hit.actor.entity=canon;hit.actor.revealed=true;hit.actor.revealTurn=worldState.turn;
  for(i=0;i<s.active.negatives.length;i++)if(s.active.negatives[i].handle===hit.actor.handle&&s.active.negatives[i].entity===canon)s.active.negatives[i].resolved=true;
  _w2ResolveConflicts(canon,hit.actor.handle);if(R)R.muts.push("Scene reveal: "+hit.actor.handle+" -> "+canon);return true;
}
function _w2StampDead(name,turn,R){
  var canon=resolveNpcName(name),n=(typeof wsNpcByName==="function")?wsNpcByName(canon):null,m=memory.npcs&&memory.npcs[canon];if(!n&&!m)return false;
  if(n){n.dead=turn;if(!npcDeadStatus(n.status))n.status="dead";n.statusTurn=turn;}if(m)m.dead=turn;_w2ResolveConflicts(canon,null);if(R)R.muts.push(canon+": dead (t"+turn+")");return true;
}
function sceneRefDeath(handle,R){var hit=_sceneRefActor(handle);if(!hit){_w2Conflict("unknown",handle,"death names no observed handle");return false;}hit.actor.present=false;hit.actor.died=worldState.turn;if(hit.actor.entity)return _w2StampDead(hit.actor.entity,worldState.turn,R);if(R)R.muts.push("Anonymous scene actor "+hit.actor.handle+" died");return true;}
function w2DeathAuthorized(name,handle,sourceTurn){
  if(!worldState||!worldState.sceneRefs)return true;
  var s=sceneRefsEnsure(),canon=(name&&name!=="-")?resolveNpcName(name):null,hit,i,fs;if(s.overflow)return false;
  if(handle&&handle!=="-"){hit=_sceneRefActor(handle,sourceTurn);if(!hit)return false;if(sourceTurn==null&&(hit.actor.sourceTurn>=worldState.turn||(hit.actor.revealed&&hit.actor.revealTurn>=worldState.turn)))return false;if(!canon)return true;if(hit.actor.entity!==canon)return false;if(_sceneRefExplicitNegative(hit.frame,hit.actor.handle,canon)&&!hit.actor.revealed)return false;return true;}
  if(!canon)return false;fs=_sceneRefFrames();for(i=0;i<fs.length;i++){var j,as=fs[i].actors||[];for(j=0;j<as.length;j++)if(as[j].sourceTurn<worldState.turn&&(!as[j].revealed||as[j].revealTurn<worldState.turn)&&as[j].entity===canon&&!_sceneRefExplicitNegative(fs[i],as[j].handle,canon))return true;}return false;
}
function _w2Conflict(subject,handle,reason){
  if(!worldState)return null;if(!worldState.identityConflicts)worldState.identityConflicts=[];var s=String(subject||"unknown"),h=String(handle||"-"),i,c;
  for(i=0;i<worldState.identityConflicts.length;i++){c=worldState.identityConflicts[i];if(!c.resolved&&c.subject===s&&c.handle===h){c.lastTurn=worldState.turn;c.reason=reason||c.reason;return c;}}
  if(worldState.identityConflicts.length>=IDENTITY_CONFLICT_CAP){worldState.identityConflictOverflow={turn:worldState.turn,subject:s};if(typeof console!=="undefined")console.warn("[identity] conflict cap reached - existing conflicts preserved; new conflict remains fail-closed");return null;}
  c={subject:s,handle:h,reason:reason||"identity evidence missing",turn:worldState.turn,lastTurn:worldState.turn,attempts:0,resolved:false};worldState.identityConflicts.push(c);if(typeof console!=="undefined")console.warn("[identity] irreversible write QUARANTINED for "+s+" (handle "+h+"): "+c.reason);if(typeof showToast==="function")showToast("Identity conflict: "+s+" was not changed");return c;
}
function _w2ResolveConflicts(subject,handle){var q=worldState&&worldState.identityConflicts,i;if(!q)return;for(i=0;i<q.length;i++)if(q[i].subject===subject&&(!handle||q[i].handle===handle))q[i].resolved=true;worldState.identityConflicts=q.filter(function(c){return !c.resolved;});if(!worldState.identityConflicts.length)delete worldState.identityConflicts;}
function w2TextTouchesConflict(text){var q=worldState&&worldState.identityConflicts||[],low=String(text||"").toLowerCase(),i;for(i=0;i<q.length;i++)if(!q[i].resolved&&q[i].subject!=="unknown"&&low.indexOf(String(q[i].subject).toLowerCase())>=0)return q[i];return null;}
function w2MergeAllowed(canonical,duplicate){if(!worldState||!worldState.sceneRefs)return true;var c=resolveNpcName(canonical),m=memory.npcs&&memory.npcs[duplicate];if(m&&m.provisional&&resolveNpcName(m.provisional.of)===c)return true;var a=worldState.mergeConfirmArmed;return !!(a&&a.turn===worldState.turn&&a.canonical===canonical&&a.duplicate===duplicate);}
function w2MergePropose(canonical,duplicate){if(typeof _queueMergeHint==="function")_queueMergeHint(canonical,duplicate);if(typeof console!=="undefined")console.warn("[identity] merge proposed, not applied: "+duplicate+" -> "+canonical+" (awaiting exact-pair confirmation)");}
function w2MergeCommitted(canonical,duplicate){var a=worldState&&worldState.mergeConfirmArmed;if(a&&a.canonical===canonical&&a.duplicate===duplicate)delete worldState.mergeConfirmArmed;}
function _w2TxnFind(id){var a=worldState&&worldState.canonTxns||[],i;for(i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;}
function _w2TxnMetaSame(r,m){return r.claim===m.claim&&r.subject===m.subject&&r.evidence===m.evidence&&r.quest===m.quest;}
function _w2Compact(v){return String(v==null?"":v).replace(/\s+/g," ").trim().toLowerCase();}
function _w2OpFingerprint(tag){
  var name=_w2TagName(tag),m,p;
  if(name==="XP"){m=tag.match(/^\[XP:\s*\+?(\d+)/);if(m)return"XP:"+parseInt(m[1],10);}
  if(name==="GOLD"){m=tag.match(/^\[GOLD:\s*([+-]?\d+)/);if(m)return"GOLD:"+parseInt(m[1],10);}
  if(name==="SCENE_DEATH"){m=tag.match(/^\[SCENE_DEATH:([^\]]+)/);if(m)return"SCENE_DEATH:"+_w2Compact(m[1]);}
  if(name==="NPC"){m=tag.match(/^\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?/);if(m)return"NPC:"+_w2Compact(resolveNpcName(m[1].trim()))+"|"+_w2Compact(m[2])+"|"+_w2Compact(m[3]);}
  if(name==="QUEST_STEP"){m=tag.match(/^\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)/);if(m)return"QUEST_STEP:"+_w2Compact(m[1])+"|"+_w2Compact(m[2])+"|"+(/^(true|done|1|yes|x)$/i.test(String(m[3]||"").trim())?"true":"false");}
  if(name==="QUEST"){m=tag.match(/^\[QUEST:([^|\]]+)\|([^|\]]*)(?:\|([^\]]*))?/);if(m)return"QUEST:"+_w2Compact(m[1])+"|"+_w2Compact(m[2])+"|"+_w2Compact(m[3]);}
  if(name==="ITEM_GAINED"){m=tag.match(/^\[ITEM_GAINED:([^\]]+)/);if(m){p=typeof _qtyParse==="function"?_qtyParse(m[1]):{base:m[1],n:1};return"ITEM_GAINED:"+_w2Compact(p.base)+"|"+(p.n||1);}}
  return String(tag||"").replace(/\s+/g," ").trim();
}
function _w2OpTokens(ops){var counts={},out=[],i,fp;for(i=0;i<(ops||[]).length;i++){fp=_w2OpFingerprint(ops[i]);counts[fp]=(counts[fp]||0)+1;out.push(fp+"#"+counts[fp]);}return out;}
function _w2TxnReceipt(m,status,reason,ops,tokens){
  if(!worldState.canonTxns)worldState.canonTxns=[];var r=_w2TxnFind(m.id),wasQuarantined=!!(r&&r.status==="quarantined"),i;if(!r){if(worldState.canonTxns.length>=CANON_TXN_CAP){worldState.canonTxnOverflow={turn:worldState.turn,id:m.id};if(typeof console!=="undefined")console.warn("[identity] canon transaction receipt cap reached - new claim refused fail-closed");return null;}r={id:m.id,claim:m.claim,subject:m.subject,evidence:m.evidence,quest:m.quest,status:status,operations:[],turn:worldState.turn,reason:reason||""};worldState.canonTxns.push(r);}
  if(status==="quarantined"){r.status="quarantined";if(!wasQuarantined){r.reason=reason||r.reason;r.quarantinedTurn=worldState.turn;}else{r.lastAttemptReason=reason||"";r.lastAttemptTurn=worldState.turn;r.attempts=(r.attempts||1)+1;}}else if(r.status!=="quarantined"){r.status="committed";r.reason="";r.committedTurn=worldState.turn;}
  var ts=tokens||_w2OpTokens(ops);for(i=0;i<ts.length;i++)if(r.operations.indexOf(ts[i])<0)r.operations.push(ts[i]);return r;
}
function w2TxnCommit(meta,ops,tokens){return _w2TxnReceipt(meta,"committed","",ops,tokens);}
function w2TxnQuarantine(meta,reason,ops,tokens){if(meta.subject&&meta.subject!=="-")_w2Conflict(meta.subject,meta.evidence,reason);else if(typeof console!=="undefined")console.warn("[identity] canon transaction "+(meta.id||"?")+" QUARANTINED: "+reason);return _w2TxnReceipt(meta,"quarantined",reason,ops,tokens);}
function _w2Tags(text){return String(text||"").match(/\[[A-Z][A-Z_]{1,}:[^\]]+\]/g)||[];}
function _w2TagName(tag){var m=tag.match(/^\[([A-Z][A-Z_]{1,}):/);return m?m[1]:"";}
function _w2DeathStatusTag(tag){var m=tag.match(/^\[NPC:([^|\]]+)\|([^|\]]*)/);return m&&npcDeadStatus(m[2])?m:null;}
function _w2QuestExists(title){var q=worldState.questLog||[],i;for(i=0;i<q.length;i++)if(String(q[i].title).toLowerCase()===String(title).toLowerCase()&&q[i].status!=="offered")return true;return false;}
function _w2StripRewards(text){return text.replace(/\[XP:[^\]]+\]/g,"").replace(/\[GOLD:[^\]]+\]/g,"").replace(/\[ITEM_GAINED:[^\]]+\]/g,"");}
function _w2TxnOpReason(meta,ops){
  var allowed=meta.claim==="npc-death"?{SCENE_DEATH:1,NPC:1,QUEST_STEP:1,QUEST:1,XP:1,GOLD:1,ITEM_GAINED:1}:{QUEST_STEP:1,QUEST:1,XP:1,GOLD:1,ITEM_GAINED:1},i,name,m,title;
  if(meta.claim==="quest-outcome"&&(meta.subject!=="-"||meta.evidence!=="-"))return"quest outcome must not claim an NPC identity";
  for(i=0;i<ops.length;i++){
    name=_w2TagName(ops[i]);if(!allowed[name])return"unsupported operation "+name+" inside "+meta.claim+" transaction";
    if(name==="NPC"){m=_w2DeathStatusTag(ops[i]);if(!m)return"npc-death transaction contains a non-death NPC write";if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject))return"death operation names a different NPC than the transaction subject";}
    if(name==="SCENE_DEATH"){m=ops[i].match(/^\[SCENE_DEATH:([^\]]+)\]/);if(!m||m[1].trim()!==meta.evidence)return"death operation names a different scene handle";}
    if(name==="QUEST"||name==="QUEST_STEP"){m=ops[i].match(name==="QUEST"?/^\[QUEST:([^|\]]+)/:/^\[QUEST_STEP:([^|\]]+)/);title=m?m[1].trim():"";if(meta.quest==="-"||_w2Compact(title)!==_w2Compact(meta.quest))return"quest operation does not match the transaction quest";}
  }
  return"";
}
function w2PrepareResponse(text){
  text=String(text||"");var hasW2=/\[(?:SCENE_REF|SCENE_NOT|SCENE_REVEAL|SCENE_DEATH|CANON_TXN_BEGIN|CANON_TXN_END):/.test(text);if(hasW2)sceneRefsEnsure();
  var ordinary=text,txns=[],planned={},re=/\[CANON_TXN_BEGIN:([^\]]+)\]([\s\S]*?)\[CANON_TXN_END:([^\]]+)\]/g,m;
  while((m=re.exec(text))){
    ordinary=ordinary.replace(m[0],"");var p=m[1].split("|"),meta={id:(p[0]||"").trim(),claim:(p[1]||"").trim(),subject:(p[2]||"").trim(),evidence:(p[3]||"").trim(),quest:(p[4]||"").trim()},ops=_w2Tags(m[2]),reason="",existing=_w2TxnFind(meta.id),prior=planned[meta.id]||existing,i;
    if(p.length!==5||!meta.id||m[3].trim()!==meta.id)reason="malformed or mismatched transaction envelope";else if(meta.claim!=="npc-death"&&meta.claim!=="quest-outcome")reason="unsupported canon claim type";else if(prior&&prior.status==="quarantined")reason="claim id was already quarantined";else if(prior&&!_w2TxnMetaSame(prior,meta))reason="claim id was reused with different metadata";
    if(!reason)reason=_w2TxnOpReason(meta,ops);
    if(!reason&&meta.claim==="npc-death"&&!prior){var hasDeath=false,deathHandle="",j;for(j=0;j<ops.length;j++){var sd=ops[j].match(/^\[SCENE_DEATH:([^\]]+)\]/),nd=_w2DeathStatusTag(ops[j]);if(sd){hasDeath=true;deathHandle=sd[1].trim();}if(nd)hasDeath=true;}if(!hasDeath)reason="new npc-death claim carries no death operation";else if(deathHandle&&deathHandle!==meta.evidence)reason="death operation names a different scene handle";else if(!w2DeathAuthorized(meta.subject,meta.evidence))reason="scene evidence does not bind the claimed victim";}
    if(!reason&&meta.claim==="quest-outcome"&&!_w2QuestExists(meta.quest))reason="quest outcome names no active accepted quest";
    if(!reason&&!prior&&meta.claim==="npc-death"&&meta.quest!=="-"&&!_w2QuestExists(meta.quest))reason="death outcome names no active accepted quest";
    if(!reason&&!prior&&w2TextTouchesConflict(m[2]))reason="operation touches an unresolved identity conflict";if(worldState.canonTxnOverflow&&!prior)reason="canon transaction receipt capacity is exhausted";
    if(reason){w2TxnQuarantine(meta,reason,ops);for(i=0;i<txns.length;i++)if(txns[i].meta.id===meta.id){txns[i].body="";txns[i].ops=[];txns[i].valid=false;txns[i].reason=reason;}txns.push({meta:meta,body:"",ops:ops,valid:false,reason:reason});continue;}
    var fresh=[],freshTokens=[],seen=prior&&prior.operations?prior.operations.slice():[],allTokens=_w2OpTokens(ops);for(i=0;i<ops.length;i++){var fp=_w2OpFingerprint(ops[i]),tok=allTokens[i];if(seen.indexOf(tok)<0&&seen.indexOf(fp)<0&&seen.indexOf(ops[i])<0){fresh.push(ops[i]);freshTokens.push(tok);seen.push(tok);}}
    if(!planned[meta.id])planned[meta.id]={id:meta.id,claim:meta.claim,subject:meta.subject,evidence:meta.evidence,quest:meta.quest,status:"planned",operations:seen};else planned[meta.id].operations=seen;txns.push({meta:meta,body:fresh.join(""),ops:fresh,tokens:freshTokens,valid:true});
  }
  if(/\[CANON_TXN_(?:BEGIN|END):/.test(ordinary)){ordinary=ordinary.replace(/\[CANON_TXN_(?:BEGIN|END):[^\]]+\]/g,"");ordinary=_w2StripRewards(ordinary).replace(/\[QUEST(?:_STEP)?:[^\]]+\]/g,"").replace(/\[SCENE_DEATH:[^\]]+\]/g,"").replace(/\[NPC:[^\]]+\]/g,"");if(typeof console!=="undefined")console.warn("[identity] unmatched canon transaction marker - identity/quest/reward operations refused");}
  var bareDeaths=ordinary.match(/\[SCENE_DEATH:([^\]]+)\]/g)||[],bd;for(bd=0;bd<bareDeaths.length;bd++){var bm=bareDeaths[bd].match(/\[SCENE_DEATH:([^\]]+)\]/),bh=bm[1].trim(),ba=_sceneRefActor(bh);ordinary=ordinary.replace(bareDeaths[bd],"");_w2Conflict(ba&&ba.actor.entity?ba.actor.entity:"unknown",bh,"scene death was emitted outside a canon transaction");}
  var npcTags=ordinary.match(/\[NPC:[^\]]+\]/g)||[],n;for(n=0;n<npcTags.length;n++){var dm=_w2DeathStatusTag(npcTags[n]);if(!dm)continue;var nm=resolveNpcName(dm[1].trim()),ws=(typeof wsNpcByName==="function")?wsNpcByName(nm):null;if(worldState.sceneRefs&&!npcIsDead(ws)&&!w2DeathAuthorized(nm,null)){ordinary=ordinary.replace(npcTags[n],"");_w2Conflict(nm,"-","named death has no prior positive scene binding");}}
  var conflict=w2TextTouchesConflict(ordinary);if(conflict&&(/\[QUEST_STEP:[^\]]+\|(?:true|done|1|yes|x)\]/i.test(ordinary)||/\[QUEST:[^|\]]+\|(?:completed?|done|finished|failed)/i.test(ordinary))){ordinary=ordinary.replace(/\[QUEST_STEP:[^\]]+\]/g,"").replace(/\[QUEST:[^\]]+\]/g,"");ordinary=_w2StripRewards(ordinary);if(typeof console!=="undefined")console.warn("[identity] quest/reward consequence refused - response still names unresolved victim "+conflict.subject);}
  var merges=ordinary.match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/g)||[],mi;for(mi=0;mi<merges.length;mi++){var mp=merges[mi].match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/),mc=mp[1].trim(),md=mp[2].trim();if(!w2MergeAllowed(mc,md)){ordinary=ordinary.replace(merges[mi],"");w2MergePropose(mc,md);}}
  var gen=ordinary.match(/\[MERGE:npc\|([^|\]]+)\|([^\]]+)\]/g)||[];for(mi=0;mi<gen.length;mi++){var gp=gen[mi].match(/\[MERGE:npc\|([^|\]]+)\|([^\]]+)\]/),gc=gp[1].trim(),gd=gp[2].trim();if(!w2MergeAllowed(gc,gd)){ordinary=ordinary.replace(gen[mi],"");w2MergePropose(gc,gd);}}
  return {ordinary:ordinary,txns:txns};
}
function _w2ChapterDeath(name,summary){var esc=String(name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),n="\\b"+esc+"\\b",s=String(summary||"");return new RegExp(n+"\\s+(?:died|perished)\\b","i").test(s)||new RegExp(n+"\\s+(?:(?:was|is|had been|has been|lay|lies|fell|falls|dropped|drops|remained|remains)\\s+)(?:dead|slain|killed|deceased)\\b","i").test(s)||new RegExp("\\b(?:the\\s+)?death\\s+of\\s+"+n,"i").test(s);}

// W6 summary identity authority is deliberately narrower than the roster. Player/party sheet
// gender and explicitly stored NPC pronouns are canon; the roster's synthetic they/them fallback
// is presentation, not evidence. The table is rebuilt per extraction window and never accumulates.
function _w6PronounFamily(p){p=String(p||"").toLowerCase().replace(/\s+/g,"");if(p==="he/him")return"M";if(p==="she/her")return"F";if(p==="they/them")return"NB";return"";}
function _w6GenderFamily(g){return g==="M"||g==="F"||g==="NB"?g:"";}
function _w6Pronouns(f){return f==="M"?"he/him":f==="F"?"she/her":f==="NB"?"they/them":"";}
function _w6AliasList(){var out=[],chars=0,i,j,a,src;for(i=0;i<arguments.length;i++){src=arguments[i]||[];for(j=0;j<src.length;j++){a=String(src[j]||"").trim();if(!a||a.length>120||out.indexOf(a)>=0||out.length>=3||chars+a.length>180)continue;out.push(a);chars+=a.length;}}return out;}
function _w6WorldNpc(canon){var a=(worldState&&worldState.npcs)||[],i;for(i=0;i<a.length;i++)if(resolveNpcName(a[i].name)===canon)return a[i];return null;}
function _w6IdentityRow(name,kind,handles){
  var canon=kind==="player"?String(name||"").trim():resolveNpcName(String(name||"").trim()),w=kind==="player"?null:_w6WorldNpc(canon),m=memory.npcs&&memory.npcs[canon],sheet=w&&w.charSheet,family="",aliases=[],wf,mf;
  if(!canon||canon.length>120)return null;
  if(kind==="player"){family=_w6GenderFamily(worldState.character&&worldState.character.gender);aliases=_w6AliasList(worldState.character&&worldState.character.aliases);}
  else if(w&&w.partyMember&&sheet){family=_w6GenderFamily(sheet.gender);aliases=_w6AliasList(sheet.aliases,w.aliases,m&&m.aliases);kind="party";}
  else{wf=_w6PronounFamily(w&&w.pronouns);mf=_w6PronounFamily(m&&m.pronouns);if(wf&&mf&&wf!==mf){if(typeof console!=="undefined")console.warn("[identity] W6 abstained on conflicting pronoun stores for "+canon);return null;}family=wf||mf;aliases=_w6AliasList(w&&w.aliases,m&&m.aliases);kind=kind||"npc";}
  if(!family)return null;
  return {name:canon,family:family,pronouns:_w6Pronouns(family),gender:(kind==="player"||kind==="party")?family:"",aliases:aliases,kind:kind||"npc",dead:!!((w&&w.dead)||(m&&m.dead)),handles:(handles||[]).slice(0,3)};
}
function summaryIdentityTable(raw){
  var table={rows:[],truncated:false},seen={},low=String(raw||"").toLowerCase(),c=worldState&&worldState.character,i,j,row,names=[],handles={};
  function add(name,kind){var key=kind==="player"?String(name||"").toLowerCase():String(resolveNpcName(name)||"").toLowerCase();if(!key||seen[key])return;row=_w6IdentityRow(name,kind,handles[key]);if(!row)return;if(table.rows.length>=SUMMARY_IDENTITY_ROW_CAP){table.truncated=true;return;}seen[key]=1;table.rows.push(row);}
  if(typeof _sceneRefFrames==="function"){var fs=_sceneRefFrames();for(i=0;i<fs.length;i++){var actors=(fs[i]&&fs[i].actors)||[];for(j=0;j<actors.length;j++)if(actors[j].entity){var cn=resolveNpcName(actors[j].entity),hk=String(cn).toLowerCase();if(!handles[hk])handles[hk]=[];if(handles[hk].indexOf(actors[j].handle)<0)handles[hk].push(actors[j].handle);names.push(cn);}}}
  if(c&&c.name)add(c.name,"player");
  for(i=0;i<((worldState&&worldState.npcs)||[]).length;i++)if(worldState.npcs[i]&&worldState.npcs[i].partyMember&&worldState.npcs[i].charSheet)add(worldState.npcs[i].name,"party");
  for(i=0;i<names.length;i++)add(names[i],"scene");
  if(typeof ragScanNames==="function"&&typeof ragKnownNames==="function")ragScanNames(low,ragKnownNames(),function(nm){add(nm,"npc");});
  return table;
}
function buildSummaryIdentityBlock(table){
  table=table&&table.rows?table:summaryIdentityTable("");var lines=["CANONICAL IDENTITIES - engine authority for this extraction. Use these exact names/pronouns; if an actor is absent or ambiguous, omit the pronoun assertion rather than guess."],kept=[],i,r,line;
  for(i=0;i<table.rows.length;i++){r=table.rows[i];line="- "+r.name+" | "+r.pronouns+(r.gender?" | gender "+r.gender:"")+" | "+r.kind+" | "+(r.dead?"dead":"alive")+(r.aliases.length?" | aliases: "+r.aliases.join(", "):"")+(r.handles.length?" | scene: "+r.handles.join(", "):"");if((lines.join("\n").length+line.length+2)>SUMMARY_IDENTITY_CHAR_CAP){table.truncated=true;break;}lines.push(line);kept.push(r);}
  table.rows=kept;/* validation sees exactly the bounded authorities the extractor saw */
  if(table.truncated&&lines.join("\n").length+82<=SUMMARY_IDENTITY_CHAR_CAP)lines.push("- TABLE BOUNDED: omit identity claims about any omitted actor; never infer pronouns.");
  return lines.join("\n").slice(0,SUMMARY_IDENTITY_CHAR_CAP-2)+"\n\n";
}
function _w6TextHasName(low,row){var a=[row.name].concat(row.aliases||[]),i;for(i=0;i<a.length;i++)if(ragHasWord(low,String(a[i]).toLowerCase()))return true;return false;}
function _w6StartsWithName(sent,row){var low=String(sent||"").toLowerCase().replace(/^\s+/,""),a=[row.name].concat(row.aliases||[]),i,n;for(i=0;i<a.length;i++){n=String(a[i]).toLowerCase();if(low.indexOf(n)===0&&!/[a-z0-9]/.test(low.charAt(n.length)))return true;}return false;}
function _w6SummaryTexts(extracted){
  var out=[],i,x,v;function add(field,val){if(typeof val==="string"&&val.trim())out.push({field:field,text:val});}
  add("chapterSummary",extracted.chapterSummary);
  v=extracted.loreDiscovered;if(Array.isArray(v))for(i=0;i<v.length;i++)add("loreDiscovered["+i+"]",v[i]);
  v=extracted.decisionsMade;if(Array.isArray(v))for(i=0;i<v.length;i++)add("decisionsMade["+i+"]",v[i]);
  v=extracted.resolvedEvents;if(Array.isArray(v))for(i=0;i<v.length;i++)add("resolvedEvents["+i+"]",v[i]);
  v=extracted.futureEvents;if(Array.isArray(v))for(i=0;i<v.length;i++){x=v[i]||{};add("futureEvents["+i+"].what",x.what);add("futureEvents["+i+"].when",x.when);}
  v=extracted.supersededFacts;if(Array.isArray(v))for(i=0;i<v.length;i++){x=v[i]||{};add("supersededFacts["+i+"].old",x.old);add("supersededFacts["+i+"].new",x["new"]);}
  v=extracted.npcUpdates;if(Array.isArray(v))for(i=0;i<v.length;i++){x=v[i]||{};add("npcUpdates["+i+"].attitude",x.attitude);if(typeof x.knowledgeGained==="string")add("npcUpdates["+i+"].knowledgeGained",x.knowledgeGained);else if(x.knowledgeGained)add("npcUpdates["+i+"].knowledgeGained.fact",x.knowledgeGained.fact);}
  return out;
}
function _w6SubjectFamily(sent){var low=String(sent||"").toLowerCase(),m=low.match(/(?:^|[,;:]\s*|\b(?:and|but|then)\s+)\s*(she|he)\b/);if(m)return m[1]==="she"?"F":"M";if(/\bherself\b/.test(low))return"F";if(/\bhimself\b/.test(low))return"M";return"";}
function _w6TextConflict(text,table){
  var s=String(text||""),sq=(s.match(/"/g)||[]).length;if(sq%2||(s.match(/\u201c/g)||[]).length!==(s.match(/\u201d/g)||[]).length)return null;
  var re=/[^.!?]+(?:[.!?]+["\u201d]*|$)/g,m,prior=null;
  while((m=re.exec(s))){var sent=m[0],low=sent.toLowerCase(),named=[],i,f;if(/["\u201c\u201d]/.test(sent)){prior=null;continue;}for(i=0;i<table.rows.length;i++)if(_w6TextHasName(low,table.rows[i]))named.push(table.rows[i]);if(named.length===0&&prior){f=_w6SubjectFamily(sent);if((prior.family==="M"||prior.family==="F")&&f&&f!==prior.family)return {row:prior,sentence:sent.trim(),found:_w6Pronouns(f)};}prior=named.length===1&&_w6StartsWithName(sent,named[0])?named[0]:null;}
  return null;
}
function w6ValidateSummary(extracted,table){
  table=table&&table.rows?table:summaryIdentityTable(JSON.stringify(extracted||{}));var texts=_w6SummaryTexts(extracted||{}),i,hit;
  for(i=0;i<texts.length;i++){hit=_w6TextConflict(texts[i].text,table);if(hit){var e=new Error("W6 summary identity: "+hit.row.name+" is "+hit.row.pronouns+" but "+texts[i].field+" carries "+hit.found+" as the sole adjacent subject");e.summaryIdentity=true;e.subject=hit.row.name;e.field=texts[i].field;e.sentence=hit.sentence;throw e;}}
  return true;
}
function validateSummaryExtract(extracted,table){if(typeof w6ValidateSummary==="function")w6ValidateSummary(extracted,table);if(typeof w2ValidateSummary==="function")w2ValidateSummary(extracted);return true;}
function w2ValidateSummary(extracted){
  var legacyTrusted=!worldState.sceneRefs;sceneRefsEnsure();var ds=Array.isArray(extracted.npcDeaths)?extracted.npcDeaths:[],valid={},i,reason="",subject="",handle="-";
  for(i=0;i<ds.length;i++){var d=ds[i],name=(d&&typeof d==="object")?String(d.name||""):String(d||""),ws=name&&typeof wsNpcByName==="function"?wsNpcByName(resolveNpcName(name)):null,mem=name&&memory.npcs&&memory.npcs[resolveNpcName(name)];if(!name)continue;name=resolveNpcName(name);subject=name;handle=(d&&typeof d==="object")?String(d.handle||""):"-";if((ws&&ws.dead)||(mem&&mem.dead)){valid[name]=true;continue;}if((!d||typeof d!=="object")&&!legacyTrusted)reason="uncited legacy npcDeaths entry cannot mint a new corpse";else if(!d||typeof d!=="object")valid[name]=true;else if(d.sourceTurn==null||!isFinite(Number(d.sourceTurn)))reason="summary death lacks a source turn";else if(!handle||!w2DeathAuthorized(name,handle,Number(d.sourceTurn)))reason="summary death lacks matching scene-handle evidence";else valid[name]=true;if(reason)break;}
  if(!reason&&extracted.chapterSummary){var names=Object.keys(memory.npcs||{}),j;for(j=0;j<names.length;j++){var cn=resolveNpcName(names[j]),cw=typeof wsNpcByName==="function"?wsNpcByName(cn):null;if((cw&&cw.dead)||memory.npcs[cn].dead||valid[cn])continue;if(_w2ChapterDeath(cn,extracted.chapterSummary)){subject=cn;reason="death-like chapter claim has no cited npcDeaths evidence";break;}}}
  if(reason){_w2Conflict(subject,handle,reason);var e=new Error("W2 referential integrity: "+subject+" - "+reason);e.w2Identity=true;e.subject=subject;e.handle=handle;throw e;}return true;
}
function buildSceneRefBlock(){
  var s=sceneRefsEnsure(),f=s.active,lines=[],i;if(!f.actors.length&&!f.negatives.length&&!s.sealed.length&&!s.overflow)return"";
  lines.push("SCENE REFERENTS - engine-authoritative observations; a handle is not a canonical identity unless explicitly bound below.");lines.push("Current scene "+f.scene+" at "+f.node+" (since t"+f.startTurn+"):");
  for(i=0;i<f.actors.length;i++)lines.push("- "+f.actors[i].handle+" = "+(f.actors[i].entity||"anonymous/unknown")+(f.actors[i].revealed?" (revealed t"+f.actors[i].revealTurn+")":""));for(i=0;i<f.negatives.length;i++)if(!f.negatives[i].resolved)lines.push("- "+f.negatives[i].handle+" "+(f.negatives[i].mode==="explicit"?"IS NOT ":"was inferred not to be ")+f.negatives[i].entity);
  if(s.sealed.length)lines.push("Earlier transitioned frames remain evidence for the next structured summary: "+s.sealed.map(function(x){return "scene "+x.scene+"@"+x.node;}).join(", ")+".");if(s.overflow&&s.overflow.frame){var of=s.overflow.frame;lines.push("Overflow-preserved scene "+of.scene+"@"+of.node+": "+(of.actors||[]).map(function(x){return x.handle+"="+(x.entity||"anonymous/unknown");}).join(", ")+".");}if(s.overflow)lines.push("EVIDENCE CAPACITY WARNING: "+s.overflow.kind+" overflowed; do not emit irreversible identity consequences until a structured summary covers the preserved evidence.");
  lines.push("For a newly observed actor, emit [SCENE_REF:short_handle|canonical name or ?]. Record an explicit disidentification with [SCENE_NOT:handle|canonical|explicit]; use inference only for an uncertain POV guess. A later on-screen reveal uses [SCENE_REVEAL:handle|canonical], but irreversible consequences must wait for the next response. Death/quest/reward consequences travel inside one CANON_TXN envelope using a stable claim id.");return lines.join("\n")+"\n\n";
}

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
