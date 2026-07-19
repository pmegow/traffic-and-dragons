// Distinctive-name tokens: lowercase, drop parentheticals, then drop honorifics/titles and generic
// role nouns so only the words that actually identify a person remain. "Sheriff Belor Hemlock" ->
// [belor,hemlock]; "The Scarred Man" -> [scarred]; "Barkeep (Rusty Dragon)" -> [] (role-only, no
// distinctive name — deliberately unmergeable so anonymous functionaries never absorb a real NPC).
var _NPC_STOP={sheriff:1,father:1,mother:1,lord:1,lady:1,ser:1,sir:1,captain:1,master:1,mistress:1,
  brother:1,sister:1,saint:1,st:1,king:1,queen:1,prince:1,princess:1,dame:1,elder:1,dr:1,doctor:1,
  professor:1,the:1,old:1,young:1,a:1,an:1,man:1,woman:1,girl:1,boy:1,child:1,lad:1,lass:1,
  stranger:1,guard:1,barkeep:1,keeper:1,innkeeper:1,merchant:1,wife:1,husband:1,soldier:1,priest:1,
  priestess:1,mage:1,wizard:1,knight:1,thief:1,beggar:1,drunk:1,unnamed:1};
// Memoized (AUDIT_FABLE_07_16 #3): pure function of an immutable string, recomputed O(N) per
// resolveNpcName all-keys scan and O(N) per ragKnownNames rebuild. Map growth is bounded by the
// distinct NPC-name vocabulary; no eviction. Null-prototype map so hostile keys ("__proto__",
// "hasOwnProperty") behave as plain entries. The SAME array is returned on a hit — every caller
// is read-only (verified: memory.js, dev/npc-merge-core.js, engine-tests); do NOT mutate it.
// Deliberately NOT memoized: resolveNpcName itself — NPC_ALIAS/NPC_MERGE run EARLY in the tag
// table precisely so later tags in the SAME response resolve through the just-registered alias;
// a response-scoped resolution memo primed before the alias lands would misroute those tags.
var _npcTokMemo=Object.create(null);
function npcCoreTokens(name){
  var key=String(name||"");
  var hit=_npcTokMemo[key];
  if(hit)return hit;
  npcCoreTokens._misses++;
  var s=key.toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9\s]/g," ");
  var raw=s.split(/\s+/),out=[],i;
  for(i=0;i<raw.length;i++){if(raw[i]&&!_NPC_STOP[raw[i]])out.push(raw[i]);}
  _npcTokMemo[key]=out;
  return out;
}
npcCoreTokens._misses=0; // test hook (dev/_tests_A2.js): counts real computations, not hits
function resolveNpcName(name){
  if(!memory.npcs)return name;
  if(memory.npcs[name])return name;
  var k;for(k in memory.npcs){if(memory.npcs[k].aliases&&memory.npcs[k].aliases.indexOf(name)>=0)return k;}
  // Distinctive-token consolidation (bidirectional, honorific/parenthetical-tolerant). The GM freely
  // varies a name across turns — "Morwen" / "Morwen Zethran" / "Morwen (Ammut's wife)", or "Hemlock" /
  // "Sheriff Belor Hemlock" — which otherwise forks one person into several memory.npcs entries. If the
  // incoming name's distinctive tokens are a subset (either direction) of EXACTLY ONE existing entry's,
  // resolve to that entry. The single-candidate guard keeps distinct people who share a token (e.g.
  // sibling surname "Kaijitsu") separate rather than wrongly merging them.
  var inCore=npcCoreTokens(name);
  if(!inCore.length)return name;
  var match=null,cnt=0;
  for(k in memory.npcs){
    if(k===name)continue;
    var kCore=npcCoreTokens(k);
    if(!kCore.length)continue;
    var shortT=inCore.length<=kCore.length?inCore:kCore;
    var longT=inCore.length<=kCore.length?kCore:inCore;
    var subset=true,ti;
    for(ti=0;ti<shortT.length;ti++){if(longT.indexOf(shortT[ti])<0){subset=false;break;}}
    if(subset){match=k;cnt++;if(cnt>1)break;}
  }
  if(cnt===1)return match;
  return name;
}

// peek=true computes the window WITHOUT advancing memory.nameIdx. buildSysPrompt must use
// peek — a prompt builder that mutates state burns names on every internal call (sheet sync,
// re-roll) and makes the prompt unstable for caching (audit #12). The cursor is advanced
// once per narrative turn in sendAction instead.
function getNameSuggestions(count,peek){
  var firstNames=[],cats=Object.keys(NAMES),k,i;
  for(k=0;k<cats.length;k++){if(cats[k]==="surnames")continue;for(i=0;i<NAMES[cats[k]].length;i++)firstNames.push(NAMES[cats[k]][i]);}
  var surnames=NAMES.surnames||[];
  if(!firstNames.length)return[];
  if(typeof memory.nameIdx!=="number")memory.nameIdx=0;
  var result=[],n=count||10,idx=memory.nameIdx;
  for(i=0;i<n;i++){
    var first=firstNames[idx%firstNames.length];
    var last=surnames.length?surnames[(idx*7+3)%surnames.length]:"";
    result.push(last?first+" "+last:first);
    idx++;
  }
  if(!peek)memory.nameIdx=idx;
  return result;
}
function fileNpcEvent(name,note,turn){name=resolveNpcName(name);if(!memory.npcs[name])memory.npcs[name]={attitude:"",knowledge:[],events:[],aliases:[]};memory.npcs[name].events.push({turn:turn,note:note});if(memory.npcs[name].events.length>8)memory.npcs[name].events=memory.npcs[name].events.slice(-8);/* slice, not a single shift, so an NPC_MERGE overfill actually shrinks back to the cap (audit E50) */}
function fileLocation(loc,note,turn){
  // Legacy locations index
  if(!memory.locations[loc])memory.locations[loc]={visited:[],notes:[]};
  if(!memory.locations[loc].visited)memory.locations[loc].visited=[];// blueprint-seeded entries lacked this (audit #8)
  memory.locations[loc].visited.push(turn);
  if(note){memory.locations[loc].notes.push(note);if(memory.locations[loc].notes.length>5)memory.locations[loc].notes.shift();}
  // Map node
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.nodes[loc])memory.map.nodes[loc]={firstVisit:turn,visits:0,description:null,parent:null,npcs:[],items:[],size:null,travelMins:null};
  memory.map.nodes[loc].visits++;
  // Edge + arrival tracking
  var prev=worldState&&worldState.world?worldState.world.location:null;
  if(prev&&prev!==loc){
    memory.map.lastArrivalFrom=prev;
    var exi=false,ei;
    for(ei=0;ei<memory.map.edges.length;ei++){var e=memory.map.edges[ei];if((e.from===prev&&e.to===loc)||(e.from===loc&&e.to===prev)){exi=true;break;}}
    if(!exi)memory.map.edges.push({from:prev,to:loc,turn:turn});
  }
}
function fileSubLocation(name,turn){
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  var parent=worldState&&worldState.world?worldState.world.location:null;if(!parent)return;
  var key=parent+"|"+name;
  if(!memory.map.nodes[key])memory.map.nodes[key]={firstVisit:turn,visits:0,description:null,parent:parent,npcs:[],items:[],size:null,travelMins:null};
  memory.map.nodes[key].visits++;memory.map.nodes[key].lastVisit=turn;// stamp recency so buildGeoBlock keeps a re-visited sub-location listed (audit E53)
}
function fileLocationDesc(desc){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=currentNodeKey();/* UA9 */
  if(!memory.map.nodes[key])return;
  if(!memory.map.nodes[key].description)memory.map.nodes[key].description=desc;
}
function fileLocationItem(name,action,turn){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=currentNodeKey();/* UA9 */
  if(!memory.map.nodes[key])return;
  var items=memory.map.nodes[key].items,idx=-1,i;
  for(i=0;i<items.length;i++){if(items[i].name.toLowerCase()===name.toLowerCase()){idx=i;break;}}
  if(action==="placed"){
    if(idx>=0)items[idx].taken=false; // returned — toggle back
    else items.push({name:name,placed:turn,taken:false});
  }else if(action==="taken"&&idx>=0){items[idx].taken=true;}
}
function autoTakeLocationItem(itemName){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=currentNodeKey();/* UA9 */
  var node=memory.map.nodes[key];if(!node)return;
  var i;for(i=0;i<node.items.length;i++){if(node.items[i].name.toLowerCase()===itemName.toLowerCase()&&!node.items[i].taken){node.items[i].taken=true;return;}}
}
function mapNpcLocation(name){
  if(!memory.map||!worldState||!worldState.world)return;
  name=resolveNpcName(name);
  var key=currentNodeKey();/* UA9 */
  if(!memory.map.nodes[key])return;
  var npcs=memory.map.nodes[key].npcs;if(npcs.indexOf(name)<0)npcs.push(name);
  if(memory.npcs[name])memory.npcs[name].lastSeenAt=key;
}
// P6: NPC status/attitude are roster labels re-injected every turn — the GM (and the summarize
// extractor) drift into sentence-length prose there ("exhausted but precise, has given Varek
// everything she knows"), which is token waste and format rot. Clamp to a short mood at every
// write boundary; word-boundary cut so the kept part stays readable. Cosmetic normalization,
// so console.warn (not a toast) is the visibility.
var NPC_MOOD_MAX=48;
// v1.379 (mood/relation separation): the MOOD field must never hold RELATION vocabulary. Before
// v1.379 the [NPC:] format could not express an empty slot — a sparse tag was dropped silently —
// so the GM had to put SOMETHING in every slot, and the nearest word was frequently the relation.
// Measured on a live t867 save: 6 of 28 NPCs, and for 4 of them the leak was the ENTIRE mood
// ("enemy"/"ally"). Strip by TYPE, never by position: a positional rule ("drop the 3rd element")
// repairs only the 2 records that HAVE a 3rd element and misses the 4 worst.
// Deliberately CONSERVATIVE — only words naming a RELATIONSHIP that can never be a mood. Words
// like "prisoner"/"captive" are excluded ON PURPOSE: the slot is spec'd "mood/condition", so a
// captivity state is legitimate there and must not be scrubbed.
var NPC_REL_VOCAB=/^(all(y|ies)|enem(y|ies)|acquaintances?|rivals?|companions?|friends?|strangers?|neutral|adversar(y|ies)|partner)$/i;
function stripRelWordsFromMood(s){
  if(!s)return "";
  var parts=String(s).split(","),out=[],i,p;
  for(i=0;i<parts.length;i++){p=parts[i].trim();if(p&&!NPC_REL_VOCAB.test(p))out.push(p);}
  return out.join(", ");
}
function clampNpcMood(s){
  if(!s)return s;s=String(s).trim();
  if(s.length<=NPC_MOOD_MAX)return s;
  var cut=s.lastIndexOf(" ",NPC_MOOD_MAX-1);if(cut<20)cut=NPC_MOOD_MAX-1;
  var out=s.slice(0,cut).replace(/[,;:\s]+$/,"")+"…";
  if(typeof console!=="undefined")console.warn("[npc] mood clamped: \""+s.slice(0,60)+(s.length>60?"…":"")+"\" -> \""+out+"\"");
  return out;
}
// P12: the 30-caps on lore/keyDecisions (and the 10-cap on chapters) used to DELETE the oldest
// entry on overflow — at t75 of the diagnostic run turns 1-25 had already rolled off. Eviction now
// compacts into memory.archive (storage-only: never injected into the prompt, so the caps still
// bound prompt size; strings are cheap in the sync blob). Future retrieval features (Core Memory
// #40, RAG) can mine the archive.
function memArchive(){if(!memory.archive)memory.archive={lore:[],decisions:[],chapters:[]};if(!memory.archive.lore)memory.archive.lore=[];if(!memory.archive.decisions)memory.archive.decisions=[];if(!memory.archive.chapters)memory.archive.chapters=[];if(!memory.archive.superseded)memory.archive.superseded=[];return memory.archive;}
function fileLore(fact){if(memory.lore.indexOf(fact)<0)memory.lore.push(fact);if(memory.lore.length>30)memArchive().lore.push(memory.lore.shift());}
function fileDecision(turn,desc){memory.keyDecisions.push({turn:turn,desc:desc});if(memory.keyDecisions.length>30)memArchive().decisions.push(memory.keyDecisions.shift());}
// Future events were unbounded — pushed every summarize() cycle, never removed (resolve only flagged),
// and memoryTOC injected ALL unresolved ones into every prompt (a save reached 469). Now: dedupe by
// `what`, drop resolved on resolve, and cap to the most-recent 30 (same discipline as lore/decisions).
// ── #29 futureEvents hygiene ─────────────────────────────────────────────────────
// Significant stemmed tokens of an event's `what` — the near-duplicate fingerprint. Light suffix
// stem so "find Shalelu"/"finding Shalelu"/"finds Shalelu" collapse; RAG_STOP + <4 chars dropped.
function feTokens(s){
  var out=[],seen={},w=String(s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/),i;
  for(i=0;i<w.length;i++){
    var t=w[i];
    if(t.length<4||RAG_STOP[t])continue;
    t=t.replace(/(ing|ed|es|s)$/,"");
    if(t.length>=3&&!seen[t]){seen[t]=1;out.push(t);}
  }
  return out;
}
// Age sweep: unresolved events older than FUTURE_EXPIRE_TURNS are finished business or dead plans
// either way (the GM rarely emits [FUTURE_EVENT_RESOLVED:] on its own — t160/t198 finding), and
// PENDING EVENTS was injecting them every turn. Called from summarize() — deterministic, no model
// judgment involved. Entries missing setTurn (pre-stamp saves) are grandfathered: stamped now, age
// from here.
function expireFutureEvents(){
  if(!memory.futureEvents||!memory.futureEvents.length)return;
  var now=(typeof worldState!=="undefined"&&worldState)?worldState.turn:0,kept=[],i;
  for(i=0;i<memory.futureEvents.length;i++){
    var f=memory.futureEvents[i];
    if(typeof f.setTurn!=="number")f.setTurn=now;
    if(now-f.setTurn<=FUTURE_EXPIRE_TURNS)kept.push(f);
  }
  memory.futureEvents=kept;
}
function fileFutureEvent(when,who,what,setTurn){
  if(what==null)return;what=String(what);if(!what)return;/* coerce a non-string what so feTokens/indexOf don't throw later (audit E44) */
  var i;for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what===what)return;}// dedupe
  // Near-duplicate dedupe (#29): the extractor re-mints pending goals in fresh words every cycle —
  // the t198 save held SEVEN "find Shalelu" variants. If the new event shares ≥2 significant tokens
  // AND ≥half of the smaller fingerprint with an existing pending event, refresh that event's age
  // instead of filing a twin (still-topical goals stay alive for the expiry sweep; no spam).
  // Threshold keeps same-NPC-different-business apart ("Confront Hemlock re broadsheet" vs
  // "Understand Hemlock's mechanism" share only 1 token — both survive).
  var nt=feTokens(what);
  for(i=0;i<memory.futureEvents.length;i++){
    var ex=memory.futureEvents[i];
    if(ex.resolved)continue;
    var et=feTokens(ex.what),shared=0,j;
    for(j=0;j<nt.length;j++){if(et.indexOf(nt[j])>=0)shared++;}
    var minLen=Math.min(nt.length,et.length);
    if(shared>=2&&shared*2>=minLen){
      if(typeof setTurn==="number")ex.setTurn=setTurn;
      return;
    }
  }
  memory.futureEvents.push({when:when,who:who||"",what:what,setTurn:setTurn,resolved:false});
  if(memory.futureEvents.length>30)memory.futureEvents=memory.futureEvents.slice(-30);
}
function resolveFutureEvent(what){var i;
  what=String(what==null?"":what);if(!what.trim())return;// empty/whitespace needle would substring-match (and delete) the oldest event (audit E45)
  for(i=0;i<memory.futureEvents.length;i++){if(String(memory.futureEvents[i].what)===what){memory.futureEvents.splice(i,1);return;}}// exact, remove
  for(i=0;i<memory.futureEvents.length;i++){if(String(memory.futureEvents[i].what).indexOf(what)>=0){memory.futureEvents.splice(i,1);return;}}}// partial, remove
// ── RAG episodic memory (#27 Phase 1 — see RAG_MEMORY.md) ──────────────────────
// Entity-keyed retrieval over the verbatim transcript — no vectors, no extra API calls.
// READ-SIDE ONLY: nothing here changes what gets written to memory/chapters/summaries.
// The per-campaign flag worldState.ragMemory gates retrieval AND the memoryTOC diet together.
// DEFAULT ON since v1.230 (validated on the t308 mature save — RAG is what keeps a long campaign
// coherent through NPC-key fragmentation and the cap-30 memory window; see AUDIT_t308.md). Semantics:
// ON unless EXPLICITLY disabled — `undefined` (every existing save + every new campaign) reads ON with
// zero migration; only a deliberate `ragMemory===false` (the Dev Mode off-switch) turns it off. The
// explicit-OFF path must still reproduce the pre-RAG prompt byte-for-byte (engine-tested — the regression
// guard survives). Retrieved excerpts are episodic TEXTURE, never current truth — the block framing
// subordinates them to the state blocks above it (the stale-chunk drift guard).
function ragEnabled(){return !!(typeof worldState!=="undefined"&&worldState)&&worldState.ragMemory!==false;}
var RAG_BUDGET=2400;   // ~600 tokens of excerpt payload per turn, hard cap
var RAG_MAX=3;         // excerpts per turn
// Known-NPC scan list (lowercased, with aliases AND distinctive name tokens). Full-key
// substring matching alone missed every honorific-keyed NPC — prose says "Hemlock", the
// key is "Sheriff Belor Hemlock", no match, entity invisible to the index (the t164
// broadsheet-quiz failure). Tokens come from npcCoreTokens (the alias system's
// distinctive-name machinery), matched word-bounded to avoid inside-word false hits.
// ── A2 memo plumbing (AUDIT_FABLE_07_16 #2) ──
// djb2 string hash (same helper as dev/engine-tests.js's __djb2 — the frozen-literal guards).
function _ragDjb2(s){var h=5381,i;for(i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return h;}
// Cheap fingerprint of EVERYTHING ragKnownNames' output depends on — memory.npcs key names +
// per-entry aliases, nothing else (verified by reading the function: it touches no other state).
// O(total name chars) to compute vs O(N²) to rebuild the token-subset collapse. Key count +
// alias count + djb2 over the joined names catch adds, deletes, merges, renames, and alias
// registrations, including mid-response ones. Shared by the ragKnownNames memo and the
// ragRetrieve result memo (whose scoring consumes ragKnownNames' output).
function _ragNpcsFp(){
  if(typeof memory==="undefined"||!memory||!memory.npcs)return "none";
  var ks=Object.keys(memory.npcs),aCnt=0,aJoin="",i,e;
  // "\u0001" separators, never bare concatenation — ["ab","c"] and ["a","bc"] must hash apart.
  for(i=0;i<ks.length;i++){e=memory.npcs[ks[i]];if(e&&e.aliases&&e.aliases.length){aCnt+=e.aliases.length;aJoin+="\u0001"+e.aliases.join("\u0001");}}
  return ks.length+"."+aCnt+"."+_ragDjb2(ks.join("\u0001"))+"."+_ragDjb2(aJoin);
}
// Memoized (AUDIT_FABLE_07_16 #2): rebuilt ~5×/turn pre-memo (logTranscript ×2, prompt build ×2
// via ragRetrieve+ragSceneTerms, backfill/summarize) with an O(N²) collapse each time. ONE memo
// entry behind the fingerprint above (+ worldState.turn as an extra conservative invalidator,
// per the pre-reviewed design). A hit returns the SAME array (same entry objects) — all callers
// are read-only. Any fingerprint mismatch rebuilds from scratch in the original order.
// Test hooks: ragKnownNames._misses (real rebuilds), ._memo (null it to force a rebuild).
function ragKnownNames(){
  var out=[],i,j;
  if(typeof memory==="undefined"||!memory||!memory.npcs)return out;
  var _fp=((typeof worldState!=="undefined"&&worldState)?worldState.turn:0)+"|"+_ragNpcsFp();
  if(ragKnownNames._memo&&ragKnownNames._memo.fp===_fp)return ragKnownNames._memo.out;
  ragKnownNames._misses++;
  var ks=Object.keys(memory.npcs);
  for(i=0;i<ks.length;i++){
    var low=ks[i].toLowerCase(),als=[],src=memory.npcs[ks[i]].aliases||[];
    for(j=0;j<src.length;j++){if(src[j]&&String(src[j]).length>=3)als.push(String(src[j]).toLowerCase());}
    var toks=[],core=npcCoreTokens(ks[i]);
    for(j=0;j<core.length;j++){if(core[j].length>=3)toks.push(core[j]);}
    if(low.length>=3||als.length||toks.length)out.push({nm:ks[i],low:low,als:als,toks:toks});
  }
  // Collapse token-subset duplicates into ONE scan identity — "Hemlock" / "Sheriff Hemlock" /
  // "Sheriff Belor Hemlock" are the same person stored thrice (alias-drift, known issue #3),
  // and without this every mention scored 3× the entity weight, drowning the ranking in
  // dupe inflation (the t164 broadsheet failure). Keep the most token-specific key; distinct
  // people sharing a surname (disjoint-ish token sets, e.g. the Kaijitsu siblings) survive.
  var keep=[],i2,j2;
  for(i2=0;i2<out.length;i2++){out[i2].others=[];out[i2].host=-1;}
  for(i2=0;i2<out.length;i2++){
    var a=out[i2];
    if(!a.toks.length)continue;
    for(j2=0;j2<out.length;j2++){
      if(i2===j2)continue;
      var b=out[j2];
      if(a.toks.length>b.toks.length)continue;
      if(a.toks.length===b.toks.length&&i2<j2)continue; // equal sets: earlier key hosts
      var subset=true,ti;
      for(ti=0;ti<a.toks.length;ti++){if(b.toks.indexOf(a.toks[ti])<0){subset=false;break;}}
      if(subset&&(a.host<0||b.toks.length>out[a.host].toks.length))a.host=j2;
    }
  }
  for(i2=0;i2<out.length;i2++){
    if(out[i2].host<0){keep.push(out[i2]);}
    else{
      var h=out[i2].host,guard=0;
      while(out[h].host>=0&&guard++<10)h=out[h].host;
      out[h].others.push(out[i2].nm); // duplicate keys ride along for weight aliasing
    }
  }
  ragKnownNames._memo={fp:_fp,out:keep};
  return keep;
}
ragKnownNames._memo=null;ragKnownNames._misses=0; // test hooks (dev/_tests_A2.js)
// Word-bounded containment: "hemlock" matches "Hemlock's face" but not "hemlocked" prose;
// prevents short tokens hitting inside unrelated words.
function ragHasWord(lowText,word){
  var idx=0;
  while((idx=lowText.indexOf(word,idx))>=0){
    var before=idx===0?"":lowText.charAt(idx-1);
    var after=lowText.charAt(idx+word.length);
    if(!/[a-z0-9]/.test(before)&&!/[a-z0-9]/.test(after))return true;
    idx+=word.length;
  }
  return false;
}
function ragScanNames(lowText,names,addFn){
  var i,j;
  for(i=0;i<names.length;i++){
    var n=names[i];
    var hit=n.low.length>=3&&lowText.indexOf(n.low)>=0;
    for(j=0;!hit&&j<n.als.length;j++){if(lowText.indexOf(n.als[j])>=0)hit=true;}
    for(j=0;!hit&&j<n.toks.length;j++){if(ragHasWord(lowText,n.toks[j]))hit=true;}
    if(hit)addFn(n.nm);
  }
}
// Write-time entity index for a GM transcript entry — {n:[npcs], l:location, q:[quest titles]},
// parsed from the raw (pre-cleanTxt) response tags plus a known-NPC name scan for untagged
// mentions. Runs on every GM entry regardless of the flag so the index is ready whenever the
// flag flips on. Additive fields only — nothing else reads .e (no schema bump, no migration).
function ragEntitiesFromRaw(raw){
  raw=String(raw||"");
  var e={n:[],l:null,q:[]},seen={},i;
  if(typeof worldState!=="undefined"&&worldState&&worldState.world)e.l=worldState.world.location||null;
  function addN(nm){nm=resolveNpcName(String(nm).trim());if(nm&&!seen[nm]&&e.n.length<12){seen[nm]=1;e.n.push(nm);}}
  var tags=raw.match(/\[(?:NPC|NPC_NOTE|PARTY_MEMBER):([^|\]]+)\|/g)||[];
  for(i=0;i<tags.length;i++){var p=tags[i].match(/\[(?:NPC|NPC_NOTE|PARTY_MEMBER):([^|\]]+)\|/);if(p)addN(p[1]);}
  ragScanNames(raw.toLowerCase(),ragKnownNames(),addN);
  var qm=raw.match(/\[QUEST:([^|\]]+)\|/g)||[];
  for(i=0;i<qm.length;i++){var qp=qm[i].match(/\[QUEST:([^|\]]+)\|/);if(qp&&e.q.indexOf(qp[1].trim())<0)e.q.push(qp[1].trim());}
  return e;
}
// Lazy backfill for pre-Phase-1 entries: tags are long stripped from .x, so this is a
// known-NPC name scan only (location/quests unrecoverable → stay empty). Idempotent.
function ragBackfillEntry(en,names){
  var e={n:[],l:null,q:[]},low=String(en.x||"").toLowerCase();
  ragScanNames(low,names,function(nm){if(e.n.length<12&&e.n.indexOf(nm)<0)e.n.push(nm);});
  return e;
}
// Query entities for the CURRENT scene: input = NPCs named in the player's pending action
// (strongest signal), scene = party members + NPCs last seen at the current node, plus the
// current location and active quest titles. Party members are tracked separately (q.party)
// so scoring can DEMOTE them — they appear in nearly every indexed entry, so their presence
// is noise, not signal (the t160/t162 quiz failure: flat party scores degenerated ranking
// to pure recency). Deterministic given the same state.
function ragQueryEntities(inputText){
  var q={input:{},scene:{},party:{},groups:{},loc:null,quests:[]},i;
  if(typeof worldState==="undefined"||!worldState)return q;
  q.loc=worldState.world?worldState.world.location:null;
  var key=currentNodeKey();/* UA9 */
  for(i=0;i<(worldState.npcs||[]).length;i++){if(worldState.npcs[i].partyMember){q.scene[worldState.npcs[i].name]=1;q.party[worldState.npcs[i].name]=1;}}
  var names=ragKnownNames();
  for(i=0;i<names.length;i++){
    if(names[i].others&&names[i].others.length)q.groups[names[i].nm]=names[i].others; // duplicate-key aliases for weight mapping
    var meta=memory.npcs[names[i].nm];
    if(meta&&meta.lastSeenAt&&(meta.lastSeenAt===key||meta.lastSeenAt===q.loc))q.scene[names[i].nm]=1;
  }
  if(inputText)ragScanNames(String(inputText).toLowerCase(),names,function(nm){q.input[nm]=1;});
  for(i=0;i<(worldState.questLog||[]).length;i++){if(worldState.questLog[i].status==="active")q.quests.push(worldState.questLog[i].title);}
  return q;
}
// Topical terms from the player's input — the signal entity scoring can't see (the t162 pin
// quiz: "pin"/"clasp"/"retrieve" are what identify the right scene; every Glassworks turn had
// the same entities). Rare-ish words ≥4 chars, structural stopwords dropped, capped at 8.
var RAG_STOP={"about":1,"after":1,"again":1,"back":1,"been":1,"before":1,"come":1,"could":1,"did":1,"does":1,"down":1,"from":1,"gets":1,"goes":1,"going":1,"have":1,"here":1,"into":1,"just":1,"know":1,"like":1,"look":1,"make":1,"more":1,"most":1,"much":1,"over":1,"should":1,"some":1,"take":1,"tell":1,"that":1,"them":1,"then":1,"there":1,"they":1,"this":1,"through":1,"want":1,"were":1,"what":1,"when":1,"where":1,"which":1,"while":1,"will":1,"with":1,"would":1,"your":1};
function ragQueryTerms(inputText){
  var out=[],seen={},i;
  var words=String(inputText||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/);
  for(i=0;i<words.length;i++){
    var w=words[i];
    if(w.length>=4&&!RAG_STOP[w]&&!seen[w]){seen[w]=1;out.push(w);if(out.length>=8)break;}
  }
  return out;
}
// Lowercased scene terms for the TOC lore filter.
function ragSceneTerms(inputText){
  var q=ragQueryEntities(inputText),terms=[],k;
  for(k in q.input){if(k.length>=3&&terms.indexOf(k.toLowerCase())<0)terms.push(k.toLowerCase());}
  for(k in q.scene){if(k.length>=3&&terms.indexOf(k.toLowerCase())<0)terms.push(k.toLowerCase());}
  if(q.loc&&q.loc.length>=3)terms.push(q.loc.toLowerCase());
  return terms;
}
function ragTrim(s,max){
  s=String(s||"");if(s.length<=max)return s;
  var t=s.slice(0,max);
  var b=Math.max(t.lastIndexOf(". "),t.lastIndexOf("! "),t.lastIndexOf("? "));
  if(b>max*0.4)t=t.slice(0,b+1);
  return t+" …";
}
// ── A2 (AUDIT_FABLE_07_16 #2): ragRetrieve result memo — ONE entry (the last call) ──────────
// The scoring pass below is deterministic given the same state (its ONLY mutation is the lazy
// .e backfill, which is idempotent — a memo hit merely skips re-backfilling entries that are
// already backfilled), so a byte-identical repeat call may serve the cached string.
// RECORDED DEVIATION from the pre-reviewed key, in the CONSERVATIVE direction only: the spec'd
// key was (turn, inputText, transcript.length), but that triple is not unique across states —
// two different transcripts of equal length at the same turn with the same input collide (the
// engine suite's two Hemlock-broadsheet fixtures are a live instance; the narrow key serves
// test A's block to test B). The key here is a strict SUPERSET: it adds first/last
// transcript-entry hashes (covers append AND rerollLast's last-entry swap), sessionLog.length
// (drives the skipN window), the npc-table fingerprint (keys/aliases feed scoring via
// ragKnownNames + the merge-orphan bridge), and a scene hash (location, party, active quests,
// NPC lastSeenAt — everything ragQueryEntities reads). A superset key can only MISS more and
// recompute fresh; every hit it serves, the spec'd key would also have served.
// NOTE: in the live main-turn → v1.288 suggestion-call sequence, worldState.turn++ and
// logTranscript("gm") land BETWEEN the two prompt builds, so ANY key containing turn or
// transcript.length (the spec'd one included) misses there and recomputes — correct, since
// applyMuts ran in between and can change scene entities. Real hits: retryLast after a failed
// turn, same-state double builds (e.g. a sheet-audit build right after the suggestion build),
// repeated Table Talk sends. The flag-off / pre-game / young-campaign "" paths return BEFORE
// the memo and are never cached. Test hooks: ragRetrieve._misses (real passes), ._memo.
function _ragRetrieveKey(inputText){
  function entFp(en){return en?String(en.t)+"~"+String(en.r)+"~"+_ragDjb2(String(en.x||"")):"-";}
  var tr=worldState.transcript,scene="",i,k;
  if(worldState.world)scene+=String(worldState.world.location||"");
  for(i=0;i<(worldState.npcs||[]).length;i++){if(worldState.npcs[i].partyMember)scene+="\u0001"+worldState.npcs[i].name;}
  for(i=0;i<(worldState.questLog||[]).length;i++){if(worldState.questLog[i].status==="active")scene+="\u0002"+worldState.questLog[i].title;}
  if(typeof memory!=="undefined"&&memory&&memory.npcs){for(k in memory.npcs){if(memory.npcs[k]&&memory.npcs[k].lastSeenAt)scene+="\u0003"+k+"@"+memory.npcs[k].lastSeenAt;}}
  var slLen=(typeof sessionLog!=="undefined"&&sessionLog)?sessionLog.length:0;
  return worldState.turn+"|"+tr.length+"|"+entFp(tr[0])+"|"+entFp(tr[tr.length-1])+"|"+slLen+"|"+_ragNpcsFp()+"|"+_ragDjb2(scene)+"|"+String(inputText==null?"":inputText);
}
function ragRetrieve(inputText){
  if(!ragEnabled())return "";
  var tr=worldState.transcript;
  if(!tr||tr.length<6)return "";
  var _k=_ragRetrieveKey(inputText);
  var _m=ragRetrieve._memo;
  if(_m&&_m.k===_k)return _m.v;
  ragRetrieve._misses++;
  var v=_ragRetrieveScore(inputText);
  ragRetrieve._memo={k:_k,v:v};
  return v;
}
ragRetrieve._memo=null;ragRetrieve._misses=0; // test hooks (dev/_tests_A2.js)
// The retrieval pass — returns the PAST SCENE EXCERPTS block for buildSysPrompt's volatile
// half, or "" (flag off / young campaign / no hits). Scores indexed GM entries by entity
// overlap with the current scene, skips the last RAG_RECENT turns (already in sessionLog),
// picks the top RAG_MAX at least 3 turns apart (adjacent turns are one scene), renders
// oldest-first within RAG_BUDGET. Only mutation is filling missing .e index fields (lazy
// backfill — idempotent, so repeated buildSysPrompt calls are safe; no cursor advances
// here, same discipline as getNameSuggestions peek mode). Call via ragRetrieve (the memo
// wrapper above) — this function always runs the full pass.
function _ragRetrieveScore(inputText){
  if(!ragEnabled())return "";
  var tr=worldState.transcript;
  if(!tr||tr.length<6)return "";
  var q=ragQueryEntities(inputText||"");
  var terms=ragQueryTerms(inputText||"");
  // Entity names already score as entities — their tokens double-dipping as lexical terms
  // just flattens the ranking ("hemlock" +3 entity AND +2 term on every mention).
  (function(){
    var ent={},k,i2,keepT=[];
    for(k in q.input){var tk=npcCoreTokens(k);for(i2=0;i2<tk.length;i2++)ent[tk[i2]]=1;}
    for(i2=0;i2<terms.length;i2++){if(!ent[terms[i2]])keepT.push(terms[i2]);}
    terms=keepT;
  })();
  var w={},k,hasInput=false;
  for(k in q.input){w[k]=3;hasInput=true;}
  // Party members are in nearly every entry — weak signal at best, and when the input NAMES
  // someone (a directed question), companions-standing-nearby is pure noise: weight 0.
  for(k in q.scene){if(!w[k]){var pw=q.party[k]?(hasInput?0:1):2;if(pw)w[k]=pw;}}
  // Duplicate-key groups share ONE weight: entries indexed at write time may carry any of the
  // duplicate names ("Hemlock" vs the collapsed "Sheriff Belor Hemlock"); alias them, and zero
  // out double-counting when an entry lists several names from the same group.
  var gRoot={};
  for(k in q.groups){gRoot[k]=k;var gi;for(gi=0;gi<q.groups[k].length;gi++){gRoot[q.groups[k][gi]]=k;if(w[k]&&!w[q.groups[k][gi]])w[q.groups[k][gi]]=w[k];}}
  var qws={},qi;for(qi=0;qi<q.quests.length;qi++)qws[q.quests[qi].toLowerCase()]=1;
  // Skip only what the live conversation actually covers. The old fixed 10-turn skip assumed
  // sessionLog holds ~10 turns — false in mature campaigns, where summarize fires every ~2
  // turns and left a DEAD ZONE 3–10 turns back: too old for sessionLog, too recent for
  // retrieval (the t165 Frizwick-quiz failure). Floor of 2 (the current exchange is always
  // in context); grows with sessionLog depth in young campaigns where the log runs long.
  var skipN=Math.max(2,Math.ceil(((typeof sessionLog!=="undefined"&&sessionLog)?sessionLog.length:0)/2)+1);
  var cutT=worldState.turn-skipN;
  var cands=[],names=null,i,j;
  // Pass 1: backfill missing indexes + per-term document frequency over eligible entries.
  // IDF makes rare words dominate ("broadsheet": ~4 entries → strong; "keep": everywhere →
  // ~nothing) without a hand-tuned stoplist — the t164 lesson. Deterministic, no vectors.
  var elig=[],df=[],N=0;
  for(j=0;j<terms.length;j++)df.push(0);
  for(i=0;i<tr.length;i++){
    var en0=tr[i];
    if(en0.r!=="gm")continue;
    if(en0.t>cutT)continue;
    if(en0.rc)continue; // [RETCON:]-marked — superseded or correcting narration, never episodic truth
    var prev0=i>0&&tr[i-1].r==="player"?String(tr[i-1].x).toLowerCase():"";
    // Meta-exchange filter: a player turn opening with "GM:" is an out-of-character question
    // ABOUT the record (memory quiz, correction), and the response is recall chatter — often
    // confabulated — not a scene. Left in the index, these echoes outrank the origin scenes
    // they quote (the t164 broadsheet displacement) and preserve false corrections (the t160
    // pin-grab). Excluded from candidacy AND from the IDF document set.
    if(/^\s*gm\s*[:,]/.test(prev0))continue;
    if(!en0.e){if(!names)names=ragKnownNames();en0.e=ragBackfillEntry(en0,names);}
    var low0=String(en0.x).toLowerCase();
    var hits0=[];
    for(j=0;j<terms.length;j++){var h=low0.indexOf(terms[j])>=0||(prev0&&prev0.indexOf(terms[j])>=0);hits0.push(h);if(h)df[j]++;}
    elig.push({i:i,en:en0,hits:hits0});
    N++;
  }
  // Pass 2: score. Entity/location/quest overlap gates; IDF-weighted term hits rank.
  // Write-time index names can be ORPHANED by a later [NPC_MERGE:] — entries stamped
  // e.n=["Hemlock"] stop matching once that key is deleted from memory.npcs (the t198
  // broadsheet regression: the origin scene went invisible after the user's Hemlock merges).
  // resolveNpcName bridges them (the merge registered the duplicate as an alias); memoized —
  // resolveNpcName scans all NPC keys and a mature transcript re-checks the same few names.
  var _res={};
  function _resolveIdx(nm){if(_res[nm]===undefined)_res[nm]=resolveNpcName(nm);return _res[nm];}
  for(i=0;i<elig.length;i++){
    var en=elig[i].en;
    var sc=0,seenG={};
    for(j=0;j<en.e.n.length;j++){
      var enNm=en.e.n[j];
      if(!w[enNm]){var rn=_resolveIdx(enNm);if(!w[rn])continue;enNm=rn;}
      var root=gRoot[enNm]||enNm;
      if(seenG[root])continue; // one score per person, however many duplicate keys an entry carries
      seenG[root]=1;
      sc+=w[enNm];
    }
    if(q.loc&&en.e.l===q.loc)sc+=2;
    for(j=0;j<(en.e.q||[]).length;j++){if(qws[en.e.q[j].toLowerCase()])sc+=1;}
    if(sc>0){
      var lex=0;
      for(j=0;j<terms.length;j++){if(elig[i].hits[j])lex+=Math.log((N+1)/(df[j]+1));}
      sc+=Math.min(8,lex*1.5);
    }
    if(sc>0)cands.push({i:elig[i].i,t:en.t,sc:sc});
  }
  if(!cands.length)return "";
  // Ties break toward the OLDEST entry — for episodic recall the origin scene (where a thing
  // was first said/done) beats its later echoes, and the proximity dedupe below then drops
  // the echoes instead of the origin.
  cands.sort(function(a,b){return b.sc-a.sc||a.t-b.t;});
  ragRetrieve._cands=cands.slice(0,12); // introspection hook for forensics/tuning (no runtime cost)
  // Proximity dedupe: adjacent turns are usually one scene, so don't spend two slots on
  // filler — BUT a neighbor scoring near-par with the picked entry likely holds the other
  // half of the answer (Q&A exchanges span turns; the t164 broadsheet quiz), so near-equals
  // survive and only clearly-weaker neighbors are dropped.
  var picked=[],pi,pj;
  for(pi=0;pi<cands.length&&picked.length<RAG_MAX;pi++){
    var apart=true;
    for(pj=0;pj<picked.length;pj++){
      if(Math.abs(picked[pj].t-cands[pi].t)<3&&cands[pi].sc<picked[pj].sc*0.75){apart=false;break;}
    }
    if(apart)picked.push(cands[pi]);
  }
  picked.sort(function(a,b){return a.t-b.t;});
  var out=[],used=0;
  for(pi=0;pi<picked.length;pi++){
    var g=tr[picked[pi].i];
    var p=picked[pi].i>0&&tr[picked[pi].i-1].r==="player"?tr[picked[pi].i-1]:null;
    var block="[Turn "+g.t+(g.e&&g.e.l?" — "+g.e.l:"")+"]"+(p?"\nPlayer: "+ragTrim(p.x,150):"")+"\nGM: "+ragTrim(g.x,700);
    if(used+block.length>RAG_BUDGET)break;
    out.push(block);used+=block.length;
  }
  if(!out.length)return "";
  return "PAST SCENE EXCERPTS — verbatim moments from earlier in this campaign, retrieved because they involve the people, places, or quests in the current scene. This is HISTORY (oldest first): attitudes, alliances, locations, and stakes may have CHANGED since — the CURRENT state blocks above are the truth and override anything here. Use these for continuity only: exact wording of promises, shared history, callbacks.\n"+out.join("\n")+"\n\n";
}
function memoryTOC(){
  var lines=[],i;
  // RAG flag ON puts the TOC on a diet (same flag as retrieval — RAG_MEMORY.md §3.4):
  // lore filtered to scene-relevant + the most recent 8 (cap 12), and the CHAPTER SUMMARIES
  // section dropped (it duplicates the STORY SO FAR block, which injects the last 8
  // eventHistory summaries every turn anyway). Flag OFF must produce today's output
  // byte-for-byte — enforced by an engine test; do not restructure the off-path strings.
  var _diet=typeof ragEnabled==="function"&&ragEnabled();
  // B3: dead NPCs stay listed (they're still known) but carry the marker — an unannotated name
  // read as alive. No dead NPCs → byte-identical to the pre-B3 line (the flag-off TOC contract).
  var nk=Object.keys(memory.npcs);if(nk.length){var _nkS=[],_nki;for(_nki=0;_nki<nk.length;_nki++)_nkS.push(memory.npcs[nk[_nki]]&&memory.npcs[nk[_nki]].dead?nk[_nki]+" (dead)":nk[_nki]);lines.push("KNOWN NPCs: "+_nkS.join(", "));}
  // P9 (audit): blueprint import pre-files every location, so a flat "VISITED:" line told
  // the GM the party had already been to end-game sites (familiarity/spoiler drift). Split
  // on the map node's visit count; entries with NO node data are legacy saves — keep them
  // VISITED so old campaigns don't change behavior. Intentional change to BOTH rag paths.
  var lk=Object.keys(memory.locations);
  if(lk.length){
    var _vis=[],_known=[],_vk;
    for(_vk=0;_vk<lk.length;_vk++){
      var _vn=memory.map&&memory.map.nodes?memory.map.nodes[lk[_vk]]:null;
      if(_vn&&!(_vn.visits>0))_known.push(lk[_vk]);else _vis.push(lk[_vk]);
    }
    if(_vis.length)lines.push("VISITED: "+_vis.join(", "));
    if(_known.length)lines.push("KNOWN OF (not yet visited): "+_known.join(", "));
  }
  var fe=memory.futureEvents.filter(function(e){return !e.resolved;}).slice(-8);
  if(fe.length){var fs=[];for(i=0;i<fe.length;i++)fs.push(fe[i].what+" ("+fe[i].when+")");lines.push("PENDING EVENTS: "+fs.join("; "));}
  if(memory.lore.length){
    if(!_diet)lines.push("LORE: "+memory.lore.join("; "));
    else{
      var terms=ragSceneTerms(typeof lastAction==="string"&&lastAction?lastAction:"");
      var kept=[],cut=memory.lore.length-8;
      for(i=0;i<memory.lore.length;i++){
        var ll=String(memory.lore[i]).toLowerCase(),hit=(i>=cut),ti;
        for(ti=0;!hit&&ti<terms.length;ti++){if(ll.indexOf(terms[ti])>=0)hit=true;}
        if(hit)kept.push(memory.lore[i]);
      }
      if(kept.length>12)kept=kept.slice(-12);
      if(kept.length===memory.lore.length)lines.push("LORE: "+kept.join("; "));
      else lines.push("LORE (scene-relevant + recent, "+kept.length+" of "+memory.lore.length+"): "+kept.join("; "));
    }
  }
  if(memory.keyDecisions.length){var d=memory.keyDecisions.slice(-5),ds=[];for(i=0;i<d.length;i++)ds.push("[T"+d[i].turn+"] "+d[i].desc);lines.push("RECENT DECISIONS: "+ds.join("; "));}
  if(memory.chapters.length&&!_diet){var ch=memory.chapters.slice(-3),cs2=[];for(i=0;i<ch.length;i++)cs2.push(ch[i].summary);lines.push("CHAPTER SUMMARIES:\n"+cs2.join("\n"));}
  return lines.join("\n");
}
function memoryNpcDetail(name){var n=memory.npcs[name];if(!n)return"";var akaStr=n.aliases&&n.aliases.length?" (aka: "+n.aliases.join(", ")+")":"";var lines=[name+akaStr+(n.pronouns?" ["+n.pronouns+"]":"")+(n.dead?" — DECEASED"+(typeof n.dead==="number"?" (died t"+n.dead+")":""):"")+(n.attitude?": "+n.attitude:"")],i;/* v1.372: attitude is summarizer-owned and may be legitimately empty — don't render a dangling ": " *//* B3: the detail block must carry the death — it fires on any mention */if(n.knowledge.length){var _kn=n.knowledge.join("; ");if(_kn.length>2000)_kn=_kn.slice(0,2000)+" …[truncated]";/* P8: one verbose blueprint bio must not blow up the volatile prompt */lines.push("  Knows: "+_kn);}if(n.events.length){var ev=[];for(i=0;i<n.events.length;i++)ev.push("[T"+n.events[i].turn+"] "+n.events[i].note);lines.push("  History: "+ev.join("; "));}if(n.firstEncounter)lines.push("  First met: "+n.firstEncounter);return lines.join("\n");}
function npcLinkUpsert(nameA, nameB, rel){
  if(!memory.npcGraph)memory.npcGraph={edges:[]};
  var edges=memory.npcGraph.edges,i;
  for(i=0;i<edges.length;i++){
    if((edges[i].a===nameA&&edges[i].b===nameB)||(edges[i].a===nameB&&edges[i].b===nameA)){
      edges[i].rel=rel;edges[i].turn=worldState.turn;return;
    }
  }
  edges.push({a:nameA,b:nameB,rel:rel,turn:worldState.turn});
}
function buildNpcGraph(){
  if(!memory.npcGraph||!memory.npcGraph.edges.length)return"";
  var edges=memory.npcGraph.edges;
  var player=worldState.character.name;
  // Build adjacency: node → [{other, rel, turn}]
  var adj={};
  function addAdj(from,to,rel,turn){if(!adj[from])adj[from]=[];adj[from].push({other:to,rel:rel,turn:turn});}
  for(var i=0;i<edges.length;i++){
    addAdj(edges[i].a,edges[i].b,edges[i].rel,edges[i].turn);
    addAdj(edges[i].b,edges[i].a,edges[i].rel,edges[i].turn);
  }
  // Player→NPC from character.relationships
  var rels=worldState.character.relationships||[];
  for(var ri=0;ri<rels.length;ri++){
    addAdj(player,rels[ri].entity,rels[ri].descriptor,0);
  }
  var nodes=Object.keys(adj);
  if(!nodes.length)return"";
  var lines=["NPC GRAPH:"];
  // Player row first if has connections
  if(adj[player]){
    var plinks=adj[player].map(function(e){return e.other+"("+e.rel+")";}).join(", ");
    lines.push(player+" [PLAYER]: "+plinks);
  }
  // NPC rows
  for(var ni=0;ni<nodes.length;ni++){
    var name=nodes[ni];
    if(name===player)continue;
    var npc=memory.npcs[name]||{};
    var wsNpc=wsNpcByName(name);/* #7: shared lookup */
    var meta=[];
    if(npc.attitude)meta.push(npc.attitude);
    if(wsNpc&&wsNpc.partyMember)meta.push("PARTY");
    if(npc.dead)meta.push("DECEASED");/* B3 */
    if(npc.lastSeenAt)meta.push("last:"+npc.lastSeenAt);
    var header=name+(meta.length?" ("+meta.join(", ")+")":"");
    var links=adj[name].map(function(e){return e.other+"("+e.rel+")"+(e.turn?" [T"+e.turn+"]":"");}).join("  ↔ ");
    lines.push(header+": ↔ "+links);
  }
  // Factions
  var facs=memory.npcGraph.factions||{};var facNames=Object.keys(facs);
  if(facNames.length){
    lines.push("FACTIONS:");
    for(var fi=0;fi<facNames.length;fi++){
      var fn=facNames[fi],fd=facs[fn];
      var fmems=[];var nfMap=memory.npcGraph.npcFactions||{};var nfKeys=Object.keys(nfMap);
      for(var nfk=0;nfk<nfKeys.length;nfk++){var entries=nfMap[nfKeys[nfk]];for(var ej=0;ej<entries.length;ej++){if(entries[ej].faction===fn)fmems.push(nfKeys[nfk]+(entries[ej].role?" ["+entries[ej].role+"]":""));}}
      lines.push("  "+fn+(fd.desc?" -- "+fd.desc:"")+(fmems.length?" | Members: "+fmems.join(", "):""));
    }
    var feEdges=memory.npcGraph.factionEdges||[];
    for(var fe=0;fe<feEdges.length;fe++)lines.push("  "+feEdges[fe].a+" ↔ "+feEdges[fe].b+": "+feEdges[fe].rel);
  }
  // NPC faction membership for non-faction-member NPCs already listed above
  var nfMap2=memory.npcGraph.npcFactions||{};var nfk2=Object.keys(nfMap2);
  for(var ni2=0;ni2<nfk2.length;ni2++){
    var npcN=nfk2[ni2],entries2=nfMap2[npcN];if(!entries2.length)continue;
    if(adj[npcN])continue; // already shown above with links
    lines.push(npcN+": "+entries2.map(function(e){return e.faction+(e.role?" ["+e.role+"]":"");}).join(", "));
  }
  return lines.join("\n")+"\n\n";
}
function factionUpsert(name,desc){
  if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
  if(!memory.npcGraph.factions)memory.npcGraph.factions={};
  var turn=worldState?worldState.turn:0;
  if(!memory.npcGraph.factions[name])memory.npcGraph.factions[name]={desc:desc||"",turn:turn};
  else if(desc)memory.npcGraph.factions[name].desc=desc;
}
function npcFactionSet(npcName,factionName,role){
  if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
  if(!memory.npcGraph.npcFactions)memory.npcGraph.npcFactions={};
  var turn=worldState?worldState.turn:0;
  if(!memory.npcGraph.npcFactions[npcName])memory.npcGraph.npcFactions[npcName]=[];
  var entries=memory.npcGraph.npcFactions[npcName],i;
  for(i=0;i<entries.length;i++){if(entries[i].faction===factionName){entries[i].role=role||entries[i].role;entries[i].turn=turn;return;}}
  entries.push({faction:factionName,role:role||"",turn:turn});
  // Auto-register faction if not known
  if(!memory.npcGraph.factions)memory.npcGraph.factions={};
  if(!memory.npcGraph.factions[factionName])memory.npcGraph.factions[factionName]={desc:"",turn:turn};
}
function factionLinkUpsert(facA,facB,rel){
  if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
  if(!memory.npcGraph.factionEdges)memory.npcGraph.factionEdges=[];
  var turn=worldState?worldState.turn:0,i,edges=memory.npcGraph.factionEdges;
  for(i=0;i<edges.length;i++){if((edges[i].a===facA&&edges[i].b===facB)||(edges[i].a===facB&&edges[i].b===facA)){edges[i].rel=rel;edges[i].turn=turn;return;}}
  edges.push({a:facA,b:facB,rel:rel,turn:turn});
}
// ── #28 summarize-tail retention ───────────────────────────────────────────────
// summarize() used to clear sessionLog to ZERO, so in mature campaigns (where it fires every
// ~2 exchanges) the GM's verbatim window was ~2 turns deep and object-level facts evaporated
// at every boundary — the GM then confabulated recalls (the t160 pin-grab incident). Now a
// short tail of the just-summarized exchanges stays in sessionLog as live context, and
// worldState.sessKept marks how many leading messages a past extraction already covered:
// sessionTokens() counts only what's PAST the marker (the retained tail can't re-trip
// SUMMARIZE_AT — no thrash) and summarize() extracts only from the marker on (no exchange
// is ever filed to memory twice). Extraction richness itself is unchanged (read-side only).
function sessKeptStart(){
  var k=(typeof worldState!=="undefined"&&worldState&&worldState.sessKept)||0;
  return (k>0&&k<=sessionLog.length)?k:0; // stale marker (import/clear/re-roll) fails safe: recount everything
}
function retainSessionTail(){
  var keep=[],tok=0,i=sessionLog.length;
  while(i>=2&&keep.length/2<SUMMARY_KEEP_EX){
    var u=sessionLog[i-2],a=sessionLog[i-1];
    var pairTok=Math.ceil((u.content.length+a.content.length)/4);
    if(keep.length&&tok+pairTok>SUMMARY_KEEP_TOK)break; // newest pair always kept; older pairs only within budget
    keep.unshift(u,a);tok+=pairTok;i-=2;
  }
  sessionLog=keep;
  if(typeof worldState!=="undefined"&&worldState)worldState.sessKept=keep.length;
}
function sessionTokens(){var total=0,i;for(i=sessKeptStart();i<sessionLog.length;i++)total+=sessionLog[i].content.length;return Math.ceil(total/4);}
// ── #57 reveal-commitment: knowledge supersession + fork hints ───────────────────
// Serve-side of leg A (see DOC/todo_57_reveal_commitment.md): the extractor can only retire a
// fact it can quote EXACTLY, so summarize() hands it the on-file knowledge lines for the NPCs
// this window actually mentions (ragScanNames — the same deterministic detection the RAG index
// uses). Also names the detected keys explicitly so sameNpc proposals use exact-key vocabulary.
// Budget-capped: a truncated list is flagged so the extractor knows it is partial.
var RECORDED_FACTS_BUDGET=2000;
function buildRecordedFactsBlock(windowText){
  if(typeof memory==="undefined"||!memory||!memory.npcs)return"";
  var low=String(windowText||"").toLowerCase();if(!low)return"";
  var det=[];
  ragScanNames(low,ragKnownNames(),function(nm){if(det.indexOf(nm)<0)det.push(nm);});
  if(!det.length)return"";
  var lines=[],used=0,truncated=false,i,j;
  for(i=0;i<det.length&&!truncated;i++){
    var n=memory.npcs[det[i]];
    if(!n||!n.knowledge||!n.knowledge.length)continue;
    for(j=0;j<n.knowledge.length;j++){
      var ln="- "+det[i]+": "+n.knowledge[j];
      if(used+ln.length>RECORDED_FACTS_BUDGET){truncated=true;break;}
      lines.push(ln);used+=ln.length+1;
    }
  }
  var out="\nPEOPLE ON FILE mentioned in this session: "+det.join(", ")+"\n";
  if(lines.length)out+="RECORDED FACTS on file for them"+(truncated?" (list truncated)":"")+" -- if this session REVEALS one of these is now wrong, outdated, or superseded (an identity confirmed, a secret exposed, a belief corrected), copy its EXACT text into supersededFacts 'old' with the replacement fact in 'new'. Only report what this session's events actually establish.\n"+lines.join("\n")+"\n";
  out+="If this session CONFIRMS that two of the people on file are the SAME person, report the pair in sameNpc using their exact names from the list above.\n";
  return out;
}
// Audit #10 (AUDIT_FABLE_07_16_2026): the chapter-filing block existed TWICE — in
// applySummaryExtract below and in the degraded-summarize fallback inside summarize()'s catch —
// so a cap/archive change edited in one place silently forked the P12 discipline. ONE routine
// now, byte-identical to both former inline copies: push {turn,summary} → cap-10 shift routing
// the evicted chapter to memory.archive via memArchive() (never vanishes) → eventHistory
// "[T<turn>] <summary>" push → cap-8 shift.
function fileChapter(turn,summary){
  memory.chapters.push({turn:turn,summary:summary});
  if(memory.chapters.length>10)memArchive().chapters.push(memory.chapters.shift());
  worldState.eventHistory.push("[T"+turn+"] "+summary);
  if(worldState.eventHistory.length>8)worldState.eventHistory.shift();
}
// Files one extraction result into memory/worldState — split from summarize() so the filing
// rules (the #29 resolve→expire→file order, near-dup dedupe) are testable without an API call.
// Returns a stats object ({superseded, supersededNames}) so summarize() can surface what was
// retired in the visible "Memory updated" line (#57 — no silent memory surgery).
function applySummaryExtract(extracted){
  var i;
  var stats={superseded:0,supersededNames:[]};
  // #57 leg A: supersession BEFORE npcUpdates, so a same-window retire-then-learn lands in order.
  // Replacement is REQUIRED (user-ratified fork 3): supersession is replacement, never bare
  // deletion — that stays NPC_FORGET's job. Only an on-file fact can be retired (exact match,
  // then substring — the resolveFutureEvent discipline); retired facts ARCHIVE, never vanish.
  if(Array.isArray(extracted.supersededFacts)){for(i=0;i<extracted.supersededFacts.length;i++){var sf=extracted.supersededFacts[i];
    if(!sf||!sf.name||!sf.old||!sf["new"])continue;
    var sfName=resolveNpcName(String(sf.name)),sfNpc=memory.npcs[sfName];
    if(!sfNpc||!sfNpc.knowledge||!sfNpc.knowledge.length){if(typeof console!=="undefined")console.warn("[memory] supersede: no knowledge on file for "+sfName+" — ignored");continue;}
    var oldS=String(sf.old),sfIdx=-1,ki;
    for(ki=0;ki<sfNpc.knowledge.length;ki++){if(String(sfNpc.knowledge[ki])===oldS){sfIdx=ki;break;}}
    if(sfIdx<0){for(ki=0;ki<sfNpc.knowledge.length;ki++){if(String(sfNpc.knowledge[ki]).indexOf(oldS)>=0){sfIdx=ki;break;}}}
    if(sfIdx<0){if(typeof console!=="undefined")console.warn("[memory] supersede: no on-file fact on "+sfName+" matches \""+oldS.slice(0,80)+"\" — ignored (the extractor can only retire what exists)");continue;}
    var retired=sfNpc.knowledge.splice(sfIdx,1)[0];
    memArchive().superseded.push({npc:sfName,fact:retired,turn:worldState.turn,replacedBy:String(sf["new"])});
    var newFact=String(sf["new"]);
    if(sfNpc.knowledge.indexOf(newFact)<0){sfNpc.knowledge.push(newFact);if(sfNpc.knowledge.length>12)sfNpc.knowledge.shift();}
    stats.superseded++;if(stats.supersededNames.indexOf(sfName)<0)stats.supersededNames.push(sfName);
    if(typeof console!=="undefined")console.warn("[memory] superseded fact on "+sfName+": \""+String(retired).slice(0,80)+"\" → \""+newFact.slice(0,80)+"\"");
  }}
  // #57 leg C: the extractor PROPOSES same-person pairs; the engine NEVER auto-merges (a wrong
  // merge fuses two real people — UA29's E4 hazard). Validated hints queue for
  // buildMergeConfirmNudge (api.js), which asks the GM to confirm via [NPC_MERGE:] in-fiction.
  if(Array.isArray(extracted.sameNpc)){
    var _isParty=function(nm){var wi;for(wi=0;wi<((worldState&&worldState.npcs)||[]).length;wi++){if(worldState.npcs[wi].name===nm&&worldState.npcs[wi].partyMember)return true;}return false;};
    for(i=0;i<extracted.sameNpc.length;i++){var sn=extracted.sameNpc[i];
      if(!sn||!sn.canonical||!sn.duplicate)continue;
      var snC=resolveNpcName(String(sn.canonical)),snD=resolveNpcName(String(sn.duplicate));
      if(snC===snD)continue;/* already one entry — nothing to heal */
      if(!memory.npcs[snC]||!memory.npcs[snD]){if(typeof console!=="undefined")console.warn("[memory] sameNpc hint dropped — not both on file: "+snC+" / "+snD);continue;}
      var _plNm=(worldState&&worldState.character&&worldState.character.name)||"";
      if(_plNm&&(snC.toLowerCase()===_plNm.toLowerCase()||snD.toLowerCase()===_plNm.toLowerCase())){if(typeof console!=="undefined")console.warn("[memory] sameNpc hint dropped — names the player: "+snC+" / "+snD);continue;}
      if(_isParty(snC)&&_isParty(snD)){if(typeof console!=="undefined")console.warn("[memory] sameNpc hint dropped — both are party members: "+snC+" / "+snD);continue;}
      if(worldState.mergeHintNudged&&(worldState.mergeHintNudged[snC+"|"+snD]||worldState.mergeHintNudged[snD+"|"+snC]))continue;/* already asked once — the GM declined or acted */
      if(!worldState.pendingMergeHints)worldState.pendingMergeHints=[];
      var _dupH=false,mi;for(mi=0;mi<worldState.pendingMergeHints.length;mi++){var _h=worldState.pendingMergeHints[mi];if((_h.canonical===snC&&_h.duplicate===snD)||(_h.canonical===snD&&_h.duplicate===snC)){_dupH=true;break;}}
      if(!_dupH)worldState.pendingMergeHints.push({canonical:snC,duplicate:snD,turn:worldState.turn});
    }
  }
  // B3 backstop: deaths the GM narrated but never tagged (the docks class — the kill that spawned
  // this bug left ZERO structured record). Only stamps NPCs already ON FILE — the extractor must
  // never mint a corpse the world doesn't know; a wrong stamp is loud, visible (DECEASED line),
  // and reversible via [NPC:name|resurrected|...].
  if(Array.isArray(extracted.npcDeaths)){for(i=0;i<extracted.npcDeaths.length;i++){var nd=extracted.npcDeaths[i];if(!nd)continue;
    var ndName=resolveNpcName(String(nd)),ndWs=(typeof wsNpcByName==="function")?wsNpcByName(ndName):null;
    if(!ndWs&&!memory.npcs[ndName]){if(typeof console!=="undefined")console.warn("[memory] npcDeaths: "+ndName+" not on file — ignored");continue;}
    if((ndWs&&ndWs.dead)||(memory.npcs[ndName]&&memory.npcs[ndName].dead))continue;
    if(ndWs){ndWs.dead=worldState.turn;if(!npcDeadStatus(ndWs.status))ndWs.status="dead";}
    if(memory.npcs[ndName])memory.npcs[ndName].dead=worldState.turn;
    if(typeof console!=="undefined")console.warn("[memory] death filed from summary extraction: "+ndName+" (t"+worldState.turn+") — the GM narrated a death without [NPC:"+ndName+"|dead|...]");
  }}
  // Array-guard every list field (audit E43) — a string value from the extractor would otherwise
  // iterate per-character, filing junk lore/decisions or mass-deleting pending events.
  // Route extractor names through resolveNpcName — the extractor freely returns variants
  // ("Morwen (Ammut's wife)"), which forked NPCs exactly the way the v1.143 tag fix prevents (audit #6).
  if(Array.isArray(extracted.npcUpdates)){for(i=0;i<extracted.npcUpdates.length;i++){var nu=extracted.npcUpdates[i];if(nu&&nu.name){var nuName=resolveNpcName(nu.name);if(!memory.npcs[nuName])memory.npcs[nuName]={attitude:"",knowledge:[],events:[],aliases:[]};if(nu.attitude)memory.npcs[nuName].attitude=clampNpcMood(nu.attitude);if(nu.knowledgeGained){var _kg=memory.npcs[nuName].knowledge;if(_kg.indexOf(nu.knowledgeGained)<0){_kg.push(nu.knowledgeGained);if(_kg.length>12)_kg.shift();}}}}}/* dedupe + cap knowledge so ACTIVE NPC DETAILS can't grow unbounded (audit E51) */
  if(Array.isArray(extracted.loreDiscovered)){for(i=0;i<extracted.loreDiscovered.length;i++)fileLore(extracted.loreDiscovered[i]);}
  if(Array.isArray(extracted.decisionsMade)){for(i=0;i<extracted.decisionsMade.length;i++)fileDecision(worldState.turn,extracted.decisionsMade[i]);}
  // #29 order matters: sweep stale → file new → resolve LAST. Resolving last means an event the
  // extractor lists in BOTH futureEvents and resolvedEvents (set and finished inside one window)
  // nets out removed — the near-dup filing collapses it onto the existing entry, then resolve
  // deletes it. Resolve-first would delete then re-file it as fresh pending.
  expireFutureEvents();
  if(Array.isArray(extracted.futureEvents)){for(i=0;i<extracted.futureEvents.length;i++){var fe=extracted.futureEvents[i];if(fe&&fe.what)fileFutureEvent(fe.when||"soon","",fe.what,worldState.turn);}}
  if(Array.isArray(extracted.resolvedEvents)){for(i=0;i<extracted.resolvedEvents.length;i++)resolveFutureEvent(extracted.resolvedEvents[i]);}
  // Chapter filed LAST (audit E46) so a throw in an earlier step can't leave a duplicated chapter
  // when summarize retries the same window.
  if(extracted.chapterSummary)fileChapter(worldState.turn,extracted.chapterSummary);
  return stats;
}
var _sumFails=0; // consecutive summarize() failures; the log is only discarded after 3 (audit #5)
async function summarize(){
  if(sessionTokens()<SUMMARIZE_AT)return;
  addMsg("system","Filing memories...");
  try{
    var _sumVc="";var _sumPaId=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:"";if(_sumPaId&&typeof AUTHORS!=="undefined"){var _spi;for(_spi=0;_spi<AUTHORS.length;_spi++){if(AUTHORS[_spi].id===_sumPaId&&AUTHORS[_spi].vc){_sumVc=AUTHORS[_spi].vc;break;}}}
    var _chapterDesc=_sumVc?"5-8 sentence narrative summary written in this prose voice — "+_sumVc:"5-8 sentence narrative summary";
    var extractPrompt="Extract structured data from this RPG session. Output ONLY valid JSON, no markdown:\n{\"chapterSummary\":\""+_chapterDesc+"\",\"npcUpdates\":[{\"name\":\"\",\"attitude\":\"2-4 word mood, NOT a sentence\",\"knowledgeGained\":\"\"}],\"loreDiscovered\":[\"string\"],\"decisionsMade\":[\"string\"],\"futureEvents\":[{\"what\":\"\",\"when\":\"\"}],\"resolvedEvents\":[\"string\"],\"supersededFacts\":[{\"name\":\"\",\"old\":\"exact text of the outdated recorded fact\",\"new\":\"the fact that replaces it\"}],\"sameNpc\":[{\"canonical\":\"\",\"duplicate\":\"\"}],\"npcDeaths\":[\"exact name of each named character who DIED in these events -- only unambiguous, on-screen deaths; empty if none\"]}\n";
    // #29 ③: the extractor reads the session anyway — hand it the pending list and let it echo back
    // what the session shows is finished. EXACT text echo, so resolveFutureEvent's exact/substring
    // match lands without fuzzy matching. The GM itself rarely emits [FUTURE_EVENT_RESOLVED:].
    var _pend=[],_pi;for(_pi=0;_pi<memory.futureEvents.length;_pi++){if(!memory.futureEvents[_pi].resolved)_pend.push(memory.futureEvents[_pi].what);}
    if(_pend.length)extractPrompt+="\nANTICIPATED EVENTS currently on file — if this session shows one has already happened, failed, or become moot, copy its EXACT text into resolvedEvents:\n- "+_pend.join("\n- ")+"\n";
    // GM turns carry the events — send them near-whole (a 1000-token turn is ~4000 chars; the old
    // 300-char slice fed the extractor only scene openings, silently dropping mid/late-scene events
    // from long-term memory — audit #3). Player turns are short; trim them lightly.
    // Built BEFORE appending so the same window text also drives RECORDED FACTS detection (#57).
    var _sessTxt="",i;for(i=sessKeptStart();i<sessionLog.length;i++){var _se=sessionLog[i];_sessTxt+=_se.role+": "+_se.content.slice(0,_se.role==="assistant"?4000:500)+"\n";}
    extractPrompt+=buildRecordedFactsBlock(_sessTxt);/* #57 leg A serve-side — "" when no known NPC appears in the window */
    extractPrompt+="\nSESSION:\n"+_sessTxt;
    var resp=await callGM(extractPrompt,"You are a data extraction system. Output ONLY valid JSON. No prose, no markdown, no backticks.",2000,null,{kind:"summarize",noHistory:true});/* the extraction prompt already contains the session slice — don't also prepend the full sessionLog (audit E47) */
    var extracted=JSON.parse(repairModelJson(resp)); // shared cleanup (api.js) — also fixes trailing-comma/preamble failures that used to burn a retry
    var _exStats=applySummaryExtract(extracted);
    retainSessionTail();_sumFails=0;saveMem();saveCore();addMsg("system","Memory updated: "+Object.keys(memory.npcs).length+" NPCs, "+memory.lore.length+" lore, "+memory.chapters.length+" chapters."+(_exStats&&_exStats.superseded?" "+_exStats.superseded+" outdated fact"+(_exStats.superseded>1?"s":"")+" superseded ("+_exStats.supersededNames.join(", ")+").":""));
  }catch(e){
    // Do NOT discard the session log on a transient failure — that permanently erased up to a
    // chapter's worth of events from long-term memory (audit #5). Keep it and retry next turn;
    // only after 3 consecutive failures archive the raw text as a degraded chapter and clear.
    _sumFails++;
    if(typeof reportError==="function")reportError("summarize",e&&e.message?e.message:"unknown","consecutive fails: "+_sumFails+"\n"+((e&&e.stack)||""));/* #16 */
    if(_sumFails>=3){
      var _rawBits=[],_ri;for(_ri=sessKeptStart();_ri<sessionLog.length;_ri++){if(sessionLog[_ri].role==="assistant")_rawBits.push(sessionLog[_ri].content.slice(0,200));}
      var _rawSum="(summary failed; raw excerpt) "+_rawBits.join(" … ").slice(0,900);
      fileChapter(worldState.turn,_rawSum);/* audit #10: same routine as applySummaryExtract — the P12 cap/archive discipline cannot fork */
      retainSessionTail();_sumFails=0;saveMem();saveCore();addMsg("system","Memory saved (raw).");
    }else{
      addMsg("system","Memory filing failed ("+(e&&e.message?e.message:"unknown")+") — will retry next turn.");
    }
  }
}
