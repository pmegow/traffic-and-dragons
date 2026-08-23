// identity.js — #156 THE IDENTITY LAYER, Phase A: the spine + the npc domain. ⛨ DRIFT SURFACE.
//
// The engine keys every canonical store by model-authored name strings, and string equality
// fails in two directions at campaign scale: DRIFT (many names accrete around one thing) and
// COLLISION (one name is reused for a new thing, fusing two entities' canon into one record —
// the three-Savahs class, field-confirmed at t1593). Five stores grew independent partial
// guards; this file is the shared spine they consolidate into (proposal + adjudicated plan:
// DOC/Research/identity_hardening_fable.html §7).
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
  /* #173 (amendment ④): the guestbook folds too — turn union + dedupe + OR resident, per name.
     Before this, locMerge deleted the duplicate's visit provenance with its node (brief B). */
  if(dupNode.guestbook&&typeof guestbookFoldBooks==="function")guestbookFoldBooks(canonNode,dupNode);
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
  var notes=node.stateNotes||[],items=node.items||[],npcs=node.npcs||[],gbook=node.guestbook||{};
  var claimedN={},claimedI={},claimedP={},claimedG={};
  for(i=0;i<succ.length;i++){
    var s=succ[i],take=s.take||{};
    var fresh={firstVisit:node.firstVisit,visits:0,description:null,parent:node.parent||null,npcs:[],items:[],size:null,travelMins:null};
    if(s.kind)fresh.kind=s.kind;
    if(s.endpoints)fresh.endpoints=s.endpoints.slice();
    for(j=0;j<(take.stateNotes||[]).length;j++){var ni=take.stateNotes[j];if(notes[ni]){fresh.stateNotes=fresh.stateNotes||[];fresh.stateNotes.push(notes[ni]);claimedN[ni]=1;}}
    for(j=0;j<(take.items||[]).length;j++){var ii=take.items[j];if(items[ii]){fresh.items.push(items[ii]);claimedI[ii]=1;}}
    for(j=0;j<(take.npcs||[]).length;j++){if(npcs.indexOf(take.npcs[j])>=0){fresh.npcs.push(take.npcs[j]);claimedP[take.npcs[j]]=1;}}
    /* #173 (amendment ④): guestbook allocation is EXPLICIT — take.guestbook names the characters
       whose whole visit record moves to this successor; a silent primary-copy is not evidence.
       First claim wins (the claimedP pattern); unclaimed records stay with the primary below. */
    for(j=0;j<(take.guestbook||[]).length;j++){var gk=take.guestbook[j];if(gbook[gk]&&!claimedG[gk]){fresh.guestbook=fresh.guestbook||{};fresh.guestbook[gk]=gbook[gk];claimedG[gk]=1;}}
    for(j=0;j<(take.children||[]).length;j++){var ck=take.children[j],cn=memory.map.nodes[ck];if(cn)cn.parent=s.key;}
    memory.map.nodes[s.key]=fresh;
  }
  var prim=memory.map.nodes[spec.primary];
  prim.visits=node.visits||0;prim.lastVisit=node.lastVisit;prim.description=node.description;prim.size=node.size;prim.travelMins=node.travelMins;
  for(i=0;i<notes.length;i++){if(!claimedN[i]){prim.stateNotes=prim.stateNotes||[];prim.stateNotes.push(notes[i]);}}
  if(prim.stateNotes)prim.stateNotes.sort(function(a,b){return (a.t||0)-(b.t||0);});
  for(i=0;i<items.length;i++){if(!claimedI[i])prim.items.push(items[i]);}
  for(i=0;i<npcs.length;i++){if(!claimedP[npcs[i]])prim.npcs.push(npcs[i]);}
  var gbNames=Object.keys(gbook);/* #173: unclaimed guestbook records stay with the primary — coarse-but-consistent, same as every other unallocated fact */
  for(i=0;i<gbNames.length;i++){if(!claimedG[gbNames[i]]){prim.guestbook=prim.guestbook||{};prim.guestbook[gbNames[i]]=gbook[gbNames[i]];}}
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
    /* #168R5 (entry-13 review): an NPC merge folding both sheets' outgoing rows can rekey a row's entity
       INTO its own owner — a self-edge ("Ameiko → Ameiko: Wife") that then renders in prompt, audit, and
       sheet UI. Meaningless by construction; dropped loudly. The merge pre-image archive (P12) retains the
       full duplicate sheet, so nothing is lost. Portable sheets skip this — their entity keys resolve
       against a campaign that is not theirs. */
    if(!(opts&&opts.portable)){var _selfKey=relationshipEntityKey(who||(typeof worldState!=="undefined"&&worldState&&worldState.character&&worldState.character.name)||"");if(_selfKey&&row.entity===_selfKey){_relationshipWarn("self-referential relationship edge dropped during migration: "+(who||"player")+" → "+row.entity+" (merge artifact; pre-image lives in the merge archive)");continue;}}
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
  var sheet=relationshipSheet(who),ent=relationshipEntityKey(entity);
  if(!sheet){_relationshipWarn("no character sheet for '"+(who||"player")+"' — relationship tag refused");return false;}
  relationshipMigrateSheet(sheet,who);var row=relationshipFind(sheet,ent,who),rows=sheet.relationships;
  var raw=axis==="pair"?"":String(value||"").trim(),next;
  if(axis==="pair")next="";
  else if(raw.length<=REL_VALUE_MAX)next=raw;
  else if(row&&row.bond===raw&&(axis==="bond"||row.axisReview))next=raw;/* #168R4 (entry-13 review): verbatim migration is lossless BY DESIGN and may exceed REL_VALUE_MAX; re-emitting that EXACT text classifies/confirms EXISTING canon rather than minting new — refusing it left the migrated row permanently unconfirmable by the very tag the nudge prints */
  else{next=_relationshipValue(value,"relationship "+axis,R);if(next===null)return false;}
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
    if(pending.turn>=worldState.turn){/* #171④ (owner-ruled LOUD): the dedupe stays, the silence goes */_relationshipWarn("bond change for "+ent+" ignored — a same-response duplicate cannot confirm itself");if(R)R.muts.push("Bond change NOT confirmed (same-response duplicate): "+(who?who+" → ":"")+ent);return false;}
    if((row.bond||"")!==String(pending.prev||"")){/* #171⑥: the staged preimage moved — confirming would clobber a value nobody reviewed */_relationshipWarn("bond confirmation for "+ent+" refused — the bond moved since staging ('"+pending.prev+"' is no longer current); restage if still intended");if(R)R.muts.push("Bond change DROPPED (preimage moved — restage to proceed): "+(who?who+" → ":"")+ent);_relationshipRemovePending(relationshipEdgeKey(who,ent));return false;}
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
function _sceneRefFresh(node,serial){return {scene:serial,node:node,startTurn:worldState.turn,actors:[],negatives:[],observed:[],acknowledged:false};}/* #194: observed[] = ENGINE-DERIVED presence beside the GM-authored actors[] — evictable, re-derivable, never latch-arming */
function sceneRefsEnsure(){
  if(!worldState)return null;
  var node=_sceneRefNode(),s=worldState.sceneRefs;
  if(!s){s=worldState.sceneRefs={serial:1,active:_sceneRefFresh(node,1),sealed:[],overflow:null};return s;}
  if(!s.sealed)s.sealed=[];
  if(!s.active)s.active=_sceneRefFresh(node,s.serial||1);
  if(s.active.node!==node){
    var old=s.active,has=(old.actors&&old.actors.length)||(old.negatives&&old.negatives.length);old.endTurn=worldState.turn;
    if(has){if(s.sealed.length<SCENE_REF_SEALED_CAP)s.sealed.push(old);
    else if(!s.overflow){s.overflow={kind:"sealed",turn:worldState.turn,node:old.node,scene:old.scene,frame:old};if(typeof console!=="undefined")console.warn("[identity] scene-frame cap reached - accepted frames preserved; referential writes fail closed until a structured summary succeeds");}
    /* #168R9 (entry-13 review): the old `s.overflow=s.overflow||…` kept only the FIRST overflow record, so a
       transition under an already-latched overflow silently DROPPED the departing frame's accepted evidence
       while the warn claimed preservation. Later frames now ride a bounded buffer; only past 2× the cap does
       a frame drop, and that drop says so honestly. */
    else{s.overflow.frames=s.overflow.frames||[];if(s.overflow.frames.length<SCENE_REF_SEALED_CAP){s.overflow.frames.push(old);if(typeof console!=="undefined")console.warn("[identity] scene-frame cap reached - transitioned frame preserved in the overflow buffer; referential writes fail closed until a structured summary succeeds");}else if(typeof console!=="undefined")console.warn("[identity] scene-frame overflow buffer FULL - a transitioned frame's evidence was DROPPED; run a structured summary to recover capacity (#168R9)");}}
    s.serial=(s.serial||1)+1;s.active=_sceneRefFresh(node,s.serial);
  }
  return s;
}
function sceneRefsEvidence(){var s=sceneRefsEnsure();return {actors:s.active.actors,negatives:s.active.negatives,sealed:s.sealed,overflow:s.overflow,active:s.active,serial:s.serial};}
function sceneRefsSummarySuccess(){var s=sceneRefsEnsure();if(!s)return;if(s.sealed.length)s.sealed=[];s.active.acknowledged=true;if(s.overflow&&s.overflow.scene!==s.active.scene)s.overflow=null;}
function sceneRefsSummaryFailure(){/* Typed evidence survives every retry and degraded fallback. */}
function _sceneRefFrames(){var s=worldState&&worldState.sceneRefs;if(!s)return[];var fs=[s.active].concat((s.sealed||[]).slice().reverse());if(s.overflow&&s.overflow.frame&&fs.indexOf(s.overflow.frame)<0)fs.push(s.overflow.frame);if(s.overflow&&s.overflow.frames)for(var _ofi=0;_ofi<s.overflow.frames.length;_ofi++)if(fs.indexOf(s.overflow.frames[_ofi])<0)fs.push(s.overflow.frames[_ofi]);/* #168R9: buffered frames stay readable evidence */return fs;}
/* #201 (v1.669): THE handle canonicalizer — the t2032 Third Watcher deadlock was a one-character
   spelling drift ("bronze_masked_runner" cited against the registered "bronze-masked runner"):
   four envelopes refused, the reveal dead, the quest locked, though every substantive requirement
   was met. A handle's separators and case are RENDERING, never identity — every comparison goes
   through this key; stored handles keep their as-emitted display form. */
function w2HandleKey(h){return String(h||"").toLowerCase().replace(/[-_\s]+/g," ").trim();}
function _sceneRefActor(handle,sourceTurn){
  var fs=_sceneRefFrames(),i,j,h=w2HandleKey(handle);
  for(i=0;i<fs.length;i++){var a=(fs[i]&&fs[i].actors)||[];for(j=0;j<a.length;j++)if(w2HandleKey(a[j].handle)===h&&(sourceTurn==null||a[j].sourceTurn===sourceTurn))return {actor:a[j],frame:fs[i]};}
  return null;
}
function _sceneRefExplicitNegative(frame,handle,entity){
  var ns=(frame&&frame.negatives)||[],h=w2HandleKey(handle),e=String(entity||"").toLowerCase(),i;
  for(i=0;i<ns.length;i++)if(!ns[i].resolved&&ns[i].mode==="explicit"&&w2HandleKey(ns[i].handle)===h&&String(ns[i].entity).toLowerCase()===e)return ns[i];
  return null;
}
function _sceneRefOverflow(kind){var s=sceneRefsEnsure();if(!s.overflow)s.overflow={kind:kind,turn:worldState.turn,node:s.active.node,scene:s.active.scene};if(typeof console!=="undefined")console.warn("[identity] scene evidence overflow ("+kind+") - accepted evidence preserved; irreversible identity writes fail closed");}
/* ═══ #194: DERIVED PRESENCE — the engine authors the scene record the GM won't ═══════════════
   presenceObserve is the one entry for every derived channel ("say"/"combat"/"cast"). It refuses
   the player, the dead, split members, and unresolvable names LOUDLY and creates nothing; a
   accepted observation lands in BOTH stores through npcRecordPresence (memory.js — lastSeen* +
   sourced guestbook) and in the active frame's observed[] list. observed[] is EVICTABLE (LRU,
   PRESENCE_OBSERVED_CAP) and must NEVER call _sceneRefOverflow — it is engine-derived and
   re-derivable from the next response's tags, unlike the GM-authored actors[] whose overflow
   deliberately freezes irreversible writes. Design: presence_panel_2026-08-17.md, layers 0-1. */
/* ═══ #194 Layer 6 (v1.671): PROJECTION HONESTY — the tier registry ═══════════════════════════
   The prompt's presence claims must carry their evidence grade in their VOICE: a fresh witnessed
   sighting, an old undated assertion, and mere rumor are three different facts, and the old
   uniform "Name → Place" arrow rendered them identically (48/69 live records were undated
   assertions wearing a sighting's clothes). Four tiers, memory voice, never ledger voice:
   - witnessed:  post-epoch turn-stamped lastSeen — "was last seen at X (recently/…)"
   - legacy:     lastSeenAt with no post-epoch stamp — "is said to be at X — old word"
   - spokenOf:   mention-only records — project ONLY through the node rumor texture, never a place claim
   - based-here: the resident flag — OWNED by #173's guestbook line, never re-rendered here
   Tiers grade PROJECTION only; the death gate's authorization grading (#194 gate 3) is separate
   and stricter, by design. */
var PRESENCE_TIERS={
  witnessed:{render:function(name,at,ageBand){return name+" was last seen at "+at+" ("+ageBand+").";}},
  legacy:{render:function(name,at){return name+" is said to be at "+at+" — old word, not a fresh sighting.";}},
  spokenOf:{render:function(){return null;}},
  resident:{render:function(){return null;}}
};
function presenceAgeBand(turnsAgo){
  if(turnsAgo<=PRESENCE_FRESH_TURNS)return"recently";
  if(turnsAgo<=PRESENCE_AGED_TURNS)return"a while back";
  return"long ago";
}
function presenceTier(name){
  var m=(typeof memory!=="undefined"&&memory&&memory.npcs)?memory.npcs[name]:null;if(!m)return null;
  var epoch=(worldState&&typeof worldState.presenceEpoch==="number")?worldState.presenceEpoch:0;
  if(m.lastSeenAt){
    if(typeof m.lastSeenTurn==="number"&&m.lastSeenTurn>=epoch)return{tier:"witnessed",at:m.lastSeenAt,turn:m.lastSeenTurn};
    return{tier:"legacy",at:m.lastSeenAt};
  }
  if(m.lastMentioned!=null)return{tier:"spokenOf"};
  return null;
}
function presenceObserve(name,channel){
  var raw=String(name||"").trim();if(!raw||!worldState)return false;
  var canon=resolveNpcName(raw);
  var n=(typeof wsNpcByName==="function")?wsNpcByName(canon):null;
  var m=(typeof memory!=="undefined"&&memory&&memory.npcs)?memory.npcs[canon]:null;
  if(!n&&!m){if(typeof console!=="undefined")console.info("[presence] '"+raw+"' ("+channel+") is not on the roster — no presence derived (refuse-and-warn, never create; registration is [NPC:]'s job)");return false;}
  if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(canon))return false;/* the PC is not an NPC */
  if((n&&typeof npcIsDead==="function"&&npcIsDead(n))||(m&&m.dead))return false;/* B3: the dead don't travel */
  if(n&&n.partyMember&&n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location)return false;/* #137: a split member's remote line/blow is not presence at the camera node */
  npcRecordPresence(canon,channel);/* the record half (lastSeen* + sourced guestbook) — may legitimately land nowhere when the current location was never FILED (the tagless-dungeon case); the frame observation below must survive that, or derived evidence dies exactly where location tags starve */
  /* Frame half: NEVER mints worldState.sceneRefs — activating the ledger changes w2DeathAuthorized's
     whole regime (its absence is the legacy-trusted bypass), and "every campaign becomes gated by a
     side effect of derivation" is exactly the unruled semantics change appendix 4 flagged. The
     sanctioned activator stays buildSysPrompt (every real gameplay turn); where the ledger does not
     exist there is no gate needing this evidence. */
  var s=worldState.sceneRefs?sceneRefsEnsure():null;if(!s)return true;
  var f=s.active;if(!f.observed)f.observed=[];/* pre-#194 frames */
  var t=worldState.turn,i,hit=null;
  for(i=0;i<f.observed.length;i++)if(f.observed[i].entity===canon){hit=f.observed[i];break;}
  if(hit){hit.lastTurn=t;hit.turns=(hit.turns||1)+1;}
  else{
    if(f.observed.length>=PRESENCE_OBSERVED_CAP){/* LRU evict — NEVER the overflow latch */
      var old=0;for(i=1;i<f.observed.length;i++)if(f.observed[i].lastTurn<f.observed[old].lastTurn)old=i;
      f.observed.splice(old,1);
    }
    f.observed.push({entity:canon,channel:channel,firstTurn:t,lastTurn:t,turns:1});
  }
  return true;
}
/* The one derivation pass, called at applyMutsTable's POST-HANDLER seam (amendment ③ discipline:
   same-response [LOCATION:]/[PARTY_SPLIT:]/rejoin/#133b-fold state has settled, so each observed
   character lands at their EFFECTIVE node and the split guard reads settled records). Parses
   TAGS only, never prose. Envelope bodies never reach here with presence tags — the W2 partition
   ejects them to the ordinary stream first. */
function derivePresenceFromResponse(text,R){
  if(!worldState)return;
  text=String(text||"");
  var recorded={},labels=[],m,i;
  function take(nm,ch){
    var key=String(nm||"").trim();if(!key)return;
    var canon=resolveNpcName(key);
    if(recorded[canon])return;
    if(presenceObserve(key,ch)){recorded[canon]=ch;labels.push(canon+" ("+ch+")");}
  }
  var re=/\[SAY:([^\]|]+)(?:\|[^\]]*)?\]/g;
  while((m=re.exec(text)))take(m[1],"say");
  re=/\[(?:COMBAT_START|ENEMY_SLAIN|ENEMY_SURRENDERS):([^|\]]+)[|\]]/g;
  while((m=re.exec(text)))take(m[1],"combat");
  re=/\[ENEMY_HP:([^|\]]+)\|/g;
  while((m=re.exec(text)))take(m[1],"combat");
  re=/\[SCENE_CAST:([^\]]*)\]/g;
  var castSeen=false;
  while((m=re.exec(text))){
    castSeen=true;
    var payload=m[1].trim();
    if(!/^none$/i.test(payload)){var parts=payload.split(/[|,]/);for(i=0;i<parts.length;i++)take(parts[i],"cast");}
  }
  if(castSeen){/* [SCENE_CAST:none] included — the sentinel makes NON-ANSWER measurable (layer 4) */
    if(!worldState.castAsk)worldState.castAsk={};
    worldState.castAsk.lastAnswerTurn=(R&&R.turn!=null)?R.turn:worldState.turn;
    worldState.castAsk.node=(typeof currentNodeKey==="function")?((typeof locResolve==="function")?locResolve(currentNodeKey()):currentNodeKey()):null;
  }
  if(labels.length&&R&&R.muts)R.muts.push("Present: "+labels.join(", "));
}
/* #194: the death gate's speech limb — transcript speaker maps (entry.sp) the engine wrote
   itself at narration time. This is NOT a prose scan and NOT RAG: the maps are structured,
   deterministic, turn-stamped, and ride the state blob/.tnd/sync. Bounded tail, memoized per
   (turn, transcript length); the window is claim-relative so summary-cited turns replay
   identically. */
var _spFactsMemo=null;
function _speechFactNear(canon,lim){
  if(!worldState||!worldState.transcript||!worldState.transcript.length)return null;
  var tr=worldState.transcript,now=(typeof worldState.turn==="number")?worldState.turn:0;
  var floor=now-(SPEECH_EVIDENCE_TURNS+80);/* covers summary-cited lims across the extraction window */
  if(!_spFactsMemo||_spFactsMemo.turn!==now||_spFactsMemo.len!==tr.length){
    var map={},i,e,k;
    for(i=tr.length-1;i>=0;i--){e=tr[i];if(!e)continue;
      if(typeof e.t==="number"&&e.t<floor)break;
      if(e.r!=="gm"||!e.sp||!e.sp.s)continue;
      var seen={};for(k in e.sp.s){var nm=String(e.sp.s[k]).trim();if(!nm||seen[nm])continue;seen[nm]=1;(map[nm]=map[nm]||[]).push(e.t);}
    }
    _spFactsMemo={turn:now,len:tr.length,map:map};
  }
  var best=null,count=0,nm2;
  for(nm2 in _spFactsMemo.map){
    if(resolveNpcName(nm2)!==canon)continue;/* merge-orphan bridge: speaker names re-resolve at read (§8b pattern) */
    var ts=_spFactsMemo.map[nm2],j;
    for(j=0;j<ts.length;j++){var t=ts[j];if(t<lim&&t>=lim-SPEECH_EVIDENCE_TURNS){count++;if(best==null||t>best)best=t;}}
  }
  return best!=null?{turn:best,count:count}:null;
}
function _observedFact(canon,lim){
  var fs=_sceneRefFrames(),i,j;
  for(i=0;i<fs.length;i++){var ob=(fs[i]&&fs[i].observed)||[];
    for(j=0;j<ob.length;j++){var o=ob[j];
      if(o.channel==="cast")continue;/* ruling ④: cast is playtest-gated out of authorization until a 50-turn run measures its compliance — promotion is this one clause */
      if(o.firstTurn<lim&&resolveNpcName(o.entity)===canon)return o;
    }}
  return null;
}
/* #194: the grade of the LAST authorization returned by w2NamedPresenceEvidence — "witnessed" or
   "legacy" (pre-epoch, ruling ③'s fail-open). Read by w2PrepareResponse to receipt-stamp legacy
   passes (the evidence a later fail-closed reversal would need). Reset per gate call. */
var _w2EvidenceGrade="witnessed";
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
  for(i=0;i<s.active.negatives.length;i++)if(w2HandleKey(s.active.negatives[i].handle)===w2HandleKey(h)&&s.active.negatives[i].entity===canon&&s.active.negatives[i].mode===m)return true;/* #201: spelling-drifted duplicates collapse */
  if(s.active.negatives.length>=SCENE_REF_NEGATIVE_CAP){_sceneRefOverflow("negatives");return false;}
  s.active.negatives.push({handle:h,entity:canon,mode:m,sourceTurn:worldState.turn,resolved:false});if(R)R.muts.push("Scene ref: "+h+" "+(m==="explicit"?"is not ":"may not be ")+canon);return true;
}
function sceneRefReveal(handle,entity,R){
  var s=sceneRefsEnsure(),hit=_sceneRefActor(handle),canon=resolveNpcName(String(entity||"").trim()),i;
  if(!hit||hit.frame!==s.active||!canon){/* #175bR: keyed on (subject,"-") so a GM inventing a fresh
       handle each retry re-arms the ONE standing record instead of minting a new one per attempt —
       the t1903 factory measured 9 records and a cap overflow from a single refused death. */
    _w2Conflict(canon||"unknown","-","reveal names no active observed handle (attempted: "+String(handle||"")+")");
    /* #201: a FAILED reveal is new information — the taught ceremony provably cannot work here, so
       the fork note (the two reachable exits) earns ONE more delivery even if its cap was spent.
       Bounded: each re-grant requires an actual failed reveal, and the conflict stale-shelf still
       caps the whole dispute at IDENTITY_CONFLICT_STALE_ATTEMPTS. */
    if(canon)_w2ArmDeathValve(canon,true);
    return false;}
  if(hit.actor.entity&&hit.actor.entity!==canon){_w2Conflict(canon,handle,"reveal conflicts with established binding to "+hit.actor.entity);return false;}
  hit.actor.entity=canon;hit.actor.revealed=true;hit.actor.revealTurn=worldState.turn;
  for(i=0;i<s.active.negatives.length;i++)if(w2HandleKey(s.active.negatives[i].handle)===w2HandleKey(hit.actor.handle)&&s.active.negatives[i].entity===canon)s.active.negatives[i].resolved=true;/* #201 */
  _w2ResolveConflicts(canon,hit.actor.handle);if(R)R.muts.push("Scene reveal: "+hit.actor.handle+" -> "+canon);return true;
}
function _w2StampDead(name,turn,R){
  var canon=resolveNpcName(name),n=(typeof wsNpcByName==="function")?wsNpcByName(canon):null,m=memory.npcs&&memory.npcs[canon];if(!n&&!m)return false;
  if(n){n.dead=turn;if(!npcDeadStatus(n.status))n.status="dead";n.statusTurn=turn;}if(m)m.dead=turn;_w2ResolveConflicts(canon,null);if(R)R.muts.push(canon+": dead (t"+turn+")");return true;
}
/* #175bR (entry-17 review): the transaction subject, threaded to the executor for the duration of
   one envelope body's application (set/cleared in applyMuts, api.js). The executor is PINNED to it:
   without the pin the handle's own fuzzy resolution chose the corpse — a "Caul" envelope with
   evidence handle "Vex" stamped Caulder Vex dead on the _w2SubjectDeadInCanon bypass, and a
   same-response scene tag could rebind the handle between preflight and execution. */
var _w2TxnSubjectNow=null;
function sceneRefDeath(handle,R){var hit=_sceneRefActor(handle);
  var subj=(_w2TxnSubjectNow&&_w2TxnSubjectNow!=="-")?resolveNpcName(String(_w2TxnSubjectNow).trim()):null;
  if(subj&&_w2SubjectDeadInCanon(subj)){
    /* #175: an already-canon death's envelope is closing bookkeeping — the death op is ceremonial.
       It must never stamp ANYONE (the subject is already dead; anyone else is the wrong corpse).
       The payout half of the envelope still applies (the t1742 flow). */
    if(R)R.muts.push(subj+": death already canon (closing envelope)");
    return true;}
  if(!hit){
    /* #175b: same self-naming rule as w2DeathAuthorized, at the executor. The authorization gate
       and the write must agree about what a handle IS, or an authorized death fails on execution. */
    var sn=_w2HandleNamesSubject(handle,subj);
    if(sn&&w2NamedPresenceEvidence(sn))return _w2StampDead(sn,worldState.turn,R);
    _w2Conflict(subj||"unknown",handle,"death names no observed handle");
    if(subj&&R&&R.errors)R.errors.push("SCENE_DEATH: handle does not resolve to the transaction subject");
    return false;}
  if(subj&&hit.actor.entity!==subj){
    /* #175bR: the bound scene actor is not the envelope's victim — a same-response [SCENE_REF:]/
       [SCENE_NOT:] changed the handle's meaning after the preflight authorized. Failing the handler
       rolls the whole envelope back (api.js) instead of killing the wrong corpse or paying rewards
       over no corpse. */
    _w2Conflict(subj,String(handle||""),hit.actor.entity?("scene handle rebound to "+hit.actor.entity+" in the same response"):"scene handle lost its subject binding before execution");
    if(R&&R.errors)R.errors.push("SCENE_DEATH: the bound scene actor is not the transaction subject");
    return false;}
  hit.actor.present=false;hit.actor.died=worldState.turn;if(hit.actor.entity)return _w2StampDead(hit.actor.entity,worldState.turn,R);if(R)R.muts.push("Anonymous scene actor "+hit.actor.handle+" died");return true;}
function w2DeathAuthorized(name,handle,sourceTurn){
  _w2EvidenceGrade="witnessed";/* #194: a pass that never reaches the graded gate (handle/actor paths) is witnessed by definition */
  if(!worldState||!worldState.sceneRefs)return true;
  var s=sceneRefsEnsure(),canon=(name&&name!=="-")?resolveNpcName(name):null,hit,i,fs;if(s.overflow)return false;
  if(handle&&handle!=="-"){hit=_sceneRefActor(handle,sourceTurn);
    /* #175b: a "handle" that IS the victim's own name is not an anonymous descriptor — it resolves
       to nobody because it never needed resolving. This is the shape the t1903 GM actually emitted
       ([CANON_TXN_BEGIN:...|Caul|caul|...] with [SCENE_DEATH:caul]), so without this the fix would
       have covered only the bare-tag path and the quarantine loop would have continued in play. */
    if(!hit)return _w2HandleNamesSubject(handle,canon)?!!w2NamedPresenceEvidence(canon,sourceTurn):false;if(sourceTurn!=null&&(Number(sourceTurn)>=worldState.turn||(hit.actor.revealed&&hit.actor.revealTurn>=worldState.turn)))return false;/* #168R6 (entry-13 review): the summary path passes an explicit sourceTurn — same-turn evidence must refuse exactly like the tag path, else a summary can cite the very response that armed it */if(sourceTurn==null&&(hit.actor.sourceTurn>=worldState.turn||(hit.actor.revealed&&hit.actor.revealTurn>=worldState.turn)))return false;if(!canon)return true;if(hit.actor.entity!==canon)return false;if(_sceneRefExplicitNegative(hit.frame,hit.actor.handle,canon)&&!hit.actor.revealed)return false;return true;}
  if(!canon)return false;/* #175bR: the frame scan honors a summary's cited sourceTurn exactly like
     the evidence limbs — a binding recorded AFTER the cited death turn cannot vouch for it. */
  var _nmLim=(sourceTurn!=null&&Number(sourceTurn)<worldState.turn)?Number(sourceTurn):worldState.turn;
  fs=_sceneRefFrames();for(i=0;i<fs.length;i++){var j,as=fs[i].actors||[];for(j=0;j<as.length;j++)if(as[j].sourceTurn<_nmLim&&(!as[j].revealed||as[j].revealTurn<_nmLim)&&as[j].entity===canon&&!_sceneRefExplicitNegative(fs[i],as[j].handle,canon))return true;}
  return !!w2NamedPresenceEvidence(canon,sourceTurn);
}
/* #175b — STRUCTURED PRESENCE, the NAME path's second source of positive binding (owner ruling
   2026-08-17, from the t1903 Caul incident). A scene handle exists to answer "WHICH NPC is the
   hooded stranger": it resolves ANONYMITY. When the claim names a character the engine has already
   established on screen, there is no anonymity to resolve, and demanding a handle asks the GM for
   ceremony it does not reliably perform — in t1903 it emitted [SCENE_REVEAL:] four times with
   handles it had never registered, minting a fresh conflict record each time while two death
   transactions stayed quarantined and the prose said the victim was dead. State and canon diverged
   in exactly the direction W2 exists to prevent, so the gate was producing the harm it guards.
   Admitted evidence is STRUCTURED and TURN-STAMPED only — never a transcript scan and never RAG:
   authority must be deterministic and replayable, and prose overlap cannot tell "X was here" from
   "someone said X's name" (the t1903 review). Handle-mediated paths are untouched. */
function w2NamedPresenceEvidence(name,sourceTurn){
  if(!worldState)return null;
  var canon=resolveNpcName(String(name||"").trim());if(!canon)return null;
  var n=(typeof wsNpcByName==="function")?wsNpcByName(canon):null,m=memory&&memory.npcs&&memory.npcs[canon];
  if(!n&&!m)return null;
  // Evidence must pre-date the claim itself: a summary cites the turn the death happened, and a
  // fact stamped by that same response can no more authorize it here than scene evidence can.
  var lim=(sourceTurn!=null&&Number(sourceTurn)<worldState.turn)?Number(sourceTurn):worldState.turn;
  // Gate 1 — INTRODUCTION (#143's axis, same vocabulary): the story has actually said this name.
  // A blueprint-seeded dossier (no introduction, no first encounter, no sighting) is precisely
  // what this excludes — its GM-eyes-only roster row must never become a corpse.
  var intro=(n&&n.introduced&&Number(n.introduced)<lim)||(m&&(m.firstEncounter||m.lastSeenAt));
  if(!intro)return null;
  // Gate 2 — an EXPLICIT on-screen disidentification outranks every structured fact below: if the
  // story said "the one you are looking at is NOT X", a bare named death must not slip past on
  // roster paperwork (the t1667 scholar/Mokmurian shape, arriving without its handle).
  var fs=_sceneRefFrames(),i,k;
  for(i=0;i<fs.length;i++){var ng=fs[i].negatives||[];
    for(k=0;k<ng.length;k++)if(ng[k].entity===canon&&ng[k].mode==="explicit"&&!ng[k].resolved)return null;}
  // Gate 3 — GRADED, turn-stamped presence facts (#194, panel-designed, owner-ruled 2026-08-17).
  // WITNESSED limbs first (party / speech / observed / truthful-writer records) so a witnessed
  // fact always wins the citation; the LEGACY clauses (pre-presenceEpoch stamps — the mention-fed
  // era) grandfather fail-open per ruling ③ (TENTATIVE: flipping to fail-closed, or adding a
  // fade, is deleting/editing those clauses ONLY — keep it that way), receipt-stamped via
  // _w2EvidenceGrade and surfaced in the #17 drift-health readout. Post-epoch statusTurn — the
  // mention channel that made 37 of 39 living t1903 NPCs killable by bare name — authorizes
  // NOTHING. Every limb keeps the strictly-earlier contract (fact turn < lim), and "cast"-sourced
  // records are excluded until the ruling-④ playtest validates the channel.
  _w2EvidenceGrade="witnessed";
  var epoch=(typeof worldState.presenceEpoch==="number")?worldState.presenceEpoch:0;
  if(n&&n.partyMember&&!(typeof npcIsDead==="function"&&npcIsDead(n))&&!(n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location))return "living party member at the player's side";
  var spf=_speechFactNear(canon,lim);
  if(spf)return "on screen: speech at t"+spf.turn+(spf.count>1?" (+"+(spf.count-1)+" more)":"");
  var obf=_observedFact(canon,lim);
  if(obf)return "observed on screen ("+obf.channel+") at t"+obf.firstTurn;
  var node=(typeof currentNodeKey==="function")?currentNodeKey():null;
  if(node&&m&&m.lastSeenAt&&m.lastSeenTurn!=null&&Number(m.lastSeenTurn)<lim&&typeof locSame==="function"&&locSame(m.lastSeenAt,node)&&m.lastSeenSrc!=="cast"){
    if(Number(m.lastSeenTurn)>=epoch)return "recorded at the party's current location (t"+m.lastSeenTurn+")";
    _w2EvidenceGrade="legacy";return "recorded at the party's current location (t"+m.lastSeenTurn+", legacy-grade pre-epoch)";
  }
  var gb=_w2NodeGuestbookTurn(node,canon,lim);
  if(gb){
    if(gb.turn>=epoch)return "guestbook visit recorded at t"+gb.turn;
    _w2EvidenceGrade="legacy";return "guestbook visit recorded at t"+gb.turn+" (legacy-grade pre-epoch)";
  }
  if(n&&n.statusTurn>0&&Number(n.statusTurn)<lim&&Number(n.statusTurn)<epoch){
    _w2EvidenceGrade="legacy";return "roster write at t"+n.statusTurn+" (legacy-grade, pre-epoch)";
  }
  return null;
}
/* #175b: does this handle name a ROSTERED character rather than describe an anonymous one?
   resolveNpcName carries the campaign's own alias + distinctive-token vocabulary, so "caul",
   "Caul", and "the wreck of Caul" all land on the roster row while "scholar" (nobody's name)
   stays anonymous and keeps the strict path. Returns the canonical name, or null.
   With `subject` given, the handle must name THAT victim — a handle naming someone else is a
   genuine referential conflict and must keep refusing. */
/* ═══ #193 (v1.672): the self-naming DISCRIMINATOR — a descriptor is not a name ═══════════════
   The death seams' "does this operand NAME a character?" check rode resolveNpcName's token-subset
   consolidation, which cannot tell a name from a common noun or title (entry-17 brief D probes:
   "the caul of mist" → Caul; "Brother of the Ashen Order" → Brother Caul; "Caul Vex" → Caul
   rather than Caulder Vex). This discriminator serves ONLY the irreversible death paths — the
   [NPC:] consolidation itself (which heals "Morwen"/"Morwen Zethran" forks) is untouched.
   Rules, adjudicated against the probe table:
   R0  exact token-set equality (case-insensitive, separator-normalized) → accept. Plain names,
       #201's Golvak_Stonegall, and every ordinary death stay exactly as before.
   RA  a PARTIAL match requires ≥1 DISTINCTIVE candidate token (the W2_TITLE_STOPSET removed)
       present in the raw operand AND capitalized there — "the wreck of Caul" accepts (review-
       affirmed desirable), "the caul of mist" rejects (common noun), "Brother of the Ashen
       Order" rejects (the given name is absent).
   RB  multiple survivors score by coverage of the raw's capitalized tokens with ≥4-char prefix
       credit — "Caul Vex" scores Caulder Vex (1 exact + 0.5 prefix) over Caul (1); a TIE is
       ambiguity and returns null (the brake is INPUT-shaped now, not roster-shaped).
   Known residual (documented, accepted): RA leans on the GM's case fidelity — an all-title-case
   descriptor ("The Caul Of Mist") would pass RA; the probes came from real GM output, which
   cases common nouns naturally. Callers must REFUSE on null/mismatch, never redirect — the
   entry-17 wrong-victim lesson. */
var W2_TITLE_STOPSET={brother:1,sister:1,father:1,mother:1,lord:1,lady:1,sir:1,dame:1,master:1,mistress:1,captain:1,sheriff:1,king:1,queen:1,prince:1,princess:1,elder:1,saint:1,the:1,of:1,order:1,guild:1,house:1};
function _w2RawTokens(s){var out=[],m,re=/[A-Za-z]+/g,str=String(s||"");while((m=re.exec(str)))out.push({t:m[0].toLowerCase(),cap:/[A-Z]/.test(m[0].charAt(0))});return out;}
function w2SelfNamingCanon(raw){
  var rt=_w2RawTokens(raw);if(!rt.length)return null;
  var rset={},i;for(i=0;i<rt.length;i++)rset[rt[i].t]=rt[i].cap||rset[rt[i].t]||false;
  var names={},k;
  if(worldState&&worldState.npcs)for(i=0;i<worldState.npcs.length;i++)names[worldState.npcs[i].name]=1;
  if(typeof memory!=="undefined"&&memory&&memory.npcs)for(k in memory.npcs){names[k]=1;
    var _al=memory.npcs[k].aliases;if(_al)for(i=0;i<_al.length;i++)names[_al[i]]=1;/* #193: long-form aliases are candidates too — they resolve to their canonical, and the tie-forgiveness clause treats an alias and its owner as ONE claim */}
  var best=null,bestScore=0,tied=false;
  for(k in names){
    var ct=_w2RawTokens(k),cset={},j;for(j=0;j<ct.length;j++)cset[ct[j].t]=1;
    /* R0: exact set equality */
    var exact=ct.length===rt.length;
    if(exact){for(j=0;j<ct.length;j++)if(!(ct[j].t in rset)){exact=false;break;}}
    if(exact)return resolveNpcName(k);
    /* RA: a distinctive PERSONAL token, present AND capitalized in the raw. Distinctive tokens
       come from the candidate's personal-name SEGMENT — everything before the first genitive
       'of' ("Brother Caul | of the Ashen Order" → {caul}); a stopset alone cannot know that
       'Ashen' names the order rather than the person, but the structure can. A candidate whose
       pre-'of' segment yields nothing (e.g. "The Collector") falls back to its full token set. */
    var seg=[],hitOf=false;
    for(j=0;j<ct.length;j++){if(ct[j].t==="of"){hitOf=true;break;}seg.push(ct[j]);}
    var pool=[];
    for(j=0;j<seg.length;j++)if(!W2_TITLE_STOPSET[seg[j].t])pool.push(seg[j].t);
    if(!pool.length){for(j=0;j<ct.length;j++)if(!W2_TITLE_STOPSET[ct[j].t])pool.push(ct[j].t);}
    /* RA is PRESENCE-only; capitalization is enforced in exactly ONE place — RB's scoring over
       the raw's capitalized tokens (single point of truth, else the property is doubly encoded
       and no single mutation can prove either copy — the first #193 battery caught exactly that). */
    var distinctiveHit=false;
    for(j=0;j<pool.length;j++)if(pool[j] in rset){distinctiveHit=true;break;}
    if(!distinctiveHit)continue;
    /* RB: score = coverage of the raw's CAPITALIZED tokens (exact 1, >=4-char prefix 0.5) */
    var score=0;
    for(i=0;i<rt.length;i++){if(!rt[i].cap)continue;
      if(rt[i].t in cset){score+=1;continue;}
      for(j=0;j<ct.length;j++)if(rt[i].t.length>=4&&ct[j].t.indexOf(rt[i].t)===0){score+=0.5;break;}}
    if(score<=0)continue;
    if(score>bestScore){best=k;bestScore=score;tied=false;}
    else if(score===bestScore&&resolveNpcName(k)!==resolveNpcName(best))tied=true;
  }
  if(!best||tied)return null;
  return resolveNpcName(best);
}
function _w2HandleNamesSubject(handle,subject){
  var h=String(handle||"").trim();if(!h||h==="-")return null;
  /* #193 (v1.672): the discriminator replaces the fuzzy _whnsResolve chain on this path — its R0
     exact-set rule subsumes #201's separator retry (Golvak_Stonegall tokenizes identically), and
     its RA/RB rules stop descriptors and titles from self-naming a rostered victim. Only roster/
     memory names can be returned, so the old both-stores existence check is structural now. */
  var canon=(typeof w2SelfNamingCanon==="function")?w2SelfNamingCanon(h):null;
  if(!canon)return null;
  if(subject&&canon!==subject)return null;
  return canon;
}
function _w2NodeGuestbookTurn(node,canon,lim){
  /* #194: returns {turn} for the best pre-lim visit turn, skipping cast-sourced stamps (ruling
     ④'s playtest gate). Aggregate-folded turns (pre-cap history, overwhelmingly pre-epoch) keep
     their fallback — their grade derives from the turn value like everything else. */
  if(!node||!memory||!memory.map||!memory.map.nodes)return null;
  var rec=memory.map.nodes[node]||memory.map.nodes[(typeof locResolve==="function")?locResolve(node):node];
  var gb=rec&&rec.guestbook&&rec.guestbook[canon];if(!gb)return null;
  var ts=gb.turns||[],best=null,i;
  for(i=0;i<ts.length;i++){
    if(lim!=null&&ts[i]>=lim)continue;
    if(gb.by&&gb.by[ts[i]]==="cast")continue;
    if(best==null||ts[i]>best)best=ts[i];
  }
  if(best==null&&gb.agg&&gb.agg.last!=null&&(lim==null||gb.agg.last<lim))best=gb.agg.last;
  return best!=null?{turn:best}:null;
}
/* #194 L3: THE VALVE — a refused named death must terminate in a decision, never loop. Arms the
   one-record fork-note ping (buildDeathEvidenceNudge, api.js): "if they are here, put them on
   the record ([SAY:]/[SCENE_CAST:]) and re-emit; if the death happened elsewhere, emit
   [NPC_DEATH_REPORTED:]". Capped per subject at DEATH_EVIDENCE_NOTES deliveries, after which the
   standing conflict machinery (nudge → stale shelf) owns the dispute as before. */
function _w2ArmDeathValve(name,regrant){
  if(!worldState||!name)return;
  var rec=worldState.deathEvidenceNudged&&worldState.deathEvidenceNudged[name];
  if(rec&&rec.count>=DEATH_EVIDENCE_NOTES){
    if(!regrant)return;
    rec.count=DEATH_EVIDENCE_NOTES-1;/* #201: a failed reveal re-grants exactly ONE delivery */
  }
  worldState.deathEvidencePing={name:name,turn:worldState.turn};
}
function _w2Conflict(subject,handle,reason){
  if(!worldState)return null;if(!worldState.identityConflicts)worldState.identityConflicts=[];var s=String(subject||"unknown"),h=String(handle||"-"),i,c;
  for(i=0;i<worldState.identityConflicts.length;i++){c=worldState.identityConflicts[i];if(!c.resolved&&c.subject===s&&w2HandleKey(c.handle)===w2HandleKey(h)){var _priorReason=c.lastReason||c.reason||"";c.lastTurn=worldState.turn;c.lastReason=reason||c.lastReason;/* #171③: c.reason keeps the FIRST, actionable cause — retries must not overwrite it with the circular id-reuse line. #201: spelling-drifted handles land on ONE record */
    if(c.stale){/* #190ⓓ (the Caul forever-loop): #175's unconditional re-arm made shelving non-terminal —
       the GM's identical retry was indistinguishable from a new incident, so 5 more deliveries and
       another shelve toast, forever. Re-arm ONLY a genuinely new presentation (different refusal
       reason), at most IDENTITY_CONFLICT_REARM_CAP times; past either bar the shelf is FINAL —
       the #17 standing-anomalies panel keeps the dispute visible, and the built-in escapes
       (canon-dead short-circuit, the SCENE_REF two-step, [NPC_DEATH_REPORTED:]) all remain open. */
      var _newPresentation=(reason||"")!==_priorReason&&(reason||"")!==(c.reason||"");
      if(_newPresentation&&(c.rearms||0)<IDENTITY_CONFLICT_REARM_CAP){c.stale=false;c.attempts=0;c.rearms=(c.rearms||0)+1;}
      else if(typeof console!=="undefined")console.warn("[identity] shelved dispute for "+s+" NOT re-armed ("+(_newPresentation?"re-arm cap reached":"identical retry")+") — shelf stands until the dispute actually resolves (#190d)");
    }return c;}}
  if(worldState.identityConflicts.filter(function(x){return !x.stale;}).length>=IDENTITY_CONFLICT_CAP){worldState.identityConflictOverflow={turn:worldState.turn,subject:s};if(typeof console!=="undefined")console.warn("[identity] conflict cap reached - existing conflicts preserved; new conflict remains fail-closed");return null;}
  /* #200: toast fatigue — surfacing scales with model stubbornness, not information. The FIRST
     conflict for a subject toasts; further records for the SAME subject (fresh handles, retries)
     go console-only. The #17 standing-anomalies panel remains the durable surface. */
  var _seen=false;for(i=0;i<worldState.identityConflicts.length;i++)if(worldState.identityConflicts[i].subject===s){_seen=true;break;}
  c={subject:s,handle:h,reason:reason||"identity evidence missing",turn:worldState.turn,lastTurn:worldState.turn,attempts:0,resolved:false};worldState.identityConflicts.push(c);if(typeof console!=="undefined")console.warn("[identity] irreversible write QUARANTINED for "+s+" (handle "+h+"): "+c.reason);if(!_seen&&typeof showToast==="function")showToast("Identity conflict: "+s+" was not changed");return c;
}
function _w2ResolveConflicts(subject,handle){var q=worldState&&worldState.identityConflicts,i;if(!q)return;for(i=0;i<q.length;i++)if(q[i].subject===subject&&(!handle||w2HandleKey(q[i].handle)===w2HandleKey(handle)))q[i].resolved=true;/* #201: a reveal under either spelling clears the record */worldState.identityConflicts=q.filter(function(c){return !c.resolved;});if(!worldState.identityConflicts.length)delete worldState.identityConflicts;}
/* (#175: w2TextTouchesConflict — the substring-over-whole-response conflict scan — is DELETED.
   Its two call sites were the permanent name-keyed blackout: it refused new envelopes whose body
   named a conflicted subject (making the nudge's own re-emit advice unfollowable) and stripped
   quest/reward tags from every response saying the name, forever. Same-response refusals key on
   refusedVictim; standing disputes key on _w2DisputedQuests — receipt-scoped, never prose-scoped.) */
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
  if(name==="SCENE_DEATH"){m=tag.match(/^\[SCENE_DEATH:([^\]]+)/);if(m)return"SCENE_DEATH:"+_w2Compact(w2HandleKey(m[1]));}/* #201: a respelled replay is the SAME operation */
  if(name==="NPC"){m=tag.match(/^\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?/);if(m)return"NPC:"+_w2Compact(resolveNpcName(m[1].trim()))+"|"+_w2Compact(m[2])+"|"+_w2Compact(m[3]);}
  if(name==="QUEST_STEP"){m=tag.match(/^\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)/);if(m)return"QUEST_STEP:"+_w2Compact(m[1])+"|"+_w2Compact(m[2])+"|"+(/^(true|done|1|yes|x)$/i.test(String(m[3]||"").trim())?"true":"false");}
  if(name==="QUEST"){m=tag.match(/^\[QUEST:([^|\]]+)\|([^|\]]*)(?:\|([^\]]*))?/);if(m)return"QUEST:"+_w2Compact(m[1])+"|"+_w2Compact(m[2])+"|"+_w2Compact(m[3]);}
  if(name==="ITEM_GAINED"){m=tag.match(/^\[ITEM_GAINED:([^\]]+)/);if(m){p=typeof _qtyParse==="function"?_qtyParse(m[1]):{base:m[1],n:1};return"ITEM_GAINED:"+_w2Compact(p.base)+"|"+(p.n||1);}}
  return String(tag||"").replace(/\s+/g," ").trim();
}
function _w2OpTokens(ops){var counts={},out=[],i,fp;for(i=0;i<(ops||[]).length;i++){fp=_w2OpFingerprint(ops[i]);counts[fp]=(counts[fp]||0)+1;out.push(fp+"#"+counts[fp]);}return out;}
function _w2TxnReceipt(m,status,reason,ops,tokens){
  if(!worldState.canonTxns)worldState.canonTxns=[];var r=_w2TxnFind(m.id),wasQuarantined=!!(r&&r.status==="quarantined"),i;if(!r){if(worldState.canonTxns.length>=CANON_TXN_CAP){worldState.canonTxnOverflow={turn:worldState.turn,id:m.id};if(typeof console!=="undefined")console.warn("[identity] canon transaction receipt cap reached - new claim refused fail-closed");return null;}r={id:m.id,claim:m.claim,subject:m.subject,evidence:m.evidence,quest:m.quest,status:status,operations:[],turn:worldState.turn,reason:reason||""};if(m.ejected&&m.ejected.length)r.ejected=m.ejected.slice();worldState.canonTxns.push(r);}
  if(m.evidenceGrade&&!r.evidenceGrade)r.evidenceGrade=m.evidenceGrade;/* #194/ruling ③: legacy-grade authorization is receipted — the evidence a later fail-closed flip would need; surfaced in #17 drift health */
  if(status==="quarantined"){if(r.status==="committed"){r.lastAttemptReason=reason||"";r.lastAttemptTurn=worldState.turn;if(typeof console!=="undefined")console.warn("[identity] refused re-attempt recorded on COMMITTED receipt "+r.id+" — committed receipts never demote (#171②)");}else{r.status="quarantined";if(!wasQuarantined){r.reason=reason||r.reason;r.quarantinedTurn=worldState.turn;}else{r.lastAttemptReason=reason||"";r.lastAttemptTurn=worldState.turn;r.attempts=(r.attempts||1)+1;}}}else if(r.status!=="quarantined"){r.status="committed";r.reason="";r.committedTurn=worldState.turn;}
  var ts=tokens||_w2OpTokens(ops);for(i=0;i<ts.length;i++)if(r.operations.indexOf(ts[i])<0)r.operations.push(ts[i]);return r;
}
function w2TxnCommit(meta,ops,tokens){return _w2TxnReceipt(meta,"committed","",ops,tokens);}
function w2TxnSummaryRetire(){
  /* #168R3 (entry-13 review): committed receipts exist only to absorb model replays, and a replay can only
     come from context the model still sees — after a structured summary lands, receipts older than the
     retained tail are inert. Retiring them (quarantined receipts NEVER retire; poisoning is a contract)
     frees capacity and clears the overflow latch, so the envelope mechanism survives a campaign's whole
     life instead of dying permanently at receipt 24. */
  if(!worldState||!worldState.canonTxns)return;
  var keep=[],i,r,horizon=worldState.turn-CANON_TXN_RETIRE_TURNS;
  for(i=0;i<worldState.canonTxns.length;i++){r=worldState.canonTxns[i];if(r.status==="quarantined"||(r.committedTurn!=null?r.committedTurn:r.turn)>=horizon)keep.push(r);}
  if(keep.length<worldState.canonTxns.length)worldState.canonTxns=keep;
  if(worldState.canonTxnOverflow&&worldState.canonTxns.length<CANON_TXN_CAP){delete worldState.canonTxnOverflow;if(typeof console!=="undefined")console.warn("[identity] canon receipt capacity recovered after structured summary (#168R3)");}
}
function w2TxnQuarantine(meta,reason,ops,tokens){
  /* #200: the FIRST refusal for a claim/subject is player-visible the moment it happens (#175);
     a poisoned-id replay or the Nth fresh envelope for the SAME disputed subject is model
     stubbornness, not information — those go console-only. The #17 panel stays the durable surface. */
  var _priorRct=(typeof _w2TxnFind==="function")&&meta.id?_w2TxnFind(meta.id):null;
  var _subjSeen=false,_qi,_qc=worldState&&worldState.identityConflicts||[];
  if(meta.subject&&meta.subject!=="-")for(_qi=0;_qi<_qc.length;_qi++)if(_qc[_qi].subject===resolveNpcName(meta.subject)||_qc[_qi].subject===meta.subject){_subjSeen=true;break;}
  if(meta.subject&&meta.subject!=="-")_w2Conflict(meta.subject,meta.evidence,reason);else if(typeof console!=="undefined")console.warn("[identity] canon transaction "+(meta.id||"?")+" QUARANTINED: "+reason);
  if(_priorRct||_subjSeen){if(typeof console!=="undefined")console.warn("[identity] canon claim "+(meta.id||"?")+" refused again ("+reason+") — toast suppressed, repeat of a standing dispute (#200)");}
  else if(typeof showToast==="function")showToast("⚠ Canon claim "+(meta.id||"?")+" refused — its quest/reward tags were withheld ("+reason+")");
  return _w2TxnReceipt(meta,"quarantined",reason,ops,tokens);}
function _w2Tags(text){return String(text||"").match(/\[[A-Z][A-Z_]{1,}:[^\]]+\]/g)||[];}
function _w2TagName(tag){var m=tag.match(/^\[([A-Z][A-Z_]{1,}):/);return m?m[1]:"";}
function _w2DeathStatusTag(tag){var m=tag.match(/^\[NPC:([^|\]]+)\|([^|\]]*)/);return m&&npcDeadStatus(m[2])?m:null;}
function _w2QuestExists(title){var q=worldState.questLog||[],i;for(i=0;i<q.length;i++)if(String(q[i].title).toLowerCase()===String(title).toLowerCase()&&q[i].status!=="offered")return true;return false;}
function _w2StripRewards(text){return text.replace(/\[XP:[^\]]+\]/g,"").replace(/\[GOLD:[^\]]+\]/g,"").replace(/\[ITEM_GAINED:[^\]]+\]/g,"");}
/* P2 (workdone_sol_review): REFUSAL PROVENANCE. Every guard that strips or quarantines an
   operation records the VERBATIM tags here; the tagLog entry for the response carries them as
   `refused:[…]`. This exists because the t1760 payoff's amounts were destroyed before any log saw
   them — the repair had to refuse to invent numbers the engine itself had thrown away. Reset per
   w2PrepareResponse call (= per response); read once by the tagLog writer. */
var _w2RefusedNow=[];
/* ── #213: the refusal the player can act on ─────────────────────────────────────
   Owner ruling 2026-08-22: the two withhold toasts SHIP — they signal a bug the player is
   actively suffering (XP/gold they watched narrated, then denied). Every refusal already knew
   why; the reason rode into worldState.identityConflicts and the console and stopped there, so
   the player got "an unresolved identity dispute" and no way to read it.

   ONE ordered table turns an engine reason into a player sentence. The technical string is
   untouched on the record, in the console, and in the GM nudge — this is a DISPLAY layer, never
   an input to a parser or a prompt. A reason with no entry degrades to a plain fallback rather
   than leaking internals, and the REFUSAL COPY CONTRACT (dev/run-tests.js) fails the build when a
   shipped reason has no copy, so "add a refusal" and "add its player sentence" land together. */
/* Every refusal reason that can reach a player-facing withhold, listed BESIDE the copy table
   on purpose: adding a refusal means adding its line here, and the REFUSAL COPY CONTRACT
   (dev/run-tests.js) fails the build when a listed reason falls through to the generic
   fallback or when identity.js passes _w2Conflict a reason this list does not carry. */
var W2_REFUSAL_REASONS=[
  "named death has no prior positive scene binding",
  "registered combat foe lacks a prior positive scene binding",
  "death names no observed handle",
  "scene evidence does not bind the claimed victim",
  "summary death lacks matching scene-handle evidence",
  "the scene-evidence overflow latch is armed — identity writes fail closed until a structured summary runs",
  "death operand is descriptor-shaped or ambiguous — it does not NAME the victim",
  "scene handle already binds to ",
  "scene handle rebound to ",
  "scene handle lost its subject binding before execution",
  "reveal conflicts with established binding to ",
  "death operation names a different NPC than the transaction subject",
  "death operation names a different scene handle",
  "reveal names no active observed handle (attempted: ",
  "scene death was emitted outside a canon transaction",
  "unmatched transaction marker",
  "malformed or mismatched transaction envelope",
  "new npc-death claim carries no death operation",
  "canon transaction receipt capacity is exhausted",
  "claim id was already quarantined",
  "claim id was reused with different metadata",
  "operation touches an unresolved identity conflict",
  "summary death cites a quarantined transaction",
  "summary death lacks a source turn",
  "uncited legacy npcDeaths entry cannot mint a new corpse",
  "death-like chapter claim has no cited npcDeaths evidence",
  "death outcome names no active accepted quest",
  "quest outcome must not claim an NPC identity",
  "identity evidence missing"
];
var W2_REFUSAL_FALLBACK="the GM's account of that scene did not add up";
var W2_REFUSAL_COPY=[
  {match:/overflow latch|fail closed until a structured summary/i,
   copy:"the engine ran out of room to keep track of who was on screen"},
  {match:/receipt capacity is exhausted/i,
   copy:"the engine ran out of room to record this scene's changes"},
  {match:/descriptor-shaped|does not NAME the victim/i,
   copy:"the GM never said plainly who died"},
  /* Order matters below: "names no ACTIVE observed handle" is an unmasking, not a missing
     witness, so it has to be tested before the broader no-binding clause. */
  {match:/names no active observed handle|reveal conflicts with established binding/i,
   copy:"the GM unmasked a face nobody in the scene was wearing"},
  {match:/prior positive scene binding|does not bind the claimed victim|names no observed handle|lacks matching scene-handle evidence/i,
   copy:"the GM killed someone the scene never showed was there"},
  {match:/already binds to|rebound to|lost its subject binding|names a different NPC than the transaction subject|names a different scene handle|is not the transaction subject/i,
   copy:"the GM used one name for two different characters"},
  {match:/lacks a source turn|cannot mint a new corpse|no cited npcDeaths evidence/i,
   copy:"the recap claimed a death the scene itself never recorded"},
  {match:/already quarantined|touches an unresolved identity conflict|cites a quarantined transaction/i,
   copy:"an earlier mix-up about this character was never sorted out"},
  {match:/names no active accepted quest/i,
   copy:"the reward was tied to a quest you never took on"},
  {match:/must not claim an NPC identity/i,
   copy:"the GM tangled a quest result up with a character's fate"},
  {match:/outside a canon transaction|unmatched transaction marker|mismatched transaction envelope|carries no death operation|handler failed|reused with different metadata/i,
   copy:"the GM's record of that death was malformed"},
  {match:/identity evidence missing/i,
   copy:"the GM gave no sign of who this actually was"}
];
var W2_REWARD_RES=[/\[XP:[^\]]+\]/g,/\[GOLD:[^\]]+\]/g,/\[ITEM_GAINED:[^\]]+\]/g];
function w2RefusalCopy(reason){
  var s=String(reason||""),i;
  for(i=0;i<W2_REFUSAL_COPY.length;i++)if(W2_REFUSAL_COPY[i].match.test(s))return W2_REFUSAL_COPY[i].copy;
  return W2_REFUSAL_FALLBACK;
}
/* Pure: raw withheld tag tokens → one player-readable phrase ("600 XP, 100 gold, Giantbane"). */
function w2WithheldSummary(list){
  if(!list||!list.length)return "";
  var out=[],i,m,t;
  for(i=0;i<list.length;i++){
    t=String(list[i]);
    if((m=t.match(/^\[XP:\s*\+?(-?\d+)/i)))out.push(m[1]+" XP");
    else if((m=t.match(/^\[GOLD:\s*\+?(-?\d+)/i)))out.push(m[1]+" gold");
    else if((m=t.match(/^\[ITEM_GAINED:\s*([^\]|]+)/i)))out.push(m[1].trim());
  }
  return out.join(", ");
}
/* The receipt of what a dispute COST. Additive, bounded, deduped — the honest-status half:
   without it the shelve notice could not tell "this cost you 600 XP" from "this cost nothing",
   and guessing either way is a lie in one direction. */
function _w2StampWithheld(c,tokens){
  if(!c||!tokens||!tokens.length)return;
  if(!c.withheld)c.withheld=[];
  var i;for(i=0;i<tokens.length;i++){
    var t=String(tokens[i]);
    if(c.withheld.indexOf(t)<0&&c.withheld.length<W2_WITHHELD_CAP)c.withheld.push(t);
  }
}
function _w2RefuseLog(tags){if(!tags)return;if(typeof tags==="string")tags=[tags];var i;for(i=0;i<tags.length;i++)if(tags[i])_w2RefusedNow.push(String(tags[i]));}
function w2RefusedThisResponse(){return _w2RefusedNow;}
function _w2CollectStripped(text,res){var out=[],i,m;for(i=0;i<res.length;i++){m=text.match(res[i]);if(m)out=out.concat(m);}return out;}
/* #175 (field, t1742): the whitelist-refusal became the defect. A boss killed in combat naturally
   emits [COMBAT_END:victory] beside its death, and "unsupported operation" then voided the death,
   2200 XP, 1500 gp and the quest completion TOGETHER — the exact atomicity built to protect canon
   destroyed it. The allow-list now PARTITIONS instead of refusing: ops it does not govern are
   EJECTED back to the ordinary stream, where every ordinary guard still rules them (a merge stays
   proposal-first, a bare death still needs scene authority). The envelope's atomic claim = the
   governed residue. The ONE thing that still refuses the whole envelope is confused CLAIM
   SUBSTANCE — a death op naming a different NPC than the subject, or a SCENE_DEATH naming a
   different handle — because ejecting a confused death would let it apply on ordinary authority,
   and a wrong-corpse write is precisely what W2 exists to fail closed (pinned by the
   cross-subject test). Non-death NPC writes and other-quest completions eject like any incidental
   tag: outside the envelope they are ordinary, guarded upserts. */
function _w2TxnPartition(meta,ops){
  var allowed=meta.claim==="npc-death"?{SCENE_DEATH:1,NPC:1,QUEST_STEP:1,QUEST:1,XP:1,GOLD:1,ITEM_GAINED:1}:{QUEST_STEP:1,QUEST:1,XP:1,GOLD:1,ITEM_GAINED:1},i,name,m,title,gov=[],eject=[];
  if(meta.claim==="quest-outcome"&&(meta.subject!=="-"||meta.evidence!=="-"))return{reason:"quest outcome must not claim an NPC identity"};
  for(i=0;i<ops.length;i++){
    name=_w2TagName(ops[i]);
    if(!allowed[name]){eject.push(ops[i]);continue;}
    if(name==="NPC"){m=_w2DeathStatusTag(ops[i]);if(!m){eject.push(ops[i]);continue;}if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject))return{reason:"death operation names a different NPC than the transaction subject"};}
    if(name==="SCENE_DEATH"){m=ops[i].match(/^\[SCENE_DEATH:([^\]]+)\]/);if(!m||w2HandleKey(m[1])!==w2HandleKey(meta.evidence))return{reason:"death operation names a different scene handle"};}/* #201: separator/case drift is rendering, not identity */
    if(name==="QUEST"||name==="QUEST_STEP"){m=ops[i].match(name==="QUEST"?/^\[QUEST:([^|\]]+)/:/^\[QUEST_STEP:([^|\]]+)/);title=m?m[1].trim():"";if(meta.quest==="-"||_w2Compact(title)!==_w2Compact(meta.quest)){eject.push(ops[i]);continue;}}
    gov.push(ops[i]);
  }
  return{gov:gov,eject:eject};
}
/* #175: an NPC already dead in BOTH-store canon needs no fresh scene evidence to have that death
   RE-ASSERTED — the envelope is closing bookkeeping on an established fact (the t1742 shape: the
   kill was stamped at t1648; the envelope existed to pay it out and close the quest). Life/death
   state does not change; only the credit does. A LIVING subject keeps the full evidence rules. */
function _w2SubjectDeadInCanon(subject){
  if(!subject||subject==="-")return false;
  var nm=resolveNpcName(String(subject).trim());
  var ws=(typeof wsNpcByName==="function")?wsNpcByName(nm):null;
  var mm=(typeof memory!=="undefined"&&memory&&memory.npcs)?memory.npcs[nm]:null;
  return !!((ws&&typeof npcIsDead==="function"&&npcIsDead(ws))||(mm&&mm.dead));
}
/* #204 (the t2049 Face-Stealer four-toast turn): a stray bare death whose REAL operation already
   SUCCEEDED — a committed npc-death receipt from THIS response (same evidence handle or same
   subject), or a subject the response's own combat close / earlier canon already stamped dead —
   is DUPLICATE HYGIENE, not a dispute. It strips with a console line only: no toast, no conflict
   record (which would only self-resolve instantly), and it must never arm the co-emission
   withhold. An OLD committed receipt never launders a fresh stray — this-turn receipts only. */
function _w2StrayDeathIsDuplicate(subject,handle){
  var subj=subject;
  if(!subj){var sn=resolveNpcName(String(handle||"").trim());var sw=(typeof wsNpcByName==="function")?wsNpcByName(sn):null;if(sw)subj=sn;}
  if(subj&&_w2SubjectDeadInCanon(subj))return true;
  var hk=w2HandleKey(handle),a=worldState&&worldState.canonTxns||[],i,r;
  for(i=0;i<a.length;i++){r=a[i];
    if(r.status!=="committed"||r.claim!=="npc-death")continue;
    if((r.committedTurn!=null?r.committedTurn:r.turn)!==worldState.turn)continue;
    if(r.evidence&&r.evidence!=="-"&&w2HandleKey(r.evidence)===hk)return true;
    if(subj&&r.subject&&r.subject!=="-"&&resolveNpcName(r.subject)===subj)return true;
  }
  return false;
}
/* #175: the quests whose payout is under an OPEN dispute — unresolved, non-stale conflicts whose
   subject owns a quarantined receipt naming a quest. Used to scope the ordinary-stream strip to
   exactly the disputed titles instead of blacking out every response that says the subject's name. */
function _w2DisputedQuests(){
  var out=[],q=worldState&&worldState.identityConflicts||[],rs=worldState&&worldState.canonTxns||[],i,j;
  for(i=0;i<q.length;i++){
    if(q[i].resolved||q[i].stale||q[i].subject==="unknown")continue;
    for(j=0;j<rs.length;j++)if(rs[j].status==="quarantined"&&rs[j].quest&&rs[j].quest!=="-"&&_w2Compact(rs[j].subject)===_w2Compact(q[i].subject))out.push(_w2Compact(rs[j].quest));
  }
  return out;
}
function w2PrepareResponse(text){
  text=String(text||"");var hasW2=/\[(?:SCENE_REF|SCENE_NOT|SCENE_REVEAL|SCENE_DEATH|CANON_TXN_BEGIN|CANON_TXN_END):/.test(text);if(hasW2)sceneRefsEnsure();
  _w2RefusedNow=[];/* P2: fresh provenance per response */
  var ordinary=text,txns=[],planned={},re=/\[CANON_TXN_BEGIN:([^\]]+)\]([\s\S]*?)\[CANON_TXN_END:([^\]]+)\]/g,m;
  while((m=re.exec(text))){
    ordinary=ordinary.replace(m[0],"");var p=m[1].split("|"),meta={id:(p[0]||"").trim(),claim:(p[1]||"").trim(),subject:(p[2]||"").trim(),evidence:(p[3]||"").trim(),quest:(p[4]||"").trim()},ops=_w2Tags(m[2]),reason="",existing=_w2TxnFind(meta.id),prior=planned[meta.id]||existing,i;
    if(p.length!==5||!meta.id||m[3].trim()!==meta.id)reason="malformed or mismatched transaction envelope";else if(meta.claim!=="npc-death"&&meta.claim!=="quest-outcome")reason="unsupported canon claim type";else if(prior&&prior.status==="quarantined")reason="claim id was already quarantined";else if(prior&&!_w2TxnMetaSame(prior,meta))reason="claim id was reused with different metadata";
    var _part=null;
    if(!reason){_part=_w2TxnPartition(meta,ops);if(_part.reason)reason=_part.reason;else{ops=_part.gov;if(_part.eject.length){ordinary+="\n"+_part.eject.join("");meta.ejected=_part.eject.map(_w2TagName);if(typeof console!=="undefined")console.warn("[identity] "+_part.eject.length+" incidental tag(s) ejected from canon claim "+meta.id+" and applied as ordinary tags: "+meta.ejected.join(", ")+" (#175 — one stray tag must never void a death and its rewards)");}}}
    if(!reason&&meta.claim==="npc-death"&&!prior){var hasDeath=false,deathHandle="",j;for(j=0;j<ops.length;j++){var sd=ops[j].match(/^\[SCENE_DEATH:([^\]]+)\]/),nd=_w2DeathStatusTag(ops[j]);if(sd){hasDeath=true;deathHandle=sd[1].trim();}if(nd)hasDeath=true;}if(!hasDeath)reason="new npc-death claim carries no death operation";else if(deathHandle&&w2HandleKey(deathHandle)!==w2HandleKey(meta.evidence))reason="death operation names a different scene handle";else if(!_w2SubjectDeadInCanon(meta.subject)&&!w2DeathAuthorized(meta.subject,meta.evidence)){var _veOv=!!(worldState.sceneRefs&&worldState.sceneRefs.overflow);reason=_veOv?"the scene-evidence overflow latch is armed — identity writes fail closed until a structured summary runs":"scene evidence does not bind the claimed victim";if(!_veOv&&meta.subject&&meta.subject!=="-")_w2ArmDeathValve(resolveNpcName(meta.subject));/* #194 L3: an evidence-lack refusal arms the fork note; a capacity refusal must not (its cure is a summary, not ceremony) */}else if(_w2EvidenceGrade==="legacy")meta.evidenceGrade="legacy";/* #194/ruling ③: legacy fail-open passes are receipt-stamped so a later reversal has its evidence */}
    if(!reason&&meta.claim==="quest-outcome"&&!_w2QuestExists(meta.quest))reason="quest outcome names no active accepted quest";
    if(!reason&&!prior&&meta.claim==="npc-death"&&meta.quest!=="-"&&!_w2QuestExists(meta.quest))reason="death outcome names no active accepted quest";
    /* #175: the "operation touches an unresolved identity conflict" refusal is DELETED. It blocked
       any new envelope whose body named a conflicted subject — which a corrective re-emission
       necessarily does — so the nudge's own advice ("re-emit with a NEW id") was unfollowable by
       construction and the t1742 conflict fired 14 times with no possible answer. The evidence
       checks above are the real guard; a valid commit now RESOLVES the subject's conflict (the heal,
       applied at the commit site in api.js). */
    if(worldState.canonTxnOverflow&&!prior)reason="canon transaction receipt capacity is exhausted";
    if(reason){_w2RefuseLog(ops);/* P2: the envelope ops survive the refusal verbatim */w2TxnQuarantine(meta,reason,ops);for(i=0;i<txns.length;i++)if(txns[i].meta.id===meta.id){txns[i].body="";txns[i].ops=[];txns[i].valid=false;txns[i].reason=reason;}txns.push({meta:meta,body:"",ops:ops,valid:false,reason:reason});continue;}
    var fresh=[],freshTokens=[],seen=prior&&prior.operations?prior.operations.slice():[],allTokens=_w2OpTokens(ops);for(i=0;i<ops.length;i++){var fp=_w2OpFingerprint(ops[i]),tok=allTokens[i];if(seen.indexOf(tok)<0&&seen.indexOf(fp)<0&&seen.indexOf(ops[i])<0){fresh.push(ops[i]);freshTokens.push(tok);seen.push(tok);}}
    if(!planned[meta.id])planned[meta.id]={id:meta.id,claim:meta.claim,subject:meta.subject,evidence:meta.evidence,quest:meta.quest,status:"planned",operations:seen};else planned[meta.id].operations=seen;txns.push({meta:meta,body:fresh.join(""),ops:fresh,tokens:freshTokens,valid:true});
  }
  if(/\[CANON_TXN_(?:BEGIN|END):/.test(ordinary)){/* #171①: the whole-response fail-closed strip stays, but it is no longer silent, receipt-less, or id-reusable */var _orph=ordinary.match(/\[CANON_TXN_(?:BEGIN|END):[^\]|]+/g)||[],_oi;for(_oi=0;_oi<_orph.length;_oi++){var _oid=_orph[_oi].replace(/^\[CANON_TXN_(?:BEGIN|END):/,"").trim();if(_oid&&!_w2TxnFind(_oid))w2TxnQuarantine({id:_oid,claim:"npc-death",subject:"-",evidence:"-",quest:"-"},"unmatched transaction marker",[]);}_w2RefuseLog(_w2CollectStripped(ordinary,[/\[XP:[^\]]+\]/g,/\[GOLD:[^\]]+\]/g,/\[ITEM_GAINED:[^\]]+\]/g,/\[QUEST(?:_STEP)?:[^\]]+\]/g,/\[SCENE_DEATH:[^\]]+\]/g,/\[NPC:[^\]]+\]/g]));ordinary=ordinary.replace(/\[CANON_TXN_(?:BEGIN|END):[^\]]+\]/g,"");ordinary=_w2StripRewards(ordinary).replace(/\[QUEST(?:_STEP)?:[^\]]+\]/g,"").replace(/\[SCENE_DEATH:[^\]]+\]/g,"").replace(/\[NPC:[^\]]+\]/g,"");if(typeof console!=="undefined")console.warn("[identity] unmatched canon transaction marker - identity/quest/reward operations refused");if(typeof showToast==="function")showToast("⚠ Malformed canon envelope — its identity/quest/reward tags were withheld");}
  var bareDeaths=ordinary.match(/\[SCENE_DEATH:([^\]]+)\]/g)||[],bd,refusedVictim=null,refusedReason="",refusedConflict=null;/* #213: the victim alone could not explain itself — carry the CAUSE and its record to the withhold toast */for(bd=0;bd<bareDeaths.length;bd++){var bm=bareDeaths[bd].match(/\[SCENE_DEATH:([^\]]+)\]/),bh=bm[1].trim(),ba=_sceneRefActor(bh);
    /* #204: a stray echo of an operation that already SUCCEEDED (committed envelope this response,
       or subject already dead in canon) strips silently — no toast, no conflict, no withhold arm. */
    if(_w2StrayDeathIsDuplicate(ba&&ba.actor.entity?ba.actor.entity:null,bh)){_w2RefuseLog(bareDeaths[bd]);ordinary=ordinary.replace(bareDeaths[bd],"");if(typeof console!=="undefined")console.warn("[identity] stray [SCENE_DEATH:"+bh+"] duplicates an operation that already succeeded — stripped as hygiene, no dispute (#204)");continue;}
    _w2RefuseLog(bareDeaths[bd]);ordinary=ordinary.replace(bareDeaths[bd],"");var _bdC=_w2Conflict(ba&&ba.actor.entity?ba.actor.entity:"unknown",bh,"scene death was emitted outside a canon transaction");if(!refusedVictim){refusedReason="scene death was emitted outside a canon transaction";refusedConflict=_bdC;}refusedVictim=refusedVictim||(ba&&ba.actor.entity)||"unknown";}
  var npcTags=ordinary.match(/\[NPC:[^\]]+\]/g)||[],n;for(n=0;n<npcTags.length;n++){var dm=_w2DeathStatusTag(npcTags[n]);if(!dm)continue;var nm=resolveNpcName(dm[1].trim()),ws=(typeof wsNpcByName==="function")?wsNpcByName(nm):null;
    /* #193 (v1.672): the operand must NAME the victim before the death gate even evaluates —
       "the caul of mist" fuzzy-resolves to Caul via the consolidation, but a common noun or a
       bare title is not a death warrant. Disagreement REFUSES, never redirects (a discriminator
       that picked a different victim than the consolidation is the entry-17 wrong-victim shape). */
    if(worldState.sceneRefs&&!npcIsDead(ws)&&typeof w2SelfNamingCanon==="function"&&w2SelfNamingCanon(dm[1].trim())!==nm){
      _w2RefuseLog(npcTags[n]);ordinary=ordinary.replace(npcTags[n],"");
      var _dsC=_w2Conflict(nm,"-","death operand is descriptor-shaped or ambiguous — it does not NAME the victim");
      if(!refusedVictim){refusedReason="death operand is descriptor-shaped or ambiguous — it does not NAME the victim";refusedConflict=_dsC;}
      _w2ArmDeathValve(nm);refusedVictim=refusedVictim||nm;continue;}
    if(worldState.sceneRefs&&!npcIsDead(ws)&&!w2DeathAuthorized(nm,null)){_w2RefuseLog(npcTags[n]);ordinary=ordinary.replace(npcTags[n],"");/* #175bR: name the ACTUAL cause — under the overflow latch the refusal is capacity, not evidence, and the old text sent the GM chasing scene ceremony that could not help */var _bdOv=!!(worldState.sceneRefs&&worldState.sceneRefs.overflow),_bdR=_bdOv?"the scene-evidence overflow latch is armed — identity writes fail closed until a structured summary runs":"named death has no prior positive scene binding",_bdC2=_w2Conflict(nm,"-",_bdR);if(!refusedVictim){refusedReason=_bdR;refusedConflict=_bdC2;}if(!_bdOv)_w2ArmDeathValve(nm);/* #194 L3 */refusedVictim=refusedVictim||nm;}}
  /* #168R1 (entry-13 review), rescoped by #175: a death REFUSED in THIS response still de-authorizes
     its co-emitted quest/reward consequences — that protection is unchanged and pinned. What is GONE
     is the standing-conflict reach: the old gate substring-matched every unresolved conflict's
     subject against the whole response forever, so one unresolvable conflict became a permanent
     name-keyed blackout — at t1782 it destroyed an UNRELATED quest's completion (Whispers of
     Jorgenfist) plus 400 XP and 200 gp because the prose said "Mokmurian". A standing dispute now
     strips ONLY the disputed quest's own completion tags (looked up via the quarantined receipt),
     and rewards flow. */
  if(refusedVictim&&(/\[QUEST_STEP:[^\]]+\|(?:true|done|1|yes|x)\]/i.test(ordinary)||/\[QUEST:[^|\]]+\|(?:completed?|done|finished|failed)/i.test(ordinary))){/* #213: collect BEFORE the strip — these tokens are the player-facing receipt of what the
       refusal cost, and _w2StripRewards makes them unrecoverable. */
    var _waTok=_w2CollectStripped(ordinary,W2_REWARD_RES);
    ordinary=ordinary.replace(/\[QUEST_STEP:[^\]]+\]/g,"").replace(/\[QUEST:[^\]]+\]/g,"");
    _w2RefuseLog(_waTok);ordinary=_w2StripRewards(ordinary);
    _w2StampWithheld(refusedConflict,_waTok);var _waSum=w2WithheldSummary(_waTok);
    if(typeof console!=="undefined")console.warn("[identity] quest/reward consequence refused - response carries a just-refused victim "+refusedVictim+" ("+(refusedReason||"cause unrecorded")+")");
    if(typeof showToast==="function")showToast("⚠ "+(_waSum?_waSum+" withheld":"Reward withheld")+" — "+w2RefusalCopy(refusedReason)+" ("+refusedVictim+"). Asking the GM to put it right.",8000);}
  else{
    /* Standing disputes key on the TAG PAYLOAD, never the prose: a completion tag whose own text
       names a disputed subject (or whose title matches a quarantined receipt's quest) is withheld,
       and — the pinned laundering rule — its co-emitted rewards with it. Everything else lands:
       at t1782 this lets [QUEST:Whispers of Jorgenfist|completed] commit while the disputed
       [QUEST:Mokmurian's Army|completed] waits for the heal. The withhold is TEMPORARY by
       construction now: a valid re-emission resolves the conflict, and an unanswered one goes
       stale after IDENTITY_CONFLICT_STALE_ATTEMPTS deliveries. */
    var _dq=_w2DisputedQuests(),_dSubs=[],_ci;
    for(_ci=0;_ci<(worldState.identityConflicts||[]).length;_ci++){var _cc=worldState.identityConflicts[_ci];if(!_cc.resolved&&!_cc.stale&&_cc.subject&&_cc.subject!=="unknown")_dSubs.push(_cc.subject);}
    if(_dq.length||_dSubs.length){
      var _dqStripped=[];
      /* #213: remember WHICH dispute struck, so the toast can name its cause instead of the
         category. Both limbs resolve to a live conflict record — the receipt limb through the
         quarantined receipt’s subject — which is where the reason has always been stored. */
      var _dqConflict=null;
      var _liveConflict=function(subject){var z,cs=worldState.identityConflicts||[];for(z=0;z<cs.length;z++)if(!cs[z].resolved&&!cs[z].stale&&cs[z].subject===subject)return cs[z];return null;};
      var _payloadDisputed=function(payload,title){
        if(_dq.indexOf(_w2Compact(title))>=0){
          if(!_dqConflict){var rs=worldState.canonTxns||[],z;for(z=0;z<rs.length;z++)if(rs[z].status==="quarantined"&&rs[z].quest&&_w2Compact(rs[z].quest)===_w2Compact(title)){_dqConflict=_liveConflict(rs[z].subject);if(_dqConflict)break;}}
          return true;}
        var k;for(k=0;k<_dSubs.length;k++)if(new RegExp("\\b"+_dSubs[k].replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(payload)){if(!_dqConflict)_dqConflict=_liveConflict(_dSubs[k]);return true;}
        return false;
      };
      ordinary=ordinary.replace(/\[QUEST:([^|\]]+)\|(completed?|done|finished|failed)[^\]]*\]/gi,function(full,title){if(_payloadDisputed(full,title)){_dqStripped.push(title);_w2RefuseLog(full);return"";}return full;});
      ordinary=ordinary.replace(/\[QUEST_STEP:([^|\]]+)\|[^\]]*\|\s*(?:true|done|1|yes|x)\s*\]/gi,function(full,title){if(_payloadDisputed(full,title)){_dqStripped.push(title);_w2RefuseLog(full);return"";}return full;});
      if(_dqStripped.length){
        var _wbTok=_w2CollectStripped(ordinary,W2_REWARD_RES);
        _w2RefuseLog(_wbTok);
        ordinary=_w2StripRewards(ordinary);
        _w2StampWithheld(_dqConflict,_wbTok);var _wbSum=w2WithheldSummary(_wbTok);
        if(typeof console!=="undefined")console.warn("[identity] completion + co-emitted rewards withheld for disputed quest(s): "+_dqStripped.join(", ")+" — "+((_dqConflict&&_dqConflict.reason)||"cause unrecorded")+" — a valid CANON_TXN re-emission resolves the dispute and pays out (#175)");
        if(typeof showToast==="function")showToast("⚠ “"+_dqStripped[0]+"” not credited"+(_wbSum?" ("+_wbSum+")":"")+" — "+w2RefusalCopy(_dqConflict&&_dqConflict.reason)+". Asking the GM to put it right.",8000);
      }
    }
  }
  var merges=ordinary.match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/g)||[],mi;for(mi=0;mi<merges.length;mi++){var mp=merges[mi].match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/),mc=mp[1].trim(),md=mp[2].trim();if(!w2MergeAllowed(mc,md)){ordinary=ordinary.replace(merges[mi],"");w2MergePropose(mc,md);}}
  var gen=ordinary.match(/\[MERGE:npc\|([^|\]]+)\|([^\]]+)\]/g)||[];for(mi=0;mi<gen.length;mi++){var gp=gen[mi].match(/\[MERGE:npc\|([^|\]]+)\|([^\]]+)\]/),gc=gp[1].trim(),gd=gp[2].trim();if(!w2MergeAllowed(gc,gd)){ordinary=ordinary.replace(gen[mi],"");w2MergePropose(gc,gd);}}
  return {ordinary:ordinary,txns:txns};
}
function _w2ChapterDeath(name,summary){var esc=String(name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),n="\\b"+esc+"\\b",s=String(summary||"");return new RegExp(n+"\\s+(?:died|perished)\\b","i").test(s)||new RegExp(n+"\\s+(?:(?:was|is|had been|has been|lay|lies|fell|falls|dropped|drops|remained|remains)\\s+)(?:dead|slain|killed|deceased)\\b","i").test(s)||new RegExp("\\b(?:the\\s+)?death\\s+of\\s+"+n,"i").test(s)||new RegExp(n+"'s\\s+(?:corpse|remains)\\b","i").test(s)||new RegExp(n+"\\s+bled\\s+out\\b","i").test(s);/* #168R6c: "X's corpse cooled" / "X bled out" are death-shaped chapter claims too (entry-13 review) */}

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
function _w6StartsWithName(sent,row){var low=String(sent||"").toLowerCase().replace(/^\s+/,""),a=[row.name].concat(row.aliases||[]),i,n;for(i=0;i<a.length;i++){n=String(a[i]).toLowerCase();if(low.indexOf(n)===0&&!/[a-z0-9]/.test(low.charAt(n.length))){if(/^['’]s\b/.test(low.slice(n.length)))continue;/* P4b (#169): "Ammut's blade rings" is a POSSESSIVE — the blade is the subject, not Ammut; treating it as an anchor false-rejected valid summaries and burned strikes */return true;}}return false;}
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
function _w6SubjectFamily(sent){var low=String(sent||"").toLowerCase(),m=low.match(/(?:^|[,;:]\s*|\b(?:and|but|then)\s+)\s*(she|he)\b/);if(m)return m[1]==="she"?"F":"M";if(/\bshe\b[^.!?]*\bherself\b/.test(low))return"F";if(/\bhe\b[^.!?]*\bhimself\b/.test(low))return"M";/* P4b (#169): a reflexive ALONE is not subject evidence — "the stranger pulls the girl behind herself" burned a strike against a prior male anchor; the reflexive now needs its matching subject pronoun in the same sentence */return"";}
function _w6TextConflict(text,table){
  var s=String(text||""),sq=(s.match(/"/g)||[]).length;if(sq%2||(s.match(/\u201c/g)||[]).length!==(s.match(/\u201d/g)||[]).length)return null;
  /* #182 (v1.616): two REACH expansions, corpus-measured before shipping (dev/w6-reach-audit.js,
     1,589 real prose pieces across five save exports \u2014 ZERO new flags from either, each catches
     its recall fixture): \u2460 a semicolon is a sentence boundary ("Ammut falls; she rises" was ONE
     sentence, the post-semicolon pronoun never checked); \u2461 inside an ANCHORED sentence, a
     comma-conjunction clause's subject pronoun is checked against the anchor ("Ammut falls
     hard, and she rises" was invisible). The third deferred candidate \u2014 fronted possessives as
     anchors \u2014 measured ZERO recall gain on the same corpus and conflicts with the P4b
     owner-ruled precision fix (possessives never anchor; pinned by test + sabotage): PARKED. */
  var re=/[^.!?;]+(?:[.!?;]+["\u201d]*|$)/g,m,prior=null;
  while((m=re.exec(s))){var sent=m[0],low=sent.toLowerCase(),named=[],i,f;if(/["\u201c\u201d]/.test(sent)){prior=null;continue;}for(i=0;i<table.rows.length;i++)if(_w6TextHasName(low,table.rows[i]))named.push(table.rows[i]);if(named.length===0&&prior){f=_w6SubjectFamily(sent);if((prior.family==="M"||prior.family==="F")&&f&&f!==prior.family)return {row:prior,sentence:sent.trim(),found:_w6Pronouns(f)};}
    var anchor=named.length===1&&_w6StartsWithName(sent,named[0])?named[0]:null;
    if(anchor&&(anchor.family==="M"||anchor.family==="F")){var tails=low.split(/,\s*(?:and|but|then|so)\s+/),k;for(k=1;k<tails.length;k++){f=_w6SubjectFamily(tails[k]);if(f&&f!==anchor.family)return {row:anchor,sentence:sent.trim(),found:_w6Pronouns(f)};}}
    prior=anchor;}
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
  for(i=0;i<ds.length;i++){var d=ds[i],name=(d&&typeof d==="object")?String(d.name||""):String(d||""),ws=name&&typeof wsNpcByName==="function"?wsNpcByName(resolveNpcName(name)):null,mem=name&&memory.npcs&&memory.npcs[resolveNpcName(name)];if(!name)continue;name=resolveNpcName(name);subject=name;handle=(d&&typeof d==="object")?String(d.handle||""):"-";if((ws&&ws.dead)||(mem&&mem.dead)){valid[name]=true;continue;}if((!d||typeof d!=="object")&&!legacyTrusted)reason="uncited legacy npcDeaths entry cannot mint a new corpse";else if(!d||typeof d!=="object")valid[name]=true;else if(d.sourceTurn==null||!isFinite(Number(d.sourceTurn)))reason="summary death lacks a source turn";else if(!handle||!w2DeathAuthorized(name,handle,Number(d.sourceTurn)))reason="summary death lacks matching scene-handle evidence";else if(d.canonTxnId&&typeof _w2TxnFind==="function"&&(function(){var _ctr=_w2TxnFind(String(d.canonTxnId));if(_ctr&&_ctr.status==="quarantined")return true;if(!_ctr&&typeof console!=="undefined")console.warn("[identity] summary death cites unknown transaction id "+d.canonTxnId+" - ignored, handle evidence governs (#168R6b)");return false;})())reason="summary death cites a quarantined transaction";else valid[name]=true;if(reason)break;}
  if(!reason&&extracted.chapterSummary){var names=Object.keys(memory.npcs||{}),j;for(j=0;j<names.length;j++){var cn=resolveNpcName(names[j]),cw=typeof wsNpcByName==="function"?wsNpcByName(cn):null;if((cw&&cw.dead)||memory.npcs[cn].dead||valid[cn])continue;if(_w2ChapterDeath(cn,extracted.chapterSummary)){subject=cn;reason="death-like chapter claim has no cited npcDeaths evidence";break;}}}
  if(reason){
    /* #190ⓔ (the lane race): the extractor truthfully reports prose the GAMEPLAY lane has not yet
       healed — summarize retries every action while the corrective nudge reaches the GM only every
       ≥3 turns, so the summary lane reliably struck out (3 → window quarantined, no extraction
       filed) before the tag lane could act. A failure whose subject ALREADY has an open, non-stale
       tag-lane conflict is unresolvable by the extractor and must DEFER (skip the strike), not
       STRIKE. Checked BEFORE the mint below (the mint itself would create the record). Once the
       tag-lane conflict resolves or shelves stale, deferral ends and the 3-strike quarantine
       remains the terminal escape — deferral delays the clock, never disables it. */
    var _preOpen=false,_po;var _pq=worldState.identityConflicts||[];
    for(_po=0;_po<_pq.length;_po++)if(!_pq[_po].resolved&&!_pq[_po].stale&&_pq[_po].subject===subject){_preOpen=true;break;}
    _w2Conflict(subject,handle,reason);var e=new Error("W2 referential integrity: "+subject+" - "+reason);e.w2Identity=true;e.subject=subject;e.handle=handle;
    if(_preOpen){e.w2Defer=true;if(typeof console!=="undefined")console.warn("[identity] summary validation failure for "+subject+" DEFERRED — an open tag-lane conflict owns this dispute; no strike counted (#190e)");}
    throw e;}return true;
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
