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

// ── #128: deterministic name-variant scan → the #57 merge-confirm channel ──────────────────
// Field case: 61 memory keys for 36 NPCs at t1265 — Hemlock alone under four spellings, each
// with its own split history. The consolidation above only helps an UNREGISTERED incoming name;
// once variant KEYS exist, nothing drained them (the extractor's sameNpc proposals fire rarely).
// This scan proposes containment pairs through the SAME GM-confirmed [NPC_MERGE:] queue —
// it never auto-merges (a wrong merge fuses two real people, UA29's E4 hazard).
//
// Tokenizer note (deliberate): this does NOT reuse npcCoreTokens. That stripper drops role
// nouns (man/woman/stranger/guard…), which is safe for resolve-time consolidation only because
// of its exactly-one-candidate guard on an unregistered name — at PROPOSAL time those words are
// identity-bearing ("The Scarred Man" vs "The Scarred Woman" must never read as equal).
// Here only articles/conjunctions and parenthetical descriptors are identity-neutral.
var _VARIANT_STOP={the:1,a:1,an:1,of:1,and:1,or:1};
function npcVariantTokens(name){
  var s=String(name||"").toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9\s']/g," ");
  var raw=s.split(/\s+/),out=[],i;
  for(i=0;i<raw.length;i++){var w=raw[i].replace(/'s$/,"").replace(/'/g,"");if(w&&!_VARIANT_STOP[w])out.push(w);}
  return out;
}
// Pure pair proposer over a list of names. Rules, conservative by construction:
//   • strict containment (tokens(A) ⊂ tokens(B)) proposes A → the FULLEST superset — but only
//     when every superset of A agrees with it (a bare "Perdrath" matching two different sisters
//     is ambiguous and proposes nothing, loudly);
//   • equal token sets (parenthetical-only variants) propose once, paren-free name as canonical
//     (longer raw name on a tie); two or more equal mates = ambiguous, skip;
//   • a name whose tokens are empty or all-short (<3 chars) proposes nothing.
function npcVariantPairs(names){
  var sets=[],i,j,ti;
  for(i=0;i<names.length;i++){
    var tk=npcVariantTokens(names[i]),set={},n=0,sub=false;
    for(ti=0;ti<tk.length;ti++){if(!set[tk[ti]]){set[tk[ti]]=1;n++;}if(tk[ti].length>=3)sub=true;}
    sets.push({name:names[i],set:set,n:n,ok:n>0&&sub});
  }
  function isSubset(a,b){if(a.n>b.n)return false;var k;for(k in a.set){if(!b.set[k])return false;}return true;}
  var pairs=[];
  for(i=0;i<sets.length;i++){
    var A=sets[i];if(!A.ok)continue;
    var sup=[],eq=[],eqIdx=-1;
    for(j=0;j<sets.length;j++){
      if(i===j)continue;var B=sets[j];if(!B.ok)continue;
      if(A.n<B.n&&isSubset(A,B))sup.push(B);
      else if(A.n===B.n&&isSubset(A,B)){eq.push(B);eqIdx=j;}
    }
    if(sup.length){
      var F=sup[0],si;
      for(si=1;si<sup.length;si++){if(sup[si].n>F.n||(sup[si].n===F.n&&sup[si].name.length>F.name.length))F=sup[si];}
      var amb=false;
      for(si=0;si<sup.length;si++){if(!isSubset(sup[si],F)){amb=true;break;}}
      if(amb){if(typeof console!=="undefined")console.info("[memory] variant scan: \""+A.name+"\" matches multiple distinct fuller names — ambiguous, not proposed (#128)");continue;}
      pairs.push({canonical:F.name,duplicate:A.name});
    }else if(eq.length===1&&i<eqIdx){
      var B2=eq[0],aP=/\(/.test(A.name),bP=/\(/.test(B2.name),canonN,dupN;
      if(aP!==bP){canonN=aP?B2.name:A.name;dupN=aP?A.name:B2.name;}
      else if(A.name.length>=B2.name.length){canonN=A.name;dupN=B2.name;}
      else{canonN=B2.name;dupN=A.name;}
      pairs.push({canonical:canonN,duplicate:dupN});
    }else if(eq.length>1){
      if(typeof console!=="undefined")console.info("[memory] variant scan: \""+A.name+"\" has multiple equal-name mates — ambiguous, not proposed (#128)");
    }
  }
  return pairs;
}
// Shared queue discipline for BOTH producers (the extractor's sameNpc hints and the scan):
// once-per-pair-ever latch (worldState.mergeHintNudged, stamped at nudge-build time) checked in
// both orders, dedupe against the pending queue, then push. Returns true when queued.
function _queueMergeHint(cn,dn){
  if(worldState.mergeHintNudged&&(worldState.mergeHintNudged[cn+"|"+dn]||worldState.mergeHintNudged[dn+"|"+cn]))return false;
  if(!worldState.pendingMergeHints)worldState.pendingMergeHints=[];
  var mi;for(mi=0;mi<worldState.pendingMergeHints.length;mi++){var _h=worldState.pendingMergeHints[mi];if((_h.canonical===cn&&_h.duplicate===dn)||(_h.canonical===dn&&_h.duplicate===cn))return false;}
  worldState.pendingMergeHints.push({canonical:cn,duplicate:dn,turn:worldState.turn});
  return true;
}
// The scan itself — runs from applySummaryExtract (summarize cadence: that's when new keys land
// in bulk, and one nudge per turn drains the queue anyway). Skips alias-linked pairs (already
// one person to every consumer), the player's own name, and both-party pairs; when exactly one
// side is a party member it becomes the canonical so a companion is never absorbed under a
// variant display name (the merge handler carries sheets/portraits either way — this is naming).
function scanNpcNameVariants(){
  if(typeof worldState==="undefined"||!worldState||!memory.npcs)return 0;
  var names=Object.keys(memory.npcs);
  if(names.length<2)return 0;
  var pairs=npcVariantPairs(names),added=0,i;
  var plNm=((worldState.character&&worldState.character.name)||"").toLowerCase();
  for(i=0;i<pairs.length;i++){
    var cn=pairs[i].canonical,dn=pairs[i].duplicate;
    /* #156: provisional identities NEVER enter this queue — "Savah °t1530" token-contains
       "Savah" by construction, so the scan would propose exactly the merge the provisional
       exists to gate, through a channel with no same/distinct fork (dueling nudges). The
       provisional's own nudge (buildProvisionalNudge) owns that decision. */
    if(npcIsProvisional(cn)||npcIsProvisional(dn))continue;
    if(resolveNpcName(cn)===resolveNpcName(dn))continue;
    if(plNm&&(cn.toLowerCase()===plNm||dn.toLowerCase()===plNm))continue;
    var cw=(typeof wsNpcByName==="function")?wsNpcByName(cn):null,dw=(typeof wsNpcByName==="function")?wsNpcByName(dn):null;
    if(cw&&cw.partyMember&&dw&&dw.partyMember)continue;
    if(dw&&dw.partyMember&&!(cw&&cw.partyMember)){var _sw=cn;cn=dn;dn=_sw;}
    if(_queueMergeHint(cn,dn))added++;
  }
  if(added&&typeof console!=="undefined")console.info("[memory] name-variant scan queued "+added+" possible duplicate pair(s) for GM confirmation (#128)");
  return added;
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
  // #156 Phase A prevention seam: never serve a candidate sharing a distinctive token with an
  // on-file npc key or alias — the pool itself served "Frizwick Coldwater" with Frizwick in the
  // party, which is how the Savah collision class enters suggestion-shaped. Namespace-scoped to
  // the npc domain only (Sol §6: a person, quest, and spell may all legitimately be called
  // "Hope"; cross-domain token ownership is not identity). Filtered candidates are skipped, not
  // logged — the window scans forward so the GM still gets a full list.
  var onFile={},ok,ti;
  if(memory.npcs){for(k in memory.npcs){
    var kt=npcCoreTokens(k);for(ti=0;ti<kt.length;ti++)onFile[kt[ti]]=1;
    var als=memory.npcs[k].aliases||[],ai;
    for(ai=0;ai<als.length;ai++){var at=npcCoreTokens(als[ai]);for(ti=0;ti<at.length;ti++)onFile[at[ti]]=1;}
  }}
  var result=[],n=count||10,idx=memory.nameIdx,scanned=0,scanCap=n*8;
  while(result.length<n&&scanned<scanCap){
    var first=firstNames[idx%firstNames.length];
    var last=surnames.length?surnames[(idx*7+3)%surnames.length]:"";
    var cand=last?first+" "+last:first;
    idx++;scanned++;
    var ct=npcCoreTokens(cand);ok=true;
    for(ti=0;ti<ct.length;ti++){if(onFile[ct[ti]]){ok=false;break;}}
    if(ok)result.push(cand);
  }
  if(!peek)memory.nameIdx=idx;
  return result;
}
function fileNpcEvent(name,note,turn){name=resolveNpcName(name);if(!memory.npcs[name])memory.npcs[name]={attitude:"",knowledge:[],events:[],aliases:[]};memory.npcs[name].events.push({turn:turn,note:note});if(memory.npcs[name].events.length>8){var _evD=memory.npcs[name].events.splice(0,memory.npcs[name].events.length-8),_evi;for(_evi=0;_evi<_evD.length;_evi++)memArchive().npcEvents.push({npc:name,note:_evD[_evi].note,turn:_evD[_evi].turn});}/* multi-shrink like the old slice(-8) so an NPC_MERGE overfill converges (audit E50); evicted events archive, never the void (#144A) */}
// #269① (f37): THE one knowledge-filing path — the three exact-indexOf sites (summary extract,
// summary supersede, the NPC_SUPERSEDE tag) each deduped byte-exact only, so the extractor's
// fresh-worded re-statements accumulated as paraphrase twins and every cap-12 admission evicted
// an older UNIQUE fact into the never-injected archive (t2097: eleven NPCs at cap, Morwen 31
// archived facts of churn). A near-dup now FOLDS via the shared feNearDup fingerprint: the
// richer text wins and moves to the tail (freshest — memoryNpcDetail sheds from the head), the
// loser is ARCHIVED with its winner named (a wrong fold on genuinely-distinct facts is therefore
// recoverable, unlike the eviction it replaces), and the fold is loud. preferNew=true is the
// SUPERSESSION mode: the new fact is an explicit truth assertion and always wins — richer-wins
// there would let a verbose stale claim beat the very reveal that retires it.
function fileNpcKnowledge(name,fact,turn,preferNew){
  name=resolveNpcName(name);
  var f=String(fact==null?"":fact);if(!f)return false;
  if(!memory.npcs[name])memory.npcs[name]={attitude:"",knowledge:[],events:[],aliases:[]};
  var n=memory.npcs[name];if(!n.knowledge)n.knowledge=[];
  if(n.knowledge.indexOf(f)>=0)return true;/* exact re-statement: already on file */
  var i;
  for(i=0;i<n.knowledge.length;i++){
    var ex=String(n.knowledge[i]);
    if(feNearDup(f,ex)){
      var win=preferNew?f:(f.length>ex.length?f:ex),lose=(win===f)?ex:f;
      n.knowledge.splice(i,1);
      memArchive().npcKnowledge.push({npc:name,fact:lose,turn:turn,foldedInto:win.slice(0,200)});
      n.knowledge.push(win);
      if(typeof console!=="undefined")console.info("[memory] knowledge fold on "+name+": \""+lose.slice(0,80)+"\" ⇒ kept "+(preferNew?"superseding":"richer")+" \""+win.slice(0,80)+"\" (loser archived)");
      return true;
    }
  }
  n.knowledge.push(f);
  while(n.knowledge.length>12)memArchive().npcKnowledge.push({npc:name,fact:n.knowledge.shift(),turn:turn});/* #144A: evict to archive, never the void */
  return true;
}
function fileLocation(loc,note,turn){
  if(typeof locResolve==="function")loc=locResolve(loc);/* #156B: a merged/aliased name lands on the canonical node — a tombstoned key must never re-mint (guarded: identity.js loads later; some dev tools load memory.js alone) */
  // Legacy locations index
  if(!memory.locations[loc])memory.locations[loc]={visited:[],notes:[]};
  if(!memory.locations[loc].visited)memory.locations[loc].visited=[];// blueprint-seeded entries lacked this (audit #8)
  memory.locations[loc].visited.push(turn);
  if(note){memory.locations[loc].notes.push(note);if(memory.locations[loc].notes.length>5)memory.locations[loc].notes.shift();}
  // Map node
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.nodes[loc])memory.map.nodes[loc]={firstVisit:turn,visits:0,description:null,parent:null,npcs:[],items:[],size:null,travelMins:null};
  memory.map.nodes[loc].visits++;
  guestbookNoteArrival(loc,turn);/* #173: QUEUED during a parse, committed post-handler (amendment ③) — the attendance snapshot must see same-response split/rejoin state settled */
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
  if(typeof locResolve==="function")parent=locResolve(parent);/* #156B: compose under the CANONICAL parent — a stale world pointer (older-device blob) must not mint children under a tombstoned key */
  var key=parent+"|"+name;
  if(typeof locResolve==="function")key=locResolve(key);/* the composed sub key may itself be merged */
  if(!memory.map.nodes[key])memory.map.nodes[key]={firstVisit:turn,visits:0,description:null,parent:parent,npcs:[],items:[],size:null,travelMins:null};
  memory.map.nodes[key].visits++;memory.map.nodes[key].lastVisit=turn;// stamp recency so buildGeoBlock keeps a re-visited sub-location listed (audit E53)
  guestbookNoteArrival(key,turn);/* #173: same post-handler commit as the world arrival */
}
function fileLocationDesc(desc){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=currentNodeKey();/* UA9 */
  if(typeof locResolve==="function")key=locResolve(key);/* #156B */
  if(!memory.map.nodes[key])return;
  if(!memory.map.nodes[key].description)memory.map.nodes[key].description=desc;
}
// #105 (B17): append-only per-node STATE-CHANGE record — what the story has durably DONE to a
// place, kept separate from the immutable first-visit description (write-once stays sacred; a
// mutate-in-place channel here would reopen description drift). Near-duplicate notes REFRESH in
// place instead of twinning (the #29 futureEvents lesson), with the richer text winning; the cap
// evicts the oldest loudly — newest state is the truest state, and every surviving note rides
// the prompt every turn, so the record must compress. Creates the node if the location was never
// formally filed — a note that silently vanished would be this feature failing its own defect.
function fileLocationState(note,turn){
  if(!worldState||!worldState.world)return false;
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  var key=currentNodeKey();/* sublocation-aware, same grain as LOCATION_ITEM/LOCATION_SIZE */
  if(typeof locResolve==="function")key=locResolve(key);/* #156B */
  var txt=String(note==null?"":note).trim();if(!txt)return false;
  if(txt.length>200){console.warn("[map] LOCATION_STATE note clamped to 200 chars: \""+txt.slice(0,60)+"…\"");txt=txt.slice(0,200);}
  if(!memory.map.nodes[key])memory.map.nodes[key]={firstVisit:turn,visits:0,description:null,parent:(key.indexOf("|")>=0?key.split("|")[0]:null),npcs:[],items:[],size:null,travelMins:null};
  var node=memory.map.nodes[key];
  if(!node.stateNotes)node.stateNotes=[];
  var norm=txt.toLowerCase(),i;
  for(i=0;i<node.stateNotes.length;i++){
    var ex=String(node.stateNotes[i].n||"").toLowerCase();
    if(ex.indexOf(norm)>=0||norm.indexOf(ex)>=0){/* containment either way = the same change re-stated */
      var ref=node.stateNotes.splice(i,1)[0];
      if(norm.length>ex.length)ref.n=txt;/* the richer statement wins */
      ref.t=turn;node.stateNotes.push(ref);return true;
    }
  }
  node.stateNotes.push({n:txt,t:turn});
  if(node.stateNotes.length>LOC_STATE_CAP){var ev=node.stateNotes.shift();memArchive().locationStates.push({node:key,note:ev.n,turn:ev.t});console.warn("[map] "+key+" state notes over cap ("+LOC_STATE_CAP+") — evicted oldest: \""+ev.n+"\" (archived, #149 — the prompt promises a durable change record)");}
  return true;
}
function fileLocationItem(name,action,turn){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=currentNodeKey();/* UA9 */
  if(typeof locResolve==="function")key=locResolve(key);/* #156B */
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
  if(typeof locResolve==="function")key=locResolve(key);/* #156B */
  var node=memory.map.nodes[key];if(!node)return;
  var i;for(i=0;i<node.items.length;i++){if(node.items[i].name.toLowerCase()===itemName.toLowerCase()&&!node.items[i].taken){node.items[i].taken=true;return;}}
}
/* ═══ #194: the presence split — mapNpcLocation is DELETED, its two conflated jobs separated ═══
   A mention must never teleport a character (owner fixed point 1, ruled 2026-08-17): measured at
   t1903, the mention channel had made 37 of 39 living NPCs killable by bare name — statusTurn/
   lastSeenAt/guestbook were all mention-fed. The [NPC:] handler now calls ONLY the register half;
   presence is DERIVED from writers the GM already operates truthfully for its own reasons
   ([SAY:] 88-95% of live responses, combat tags, party arrivals, [SCENE_CAST:]) via
   derivePresenceFromResponse (identity.js) at the post-handler seam. No heuristic, no timer —
   the teleport is impossible by construction. Design of record:
   DOC/Research/presence_panel_2026-08-17.md. */
function npcRegisterMention(name){
  /* Registration half: everything true of a DISCUSSED character — display association for the
     map viewer / repair census (amendment ⑦: nothing authoritative reads node.npcs) plus a
     lastMentioned turn scalar. Deliberately NOTHING place-shaped on the character record: a
     mention carries no location fact. */
  if(!memory.map||!worldState||!worldState.world)return;
  name=resolveNpcName(name);
  var key=currentNodeKey();/* UA9 */
  if(typeof locResolve==="function")key=locResolve(key);/* #156B */
  if(memory.npcs[name])memory.npcs[name].lastMentioned=(typeof worldState.turn==="number")?worldState.turn:0;
  if(!memory.map.nodes[key])return;
  var npcs=memory.map.nodes[key].npcs;if(npcs.indexOf(name)<0)npcs.push(name);
  /* #194 L6: the node's rumor mill — a heard name is a real fact about a PLACE ("this place has
     heard of X") even though it is nothing place-shaped about the CHARACTER. LRU-capped at write
     (a re-mention refreshes to newest); the render window (NODE_MENTION_WINDOW) ages entries out
     of the prompt without deleting the record. Projection carries the not-a-visit clause; the
     priming risk (does injecting heard names make the GM stage them?) is corpus-judged post-ship
     per the panel's own instruction. */
  var mn=memory.map.nodes[key].mentions;if(!mn)mn=memory.map.nodes[key].mentions=[];
  var mt=(typeof worldState.turn==="number")?worldState.turn:0,mi;
  for(mi=mn.length-1;mi>=0;mi--)if(mn[mi]&&mn[mi].n===name)mn.splice(mi,1);
  mn.push({n:name,t:mt});
  if(mn.length>NODE_MENTION_CAP)mn.splice(0,mn.length-NODE_MENTION_CAP);
}
function npcRecordPresence(name,src){
  /* THE one presence writer for non-party characters: lastSeenAt + lastSeenTurn + lastSeenSrc +
     a SOURCED guestbook stamp. Sources: "say" | "combat" | "cast" | "arrive". The #137 split
     guard covers every derived channel in one place — a split member speaking via sending or
     taking remote damage must not become false eyewitness history at the camera node. Every
     lastSeenAt write stays turn-stamped (#175bR strictly-earlier contract). "cast" is recorded
     but playtest-gated OUT of death-gate authorization (ruling ④) — see npc presence limbs in
     w2NamedPresenceEvidence (identity.js). */
  if(!memory.map||!worldState||!worldState.world)return false;
  name=resolveNpcName(name);
  var key=currentNodeKey();/* UA9 */
  if(typeof locResolve==="function")key=locResolve(key);/* #156B */
  if(!memory.map.nodes[key])return false;
  var _gbWs=(typeof wsNpcByName==="function")?wsNpcByName(name):null;
  if(_gbWs&&_gbWs.partyMember&&_gbWs.charSheet&&_gbWs.charSheet.splitLoc&&_gbWs.charSheet.splitLoc.location)return false;/* #137 membership ≠ presence */
  var npcs=memory.map.nodes[key].npcs;if(npcs.indexOf(name)<0)npcs.push(name);
  var turn=(typeof worldState.turn==="number")?worldState.turn:0;
  if(memory.npcs[name]){memory.npcs[name].lastSeenAt=key;memory.npcs[name].lastSeenTurn=turn;memory.npcs[name].lastSeenSrc=src||"arrive";}
  guestbookStamp(key,name,turn,src||"arrive");
  return true;
}

// ═══ #173: the location guestbook — per-character visit provenance ═══════════════════════════
// The historical half of #137's "membership ≠ presence" invariant: every split/rejoin can turn
// one subgroup's past into the reunited party's "we" (the t1728 Frizwick/Jorgenfist failure).
// Owner-ratified shape: node.guestbook[canonicalName]={turns:[...],resident:bool} — name-keyed,
// multi-visit turn arrays, deduped, capped PER CHARACTER (GB_TURN_CAP; older turns fold into an
// {first,last,count} aggregate, never the void). resident:true = "routinely based here"
// (a proprietor), NEVER "present now"; resident-only records carry NO fabricated visit turn.
// WRITE SEAM DISCIPLINE (pinned amendment ③): party attendance for an arrival is committed at a
// POST-HANDLER seam — fileLocation/fileSubLocation only QUEUE the arrival during a parse, and
// applyMutsTable drains the queue after every handler (including same-response [PARTY_SPLIT:]
// and the #133b auto-fold) has settled, reading each character's EFFECTIVE location. Outside a
// parse (campaign start, dev tools) the queue is bypassed and the stamp is immediate.
var _gbPendingArrivals=[];   // arrivals queued by fileLocation/fileSubLocation during a parse
var _gbDeferArrivals=false;  // true between guestbookBeginResponse() and guestbookCommitArrivals()
function guestbookRecordEnsure(node,name){
  if(!node.guestbook)node.guestbook={};
  if(!node.guestbook[name])node.guestbook[name]={turns:[],resident:false};
  return node.guestbook[name];
}
function _gbCapFold(rec){/* amendment ①: overflow folds the OLDEST exact turns into the aggregate */
  while(rec.turns.length>GB_TURN_CAP){
    var old=rec.turns.shift();
    if(!rec.agg)rec.agg={first:old,last:old,count:0};
    if(old<rec.agg.first)rec.agg.first=old;
    if(old>rec.agg.last)rec.agg.last=old;
    rec.agg.count++;
    if(rec.by)delete rec.by[old];/* #194: a folded turn's source folds away with it — rec.by stays bounded by GB_TURN_CAP by construction */
  }
}
function guestbookStamp(nodeKey,name,turn,src){
  if(!memory||!memory.map||!memory.map.nodes)return false;
  if(typeof locResolve==="function")nodeKey=locResolve(nodeKey);
  var node=memory.map.nodes[nodeKey];
  if(!node){if(typeof console!=="undefined")console.warn("[guestbook] visit stamp for '"+name+"' dropped — node '"+nodeKey+"' not on the map");return false;}
  if(typeof turn!=="number"||!isFinite(turn))return false;
  name=resolveNpcName(name);
  var rec=guestbookRecordEnsure(node,name);
  if(rec.turns.indexOf(turn)>=0)return false;      /* same-turn dedupe — the FIRST writer's source stands */
  if(rec.agg&&turn<=rec.agg.last)return false;     /* already inside the folded region — cannot re-verify an individual folded turn */
  rec.turns.push(turn);
  rec.turns.sort(function(a,b){return a-b;});
  /* #194: per-turn source provenance ("say"/"combat"/"cast"/"arrive"). Pre-#194 turns have no
     entry — turn-vs-presenceEpoch grading covers them (appendix 8: grade is DERIVED, never
     stored per legacy record). */
  if(src){if(!rec.by)rec.by={};rec.by[turn]=String(src);}
  _gbCapFold(rec);
  return true;
}
function guestbookSetResident(nodeKey,name,on){
  if(!memory||!memory.map||!memory.map.nodes)return false;
  if(typeof locResolve==="function")nodeKey=locResolve(nodeKey);
  var node=memory.map.nodes[nodeKey];
  if(!node){if(typeof console!=="undefined")console.warn("[guestbook] resident write for '"+name+"' refused — node '"+nodeKey+"' not on the map");return false;}
  name=resolveNpcName(name);
  if(on){guestbookRecordEnsure(node,name).resident=true;return true;}
  var gb=node.guestbook;
  if(!gb||!gb[name])return false;
  if(gb[name].turns.length||gb[name].agg)gb[name].resident=false;/* real visits survive the residency ending */
  else delete gb[name];/* a cleared resident-only record is empty — drop it whole */
  return true;
}
// Record fold — ONE implementation for locMerge, NPC merge/alias re-key, and repair tooling
// (amendment ④: fold = turn union + dedupe + OR resident; aggregates merge min/max/sum).
function guestbookFoldRecords(dst,src){
  var i,st=(src&&src.turns)||[];
  for(i=0;i<st.length;i++){if(dst.turns.indexOf(st[i])<0)dst.turns.push(st[i]);}
  dst.turns.sort(function(a,b){return a-b;});
  /* #194: source provenance folds with its turn, grade-preserving — a fold can never PROMOTE a
     record (grade derives from the turn value, which travels; a sourceless legacy turn stays
     sourceless). Existing dst sources win on collision (same-turn dedupe parity). */
  if(src&&src.by){if(!dst.by)dst.by={};for(i in src.by)if(dst.turns.indexOf(Number(i))>=0&&dst.by[i]===undefined)dst.by[i]=src.by[i];}
  if(src&&src.agg){
    if(!dst.agg)dst.agg={first:src.agg.first,last:src.agg.last,count:src.agg.count};
    else{dst.agg.first=Math.min(dst.agg.first,src.agg.first);dst.agg.last=Math.max(dst.agg.last,src.agg.last);dst.agg.count+=src.agg.count;}
  }
  dst.resident=!!(dst.resident||(src&&src.resident));
  _gbCapFold(dst);
  return dst;
}
function guestbookFoldBooks(dstNode,srcNode){/* whole-node union — locMerge's guestbook half */
  if(!srcNode||!srcNode.guestbook)return;
  var names=Object.keys(srcNode.guestbook),i;
  for(i=0;i<names.length;i++){
    var src=srcNode.guestbook[names[i]];
    if(src)guestbookFoldRecords(guestbookRecordEnsure(dstNode,names[i]),src);
  }
}
function guestbookRekeyName(canonical,duplicate){/* NPC merge/alias: sweep every node, fold dup-keyed records under the canonical */
  if(!memory||!memory.map||!memory.map.nodes||canonical===duplicate)return 0;
  var ks=Object.keys(memory.map.nodes),moved=0,i;
  for(i=0;i<ks.length;i++){
    var node=memory.map.nodes[ks[i]],gb=node&&node.guestbook;
    if(!gb||!gb[duplicate])continue;
    guestbookFoldRecords(guestbookRecordEnsure(node,canonical),gb[duplicate]);
    delete gb[duplicate];moved++;
  }
  return moved;
}
function _gbPresentPartyNames(){/* the hero + every living party member NOT split away */
  var out=[],i;
  if(worldState&&worldState.character&&worldState.character.name)out.push(worldState.character.name);
  var npcs=(worldState&&worldState.npcs)||[];
  for(i=0;i<npcs.length;i++){var n=npcs[i];
    if(!n||!n.partyMember)continue;
    if(typeof npcIsDead==="function"&&npcIsDead(n))continue;
    if(n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location)continue;/* #137: membership ≠ presence */
    out.push(n.name);
  }
  return out;
}
function _gbStampParty(nodeKey,turn){
  var who=_gbPresentPartyNames(),i;
  for(i=0;i<who.length;i++)guestbookStamp(nodeKey,who[i],turn,"arrive");/* #194: arrivals are the truthful writers they always were — now sourced */
}
function guestbookNoteArrival(nodeKey,turn){
  if(_gbDeferArrivals){_gbPendingArrivals.push({key:nodeKey,turn:turn});return;}
  _gbStampParty(nodeKey,turn);
}
function guestbookBeginResponse(){_gbDeferArrivals=true;_gbPendingArrivals.length=0;}
function guestbookCommitArrivals(){
  _gbDeferArrivals=false;
  var i;for(i=0;i<_gbPendingArrivals.length;i++)_gbStampParty(_gbPendingArrivals[i].key,_gbPendingArrivals[i].turn);
  _gbPendingArrivals.length=0;
}
function guestbookSeedStart(){/* startGame's testable half: the whole creation-time party stands at the opening node (turn 0) */
  if(!worldState||!worldState.world||!worldState.world.location)return;
  _gbStampParty(worldState.world.location,0);
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
function memArchive(){memory.archive=archiveHeal(memory.archive);return memory.archive;}/* JP0-5: was its own hand-copied category list (four behind the registry, incl. coreMemories and npcDeathCorrections); MEMORY_ARCHIVE_KEYS (state.js) is the one source now */
// #269⑤ (f43): the extractor re-discovers known lore in fresh words every window (the exact
// class field-proven for futureEvents — the t198 seven-Shalelu save) because memoryTOC restates
// the freshest lore to the GM every turn and the extraction call is noHistory. Exact-match let
// every rewording through, and at cap-30 each twin evicted a genuinely old, DISTINCT entry into
// an archive with zero retrieval paths. Near-dup now folds: richer text wins and moves to the
// tail (freshest — the diet path keeps the most-recent-8), the loser archives WITH its winner
// named ({fact,foldedInto,turn} — cap evictions stay plain strings), loudly.
function fileLore(fact){
  fact=String(fact==null?"":fact);if(!fact)return;
  if(memory.lore.indexOf(fact)>=0)return;
  var i;
  for(i=0;i<memory.lore.length;i++){
    if(feNearDup(fact,memory.lore[i])){
      var _exL=String(memory.lore[i]);
      var _win=fact.length>_exL.length?fact:_exL,_lose=(_win===fact)?_exL:fact;
      memory.lore.splice(i,1);memory.lore.push(_win);
      memArchive().lore.push({fact:_lose,foldedInto:_win.slice(0,200),turn:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||0});
      if(typeof console!=="undefined")console.info("[memory] lore fold: \""+_lose.slice(0,80)+"\" ⇒ kept richer \""+_win.slice(0,80)+"\" (loser archived)");
      return;
    }
  }
  memory.lore.push(fact);
  if(memory.lore.length>30)memArchive().lore.push(memory.lore.shift());
}
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
// #150 (drift pass order 6): THE shared near-duplicate fingerprint — extracted from
// fileFutureEvent's inline #29 logic so scheduleAdd's promotion cross-check and the expiry
// sweep's quest-linkage test reuse the SAME thresholds instead of minting a rival heuristic.
// shared≥2 significant stemmed tokens AND ≥half the smaller fingerprint = the same business.
function feNearDup(a,b){
  var at=feTokens(a),bt=feTokens(b),shared=0,i;
  for(i=0;i<at.length;i++){if(bt.indexOf(at[i])>=0)shared++;}
  return shared>=2&&shared*2>=Math.min(at.length,bt.length);
}
// #150: does this pending thread fingerprint-match an ACTIVE quest's title or any objective?
function feQuestLinked(f){
  if(typeof worldState==="undefined"||!worldState||!Array.isArray(worldState.questLog))return false;
  var i,j;for(i=0;i<worldState.questLog.length;i++){var q=worldState.questLog[i];
    if(!q||q.status!=="active")continue;
    if(feNearDup(f.what,q.title))return true;
    var ob=q.objectives||[];for(j=0;j<ob.length;j++){if(ob[j]&&feNearDup(f.what,ob[j].text))return true;}
  }
  return false;
}
function expireFutureEvents(){
  if(!memory.futureEvents||!memory.futureEvents.length)return;
  var now=(typeof worldState!=="undefined"&&worldState)?worldState.turn:0,kept=[],promote=[],i;
  for(i=0;i<memory.futureEvents.length;i++){
    var f=memory.futureEvents[i];
    var strict=(typeof parseStrictFutureDuration==="function")?parseStrictFutureDuration(f.when):0;
    if(strict>0){promote.push({f:f,mins:strict});continue;}
    if(typeof f.setTurn!=="number")f.setTurn=now;
    if(now-f.setTurn<=FUTURE_EXPIRE_TURNS){kept.push(f);continue;}
    // #150: expiry is no longer liveness-blind, and NEVER the void. A thread still fingerprint-
    // linked to an ACTIVE quest gets exactly ONE GM ask (buildExpiredThreadNudge renders it this
    // turn; _asked marks it, the age is NEVER rewritten — Sol's immortal-event objection) and
    // dies archived at the next sweep regardless of the answer. Everything else archives now.
    if(!f._asked&&feQuestLinked(f)){f._asked=now;kept.push(f);console.info("[memory] #150: expiring thread \""+String(f.what).slice(0,60)+"\" looks quest-linked — one GM ask before it dies");continue;}
    memArchive().futureEvents.push({when:f.when,who:f.who,what:f.what,setTurn:f.setTurn,expiredAt:now});
    console.info("[memory] #150: pending thread expired at age "+(now-f.setTurn)+" — archived: \""+String(f.what).slice(0,60)+"\"");
  }
  memory.futureEvents=kept;
  for(i=0;i<promote.length;i++){
    var pe=(typeof scheduleAdd==="function")?scheduleAdd(promote[i].f.what,promote[i].mins+"m"):null;
    if(pe){memArchive().futureEvents.push({when:promote[i].f.when,who:promote[i].f.who,what:promote[i].f.what,setTurn:promote[i].f.setTurn,promoted:pe.id,clockAware:true});
      if(typeof console!=="undefined")console.info("[memory] duration-bound pending thread promoted to schedule: \""+String(promote[i].f.what).slice(0,60)+"\"");}
    else kept.push(promote[i].f);
  }
}
function fileFutureEvent(when,who,what,setTurn){
  if(what==null)return;what=String(what);if(!what)return;/* coerce a non-string what so feTokens/indexOf don't throw later (audit E44) */
  var strict=(typeof parseStrictFutureDuration==="function")?parseStrictFutureDuration(when):0;
  if(strict>0&&typeof scheduleAdd==="function"){
    var scheduled=scheduleAdd(what,strict+"m");
    if(scheduled&&typeof console!=="undefined")console.info("[memory] duration-bound future event filed directly to the clock schedule: \""+what.slice(0,60)+"\"");
    return scheduled;
  }
  var i;for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what===what)return;}// dedupe
  // Near-duplicate dedupe (#29): the extractor re-mints pending goals in fresh words every cycle —
  // the t198 save held SEVEN "find Shalelu" variants. If the new event shares ≥2 significant tokens
  // AND ≥half of the smaller fingerprint with an existing pending event, refresh that event's age
  // instead of filing a twin (still-topical goals stay alive for the expiry sweep; no spam).
  // Threshold keeps same-NPC-different-business apart ("Confront Hemlock re broadsheet" vs
  // "Understand Hemlock's mechanism" share only 1 token — both survive).
  for(i=0;i<memory.futureEvents.length;i++){
    var ex=memory.futureEvents[i];
    if(ex.resolved)continue;
    if(feNearDup(what,ex.what)){/* #150: same thresholds, now via the shared fingerprint */
      /* #269④ (f42): the fold is LOUD and the swallowed text is ARCHIVED — a genuinely distinct
         thread sharing an NPC+place token can land here (traced: "Rescue Ameiko from the
         Glassworks" absorbs "Investigate the Glassworks tunnels with Ameiko"), and until now it
         died with zero trace on the extractor path. The #235 strict comparator was REJECTED for
         this seam: the pinned 7-Shalelu fixtures are exactly the class it stops catching
         (shared=2 + scaffold extras on both sides) — visibility over tightening (f42 verifier).
         The existing entry's TEXT keeps winning (pinned) and its age still refreshes. */
      memArchive().futureEvents.push({when:when,who:who||"",what:what,setTurn:setTurn,foldedInto:String(ex.what).slice(0,200)});
      if(typeof console!=="undefined")console.info("[memory] pending-event fold: \""+what.slice(0,80)+"\" absorbed by existing \""+String(ex.what).slice(0,80)+"\" (archived — if these were distinct threads, re-state the lost one in fresh words)");
      if(typeof setTurn==="number")ex.setTurn=setTurn;
      return;
    }
  }
  memory.futureEvents.push({when:when,who:who||"",what:what,setTurn:setTurn,resolved:false});
  if(memory.futureEvents.length>30){var _feOv=memory.futureEvents.splice(0,memory.futureEvents.length-30),_feI;for(_feI=0;_feI<_feOv.length;_feI++)memArchive().futureEvents.push({when:_feOv[_feI].when,who:_feOv[_feI].who,what:_feOv[_feI].what,setTurn:_feOv[_feI].setTurn,expiredAt:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||0,capOverflow:true});}/* #150: the cap's shrink archives too — no shrink site left silent */
}
function resolveFutureEvent(what){var i;
  what=String(what==null?"":what);if(!what.trim())return;// empty/whitespace needle would substring-match (and delete) the oldest event (audit E45)
  for(i=0;i<memory.futureEvents.length;i++){if(String(memory.futureEvents[i].what)===what){memory.futureEvents.splice(i,1);return;}}// exact, remove
  for(i=0;i<memory.futureEvents.length;i++){if(String(memory.futureEvents[i].what).indexOf(what)>=0){memory.futureEvents.splice(i,1);return;}}}// partial, remove

// W4: deterministic resolve assist. It never resolves state. A pending event must share the
// existing #29 fingerprint with one chapter sentence AND that sentence must assert an outcome;
// plans, reminders, and mere mentions stay pending. The bounded queue only asks the GM to file
// the existing resolution tag or leave the event alone.
var FUTURE_OUTCOME_RE=/\b(?:arrived|reached|entered|visited|met|found|confronted|investigated|identified|examined|completed|finished|delivered|returned|recovered|rescued|defeated|killed|slain|escaped|bathed|resolved|settled|paid|collected|avoided|routed\s+around)\b/i;
function futureResolveOverlap(a,b){var at=feTokens(a),bt=feTokens(b),shared=[],i;for(i=0;i<at.length;i++)if(bt.indexOf(at[i])>=0)shared.push(at[i]);if(shared.length>=2&&shared.length*2>=Math.min(at.length,bt.length))return true;return shared.length===1&&shared[0].length>=7&&Math.min(at.length,bt.length)<=2;}
function futureResolveAssist(summary){
  if(!memory.futureEvents||!memory.futureEvents.length)return;
  var ss=String(summary||"").match(/[^.!?]+[.!?]?/g)||[],i,j,f,s;
  if(!worldState.futureResolveHints)worldState.futureResolveHints=[];
  for(i=0;i<memory.futureEvents.length&&worldState.futureResolveHints.length<3;i++){
    f=memory.futureEvents[i];if(!f||f.resolved)continue;
    var already=false,k;for(k=0;k<worldState.futureResolveHints.length;k++)if(worldState.futureResolveHints[k].what===f.what){already=true;break;}if(already)continue;
    for(j=0;j<ss.length;j++){s=ss[j];if(FUTURE_OUTCOME_RE.test(s)&&futureResolveOverlap(s,f.what)){worldState.futureResolveHints.push({what:f.what,turn:(worldState&&worldState.turn)||0,evidence:String(s).trim().slice(0,180)});break;}}
  }
  if(!worldState.futureResolveHints.length)delete worldState.futureResolveHints;
}
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
var RAG_BIGRAM_W=2;    // #188: per-bigram IDF multiplier (bigrams are rarer than words — weight them like the strong signal they are)
var RAG_BIGRAM_CAP=10; // #188: cap on the summed bigram bonus — sits OUTSIDE the single-word 8-cap on purpose (a phrase match must be able to beat ensemble entity weight)
var RAG_BIGRAM_QUALIFY=6; // #188: a bigram score at/above this OPENS the sc>0 gate on its own (df-bounded: a rare phrase can only qualify the few entries that contain it)
/* #224 (the Giant's Bane rank-loss, field 2026-08-23): the same three dials for single RARE
   words. The alchemist's definition of giant's bane ranked 81st of 999 for the question that
   quoted it — "paralytic" (df 4 of ~2000, IDF ~6) was worth at most 8 capped while scene
   adjacency accumulated uncapped to 20-28. #188 built this exact lane for phrases; words under
   the SAME 1% df ceiling now compete outside the 8-cap too. QUALIFY sits stricter than the
   bigram bar on purpose: a lone word is inherently less specific than a phrase, so opening the
   sc>0 gate alone demands a rarer word (IDF*W ≥ 8 → df roughly ≤ N/55, ~2× under the ceiling). */
var RAG_RARE_W=2;       // #224: per-word IDF multiplier for under-ceiling words (the bigram weight, deliberately)
var RAG_RARE_CAP=10;    // #224: cap on the summed rare-word bonus — OUTSIDE the single-word 8-cap, like RAG_BIGRAM_CAP
var RAG_RARE_QUALIFY=8; // #224: a rare-word score at/above this opens the sc>0 gate on its own
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
function memoryNpcIsPlayer(name){
  var c=(typeof worldState!=="undefined"&&worldState&&worldState.character)||null;
  var low=String(name||"").replace(/^\s+|\s+$/g,"").toLowerCase(),i;
  if(low==="player")return true;
  if(!c||!low)return false;
  if(low===String(c.name||"").replace(/^\s+|\s+$/g,"").toLowerCase())return true;
  for(i=0;i<(c.aliases||[]).length;i++){if(low===String(c.aliases[i]||"").replace(/^\s+|\s+$/g,"").toLowerCase())return true;}
  return false;
}
function _ragNpcsFp(){
  if(typeof memory==="undefined"||!memory||!memory.npcs)return "none";
  var all=Object.keys(memory.npcs),ks=[],aCnt=0,aJoin="",i,e;
  for(i=0;i<all.length;i++)if(!memoryNpcIsPlayer(all[i]))ks.push(all[i]);
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
    if(memoryNpcIsPlayer(ks[i]))continue;
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
// #177 SANCTIONED SEAM BYPASS: the write below (`en0.e=…` at the retrieval loop) deliberately
// does NOT route through mutateTranscriptEntry — a memoized compressed blob missing backfilled
// .e fields is ACCEPTED (audit ruling: the backfill recomputes lazily after any reload, so
// nothing is lost), and invalidating here would force a full recompression per retrieval.
// Every OTHER in-place transcript-entry write must use the state.js accessor.
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
    if(meta&&meta.lastSeenAt&&(typeof locSame==="function"?(locSame(meta.lastSeenAt,key)||locSame(meta.lastSeenAt,q.loc)):(meta.lastSeenAt===key||meta.lastSeenAt===q.loc)))q.scene[names[i].nm]=1;/* #156B: a stamp under a merged alias still reads as HERE */
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
    if(w.length>=4&&!RAG_STOP[w]&&!seen[w]){seen[w]=1;out.push(w);if(out.length>=20)break;}/* #261 (JP0-12, Fable f47): collection was FIRST-COME with a break at 8 — a verbose lead-in burned every slot on ordinary words before the rare identifying term arrived, and the #188/#224 IDF lanes never saw the very signal they were built to rank. Scoring is rarity-ranked already, so the fix is a wider candidate pool; 20 is runaway insurance (each candidate costs one indexOf per eligible entry in pass 1), and typical inputs stay under the old 8 — their behavior is byte-identical. */
  }
  return out;
}
/* #188 (v1.617): consecutive significant-word PAIRS from the player's input — the channel that
   lets a directed memory question FIND its scene. Field case (t1788+, the wine-cellar
   confabulation): "the merchant's wine cellar" — the two cellar scenes were structurally
   outgunned: two-person scenes carry less additive entity weight than crowded prep scenes at
   the same place, and the single-word lexical bonus is capped at 8, so the asked-about scenes
   lost the 3-slot competition and the GM confabulated from near-miss neighbors. A BIGRAM hit
   ("wine cellar": df=2 in 1,700 entries) is rare enough to both QUALIFY an entry and out-rank
   ensemble crowd weight — and it is self-bounding: a phrase can only lift the df entries that
   actually contain it. Pairs are adjacent KEPT tokens (≥4 chars, non-stopword), so
   "merchant's wine cellar" yields "merchant wine"+"wine cellar" — close enough for prose that
   says the same thing. Cap 6 bigrams per input. */
function ragQueryBigrams(inputText){
  var out=[],seen={},kept=[],i;
  var words=String(inputText||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/);
  for(i=0;i<words.length;i++){var w=words[i];if(w.length>=4&&!RAG_STOP[w])kept.push({w:w,pos:i});}
  for(i=1;i<kept.length;i++){
    if(kept[i].pos-kept[i-1].pos>2)continue; // allow one short word between ("wine in cellar"), never a gap
    var bg=kept[i-1].w+" "+kept[i].w;
    if(!seen[bg]){seen[bg]=1;out.push(bg);if(out.length>=12)break;}/* #261: same first-come starvation as the word cap — the identifying phrase in a verbose question arrived after slot 6; the df ceiling already keeps common pairs inert */
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
  if(!ragEnabled()){ragRetrieve._lastServed=false;return "";}
  var tr=worldState.transcript;
  if(!tr||tr.length<6){ragRetrieve._lastServed=false;return "";}
  var _k=_ragRetrieveKey(inputText);
  var _m=ragRetrieve._memo;
  if(_m&&_m.k===_k){ragRetrieve._lastServed=_m.v!=="";return _m.v;}
  ragRetrieve._misses++;
  var v=_ragRetrieveScore(inputText);
  ragRetrieve._memo={k:_k,v:v};
  ragRetrieve._lastServed=v!=="";
  return v;
}
ragRetrieve._memo=null;ragRetrieve._misses=0; // test hooks (dev/_tests_A2.js)
ragRetrieve._lastServed=null; // #17 health observation — did the most recent retrieval serve excerpts? (null = never ran this session); stamped on EVERY exit path above, read by recordUsage's health ring. Observational only: retrieval behavior is untouched
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
  var bigrams=ragQueryBigrams(inputText||"");/* #188 */
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
  // #271③ (f48): NO +1 — pairs↔turns are 1:1 (bk pairs included: they consumed a turn++ too),
  // so P pairs cover t=T−P+1..T and the cut must sit at exactly T−P. The +1 left GM turn T−P
  // in NEITHER verbatim channel, and because each new turn advances T and P together, the same
  // boundary turn stayed invisible until the second-next summarize.
  var skipN=Math.max(2,Math.ceil(((typeof sessionLog!=="undefined"&&sessionLog)?sessionLog.length:0)/2));
  var cutT=worldState.turn-skipN;
  var cands=[],names=null,i,j;
  // Pass 1: backfill missing indexes + per-term document frequency over eligible entries.
  // IDF makes rare words dominate ("broadsheet": ~4 entries → strong; "keep": everywhere →
  // ~nothing) without a hand-tuned stoplist — the t164 lesson. Deterministic, no vectors.
  var elig=[],df=[],N=0,bdf=[];
  for(j=0;j<terms.length;j++)df.push(0);
  for(j=0;j<bigrams.length;j++)bdf.push(0);
  for(i=0;i<tr.length;i++){
    var en0=tr[i];
    if(en0.r!=="gm")continue;
    if(en0.bk)continue; // typed bookkeeping receipts are instrumentation, never episodic evidence
    if(en0.t>cutT)continue;
    if(en0.rc||en0.rf)continue; // rc: [RETCON:]-marked — superseded or correcting narration; rf: a #197 model-refusal turn — meta-voice, non-canon. Neither is ever episodic truth
    var prev0=i>0&&tr[i-1].r==="player"?String(tr[i-1].x).toLowerCase():"";
    // Meta-exchange filter: a player turn opening with "GM:" is an out-of-character question
    // ABOUT the record (memory quiz, correction), and the response is recall chatter — often
    // confabulated — not a scene. Left in the index, these echoes outrank the origin scenes
    // they quote (the t164 broadsheet displacement) and preserve false corrections (the t160
    // pin-grab). Excluded from candidacy AND from the IDF document set.
    if(/^\s*gm\s*[:,]/.test(prev0))continue;
    if(!en0.e){if(!names)names=ragKnownNames();en0.e=ragBackfillEntry(en0,names);}
    var low0=String(en0.x).toLowerCase();
    var hits0=[],bhits0=[];
    for(j=0;j<terms.length;j++){var h=low0.indexOf(terms[j])>=0||(prev0&&prev0.indexOf(terms[j])>=0);hits0.push(h);if(h)df[j]++;}
    for(j=0;j<bigrams.length;j++){var bh=low0.indexOf(bigrams[j])>=0||(prev0&&prev0.indexOf(bigrams[j])>=0);bhits0.push(bh);if(bh)bdf[j]++;}/* #188: literal-phrase containment — hyphenated variants miss, deterministic and conservative */
    elig.push({i:i,en:en0,hits:hits0,bhits:bhits0});
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
    if(q.loc&&(typeof locSame==="function"?locSame(en.e.l,q.loc):en.e.l===q.loc))sc+=2;/* #156B: historical scenes stamped under a merged name still score for the canonical place (the A0 arm-2 property) */
    for(j=0;j<(en.e.q||[]).length;j++){if(qws[en.e.q[j].toLowerCase()])sc+=1;}
    /* #188: the bigram bonus lives OUTSIDE the single-word 8-cap, and a strong-enough phrase
       match QUALIFIES on its own (the sc>0 gate used to mean input words could only RANK
       entries that entity/location/quest overlap had already admitted — a directed "do you
       remember the <place>" question could never open the gate for its own scene). df-bounded:
       "wine cellar" at df=2 can lift exactly the 2 entries that contain it, nothing else. */
    var blex=0,bMaxDf=Math.max(3,Math.ceil(N*0.01));/* a phrase in >1% of entries identifies nothing — "last time" lifted unrelated scenes to 19-21 in the first field run */
    for(j=0;j<bigrams.length;j++){if(elig[i].bhits[j]&&bdf[j]<=bMaxDf)blex+=Math.log((N+1)/(bdf[j]+1));}
    blex=Math.min(RAG_BIGRAM_CAP,blex*RAG_BIGRAM_W);
    /* #224: the rare-WORD lane — words under the SAME 1% ceiling bigrams use score outside the
       8-cap, so near-decisive IDF ("paralytic", df 4) can no longer be flattened to less than
       standing-near-the-right-people. Rare words still also count inside the capped lane below —
       the bigram lane tolerates the same constituent overlap, and the capped lane is saturated in
       exactly the cases this lane exists for. */
    var rlex=0;
    for(j=0;j<terms.length;j++){if(elig[i].hits[j]&&df[j]<=bMaxDf)rlex+=Math.log((N+1)/(df[j]+1));}
    rlex=Math.min(RAG_RARE_CAP,rlex*RAG_RARE_W);
    if(sc>0){
      var lex=0;
      for(j=0;j<terms.length;j++){if(elig[i].hits[j])lex+=Math.log((N+1)/(df[j]+1));}
      sc+=Math.min(8,lex*1.5)+blex+rlex;
    }else if(blex>=RAG_BIGRAM_QUALIFY||rlex>=RAG_RARE_QUALIFY){sc=blex+rlex;}
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
// ── #148 Phase 1: archived-chapter retrieval ─────────────────────────────────────────────────
// The chapter archive (memory.archive.chapters — everything evicted past the live cap-10) had
// ZERO read paths: at t1549 the always-injected history spanned ~35 turns while 200+ chapters
// sat unreachable. The recall gate (audits/AUDIT_recall_gate_v1.573.md) measured retrieval as
// the higher-yield arm when it hits (5-6/10 questions with verbatim detail) and ruled it ships
// FIRST, inside the product's existing subordination guardrails — the override header is the
// mitigation for the gate's one confident-misattribution failure. READ-SIDE ONLY, like the rest
// of this section: retrieval never writes to memory.archive (entity scans live in a RAM memo,
// never persisted — a deliberate, conservative deviation from the transcript's persisted .e
// backfill, keeping the archive purely storage as its P12 comment promises).
var RAG_CHAP_MAX=2;       // chapter summaries served per turn
var RAG_CHAP_BUDGET=1400; // chars (~350 tok) — the block stays a garnish, never a second prompt
var RAG_CHAP_SKIP=8;      // newest N chapters excluded: STORY SO FAR injects them every turn already
var RAG_CHAP_LEX_MIN=3;   // IDF floor for a lexical-only gate-in (see _ragChapterScore)
// Candidate pool, chronological: archived chapters (oldest) then the live list, minus the
// newest RAG_CHAP_SKIP overall. Under 1 candidate → [] → "" (young campaigns byte-unchanged).
function _ragChapterPool(){
  var arch=(memory.archive&&memory.archive.chapters)?memory.archive.chapters:[];
  var pool=arch.concat(memory.chapters||[]);
  return pool.length>RAG_CHAP_SKIP?pool.slice(0,pool.length-RAG_CHAP_SKIP):[];
}
// Per-chapter known-NPC name scan, memoized in RAM only (never written to the pool objects —
// the no-archive-writes rule above). Rescans when the NPC roster or the pool itself changes.
function _ragChapterEnts(pool){
  var fp=_ragNpcsFp()+"|"+pool.length+"|"+(pool.length?String(pool[0].turn)+"."+String(pool[pool.length-1].turn):"");
  var m=ragChapterRetrieve._entMemo;
  if(m&&m.fp===fp)return m.ents;
  var names=ragKnownNames(),ents=[],i;
  for(i=0;i<pool.length;i++){
    var found=[];
    ragScanNames(String(pool[i].summary||"").toLowerCase(),names,function(nm){if(found.indexOf(nm)<0&&found.length<12)found.push(nm);});
    ents.push(found);
  }
  ragChapterRetrieve._entMemo={fp:fp,ents:ents};
  return ents;
}
// Memo wrapper (the ragRetrieve A2 pattern). Key = the transcript memo's key (a superset of
// everything scoring reads — extra components only cause MISSES, never stale hits) plus the
// chapter pool's own fingerprint, which the transcript key can't see (summarize can archive a
// chapter without touching anything that key hashes).
function ragChapterRetrieve(inputText){
  if(!ragEnabled())return "";
  var pool=_ragChapterPool();
  if(!pool.length)return "";
  var _k=_ragRetrieveKey(inputText)+"|chap|"+pool.length+"|"+String(pool[pool.length-1].turn);
  var _m=ragChapterRetrieve._memo;
  if(_m&&_m.k===_k)return _m.v;
  ragChapterRetrieve._misses++;
  var v=_ragChapterScore(inputText,pool);
  ragChapterRetrieve._memo={k:_k,v:v};
  return v;
}
ragChapterRetrieve._memo=null;ragChapterRetrieve._entMemo=null;ragChapterRetrieve._misses=0; // test hooks
// The scoring pass — returns the PAST CHAPTERS block for buildSysPrompt's volatile half, or "".
// Same query machinery as the transcript pass (entities weighted input>scene, party demoted,
// IDF-weighted rare terms) over the far smaller chapter pool. ONE deliberate widening, ruled by
// the gate audit (both retrieval whiffs were gate failures): a chapter with NO matching entity
// still gates in when its lexical IDF sum clears RAG_CHAP_LEX_MIN — arc-shaped questions often
// carry no entity handle at all (Fable Finding 2), and a rare-term match on a tiny pool is a
// strong signal where a common term (IDF ~0 when it's in every chapter) still scores nothing.
function _ragChapterScore(inputText,pool){
  var q=ragQueryEntities(inputText||"");
  var terms=ragQueryTerms(inputText||"");
  // Entity tokens don't double-dip as lexical terms (same rule as the transcript pass).
  (function(){
    var ent={},k2,i2,keepT=[];
    for(k2 in q.input){var tk=npcCoreTokens(k2);for(i2=0;i2<tk.length;i2++)ent[tk[i2]]=1;}
    for(i2=0;i2<terms.length;i2++){if(!ent[terms[i2]])keepT.push(terms[i2]);}
    terms=keepT;
  })();
  var w={},k,hasInput=false;
  for(k in q.input){w[k]=3;hasInput=true;}
  for(k in q.scene){if(!w[k]){var pw=q.party[k]?(hasInput?0:1):2;if(pw)w[k]=pw;}}
  var gRoot={};
  for(k in q.groups){gRoot[k]=k;var gi;for(gi=0;gi<q.groups[k].length;gi++){gRoot[q.groups[k][gi]]=k;if(w[k]&&!w[q.groups[k][gi]])w[q.groups[k][gi]]=w[k];}}
  var qws={},qi;for(qi=0;qi<q.quests.length;qi++)qws[q.quests[qi].toLowerCase()]=1;
  var ents=_ragChapterEnts(pool);
  var lows=[],df=[],i,j;
  for(j=0;j<terms.length;j++)df.push(0);
  for(i=0;i<pool.length;i++){
    var lo=String(pool[i].summary||"").toLowerCase();lows.push(lo);
    for(j=0;j<terms.length;j++){if(lo.indexOf(terms[j])>=0)df[j]++;}
  }
  var N=pool.length,cands=[];
  var _res={};
  function _resolveIdx(nm){if(_res[nm]===undefined)_res[nm]=resolveNpcName(nm);return _res[nm];}
  for(i=0;i<pool.length;i++){
    var sc=0,seenG={};
    for(j=0;j<ents[i].length;j++){
      var enNm=ents[i][j];
      if(!w[enNm]){var rn=_resolveIdx(enNm);if(!w[rn])continue;enNm=rn;} // merge-orphan bridge
      var root=gRoot[enNm]||enNm;
      if(seenG[root])continue;
      seenG[root]=1;
      sc+=w[enNm];
    }
    for(k in qws){if(lows[i].indexOf(k)>=0)sc+=1;}
    var lex=0;
    for(j=0;j<terms.length;j++){if(lows[i].indexOf(terms[j])>=0)lex+=Math.log((N+1)/(df[j]+1));}
    if(sc>0)sc+=Math.min(8,lex*1.5);
    else if(lex>=RAG_CHAP_LEX_MIN)sc=lex; // the ruled gate widening — lexical-only entry
    if(sc>0)cands.push({i:i,t:pool[i].turn,sc:sc});
  }
  if(!cands.length)return "";
  cands.sort(function(a,b){return b.sc-a.sc||a.t-b.t;}); // ties toward the OLDEST (origin over echo)
  var picked=cands.slice(0,RAG_CHAP_MAX);
  picked.sort(function(a,b){return a.t-b.t;});
  var out=[],used=0,pi;
  for(pi=0;pi<picked.length;pi++){
    var idx=picked[pi].i;
    // A chapter's .turn stamps the END of its window; the previous chapter's turn bounds the start.
    var from=idx>0&&typeof pool[idx-1].turn==="number"?pool[idx-1].turn+1:1;
    var block="[Chapter — turns ~"+from+"-"+String(pool[idx].turn)+"]\n"+ragTrim(pool[idx].summary,700);
    if(used+block.length>RAG_CHAP_BUDGET)break;
    out.push(block);used+=block.length;
  }
  if(!out.length)return "";
  return "PAST CHAPTERS — compressed summaries of earlier stretches of this campaign, retrieved because they touch the people, places, or topics in play right now. This is HISTORY (oldest first): attitudes, alliances, and stakes may have CHANGED since — the CURRENT state blocks above are the truth and override anything here. Use these for continuity, callbacks, and how-the-story-got-here, never as current fact.\n"+out.join("\n")+"\n\n";
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
  var nk=Object.keys(memory.npcs);if(nk.length){var _nkS=[],_nki;for(_nki=0;_nki<nk.length;_nki++){if(memoryNpcIsPlayer(nk[_nki]))continue;_nkS.push(memory.npcs[nk[_nki]]&&memory.npcs[nk[_nki]].dead?nk[_nki]+" (dead)":nk[_nki]);}if(_nkS.length)lines.push("KNOWN NPCs: "+_nkS.join(", "));}
  // P9 (audit): blueprint import pre-files every location, so a flat "VISITED:" line told
  // the GM the party had already been to end-game sites (familiarity/spoiler drift). Split
  // on the map node's visit count; entries with NO node data are legacy saves — keep them
  // VISITED so old campaigns don't change behavior. Intentional change to BOTH rag paths.
  // #269③ (f39): keys are STORAGE, never names. The raw key list served literal pipe keys as if
  // they were location names (t2097: three of them) — and the stable-half NAMING clause ("the
  // same name IS the same entity") makes a served key an invitation to re-emit it. Resolve each
  // key through the identity overlay (deduping resolved twins — alias-repair residue included),
  // render pipe paths with the " — " convention (the buildChangedLocationsBlock precedent, ALL
  // segments), honor a repair-set display name for the leaf, and join with "; " so a
  // comma-bearing name ("Residential Quarter, Sandpoint") survives as one entry.
  var lk=Object.keys(memory.locations);
  if(lk.length){
    var _vis=[],_known=[],_locSeen={},_vk;
    for(_vk=0;_vk<lk.length;_vk++){
      var _lkR=(typeof locResolve==="function")?locResolve(lk[_vk]):lk[_vk];
      if(_locSeen[_lkR])continue;_locSeen[_lkR]=1;
      var _vn=memory.map&&memory.map.nodes?memory.map.nodes[_lkR]:null;
      var _lkP=_lkR.lastIndexOf("|"),_lkLeaf=(typeof locDisplayLeaf==="function")?locDisplayLeaf(_lkR):(_lkP<0?_lkR:_lkR.slice(_lkP+1));
      var _lkD=_lkP<0?_lkLeaf:_lkR.slice(0,_lkP).split("|").join(" — ")+" — "+_lkLeaf;
      if(_vn&&!(_vn.visits>0))_known.push(_lkD);else _vis.push(_lkD);
    }
    if(_vis.length)lines.push("VISITED: "+_vis.join("; "));
    if(_known.length)lines.push("KNOWN OF (not yet visited): "+_known.join("; "));
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
function memoryNpcDetail(name){if(memoryNpcIsPlayer(name))return"";var n=memory.npcs[name];if(!n)return"";var akaStr=n.aliases&&n.aliases.length?" (aka: "+n.aliases.join(", ")+")":"";var lines=[name+akaStr+(n.pronouns?" ["+n.pronouns+"]":"")+(n.dead?" — DECEASED"+(typeof n.dead==="number"?" (died t"+n.dead+")":""):"")+(n.attitude?" — toward you: "+n.attitude:"")],i;var _dWs=(typeof wsNpcByName==="function")?wsNpcByName(name):null;if(_dWs&&_dWs.partyMember&&_dWs.charSheet&&_dWs.charSheet.splitLoc){lines.push("  Currently: AWAY from the party at "+_dWs.charSheet.splitLoc.location+(_dWs.charSheet.splitLoc.sublocation?" ("+_dWs.charSheet.splitLoc.sublocation+")":"")+" — this line is authoritative; any position or activity claim below that contradicts it is STALE history.");}/* #144B: the zero-false-positive counter to legacy stale-posture Knows lines — a pure ADDITION, never suppression (a misclassifying suppressor would hide TRUE canon, the rebuttal-round objection) *//* v1.372: attitude is summarizer-owned and may be legitimately empty — don't render a dangling separator. v1.382: LABELLED — this is disposition toward the PLAYER, a different measurement from npc.status ("mood:" in the roster). Unlabelled, the two read as rival claims about one thing; labelled, they are complementary and the model has nothing to adjudicate. *//* B3: the detail block must carry the death — it fires on any mention */if(n.knowledge.length){var _knArr=n.knowledge.slice(),_knDrop=0;var _kn=_knArr.join("; ");while(_kn.length>2000&&_knArr.length>1){_knArr.shift();_knDrop++;_kn=_knArr.join("; ");}/* #144A: shed OLDEST whole facts under the budget — the old head-keep slice(0,2000) cut the NEWEST tail, so stale claims survived while fresh facts vanished (Sol R1) */if(_knDrop)_kn="("+_knDrop+" older facts not shown) "+_kn;if(_kn.length>2000)_kn=_kn.slice(0,2000)+" …[truncated]";/* P8 backstop: one verbose blueprint bio must not blow up the volatile prompt */lines.push("  Knows: "+_kn);}if(n.events.length){var ev=[];for(i=0;i<n.events.length;i++)ev.push("[T"+n.events[i].turn+"] "+n.events[i].note);lines.push("  History: "+ev.join("; "));}if(n.firstEncounter)lines.push("  First met: "+n.firstEncounter);return lines.join("\n");}
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
  if(!memory.npcGraph)memory.npcGraph={edges:[]};
  var edges=memory.npcGraph.edges||[];
  var player=worldState.character.name;
  // Build adjacency: node → [{other, rel, turn}]
  var adj={};
  function addAdj(from,to,rel,turn){if(!adj[from])adj[from]=[];adj[from].push({other:to,rel:rel,turn:turn});}
  // #269② (f38): the W7 bond is THE authoritative player↔NPC claim; a legacy [NPC_LINK:] edge
  // for a pair that has a live bond is SUPPRESSED from the projection (both directions — the
  // edge store keeps its row untouched). Serving both re-created the #61 re-injected-
  // contradiction class ("Morwen(companions)" beside "Morwen(Wife)" every turn, t2097) — and the
  // rival claim is usually ENGINE-seeded: startGame, companion import, and PC swap each plant a
  // "companions" edge with no path to retire it. Display-side precedence, no data change.
  var rels=relationshipRows(worldState.character,null),bonded={},ri;
  for(ri=0;ri<rels.length;ri++){if(rels[ri].bond)bonded[rels[ri].entity]=1;}
  for(var i=0;i<edges.length;i++){
    if((edges[i].a===player&&bonded[edges[i].b])||(edges[i].b===player&&bonded[edges[i].a]))continue;
    addAdj(edges[i].a,edges[i].b,edges[i].rel,edges[i].turn);
    addAdj(edges[i].b,edges[i].a,edges[i].rel,edges[i].turn);
  }
  // Player→NPC from character.relationships
  for(ri=0;ri<rels.length;ri++){
    if(rels[ri].bond)addAdj(player,rels[ri].entity,rels[ri].bond,rels[ri].bondTurn||0);
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
    if(npc.attitude)meta.push("toward you: "+npc.attitude);/* v1.382: labelled — see memoryNpcDetail. This is the graph node's disposition, NOT the roster's mood. */
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
/* Entry guards (v1.439, F8 — brief A probe F): a null/malformed sessionLog entry used to throw
   HERE, before summarize()'s try even existed — no catch, no report, no retry counter. */
function sessionTokens(){var total=0,i;for(i=sessKeptStart();i<sessionLog.length;i++){var _se=sessionLog[i];if(_se&&!_se.bk&&_se.content!=null)total+=String(_se.content).length;}return Math.ceil(total/4);}
// ── #57 reveal-commitment: knowledge supersession + fork hints ───────────────────
// Serve-side of leg A (see DOC/todos_completed/todo_57_reveal_commitment.md): the extractor can only retire a
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
// ── #148 Phase 2: ERAS — the third story-memory tier ─────────────────────────────────────────
// Chapters compress the session; eras compress ARCHIVED chapters. The recall gate ruled the era
// arm the always-on spine (zero confabulation across the run — the property an always-injected
// tier must have; it carried the arc-scale questions the retrieval gate structurally misses).
// Era records are provenance-stamped and REBUILDABLE: chapters are immutable, so a bad era can
// always be re-compiled from its sourceChapterTurns (the launder-a-mistake objection answered).
// WRITE SIDE lives here beside fileChapter; the read side is buildErasBlock (api.js, volatile).
var ERA_CHAP_BATCH=20;      // fallback boundary: compile once this many archived chapters are uncovered
var ERA_MIN_CHAPTERS=3;     // an act boundary cuts an era only with at least this many chapters behind it
var ERAS_BUDGET_CHARS=4000; // ~1000 tok of era text — over it, maintenance merges the two OLDEST eras
function memEras(){if(!memory.eras)memory.eras=[];return memory.eras;}
function eraCoveredEnd(){var e=memEras();return e.length?e[e.length-1].turnRange[1]:0;}
// The boundary rule, ruled 2026-08-08: skeleton act completions win where stamped (an arc can
// straddle a fixed batch — Sol's objection); else every ERA_CHAP_BATCH archived chapters. Acts
// completed before the completedTurn stamp existed (pre-v1.575 saves) simply fall through to
// the batch rule. A stamped boundary with under ERA_MIN_CHAPTERS uncovered chapters is skipped
// (no degenerate one-chapter eras — those chapters roll into the next era instead). Pure and
// deterministic; returns {sources:[chapters], boundary:"act@tN"|"batch"} or null when not due.
function eraNextSources(){
  var arch=(memory.archive&&memory.archive.chapters)?memory.archive.chapters:[];
  var end=eraCoveredEnd(),unc=[],i,j;
  for(i=0;i<arch.length;i++){if(typeof arch[i].turn==="number"&&arch[i].turn>end)unc.push(arch[i]);}
  if(!unc.length)return null;
  var actTurns=[],sk=(typeof worldState!=="undefined"&&worldState)?worldState.skeleton:null;
  if(sk&&sk.acts){for(i=0;i<sk.acts.length;i++){if(sk.acts[i].status==="completed"&&typeof sk.acts[i].completedTurn==="number"&&sk.acts[i].completedTurn>end)actTurns.push(sk.acts[i].completedTurn);}}
  actTurns.sort(function(a,b){return a-b;});
  for(i=0;i<actTurns.length;i++){
    var upto=[];
    for(j=0;j<unc.length;j++){if(unc[j].turn<=actTurns[i])upto.push(unc[j]);}
    if(upto.length>=ERA_MIN_CHAPTERS)return {sources:upto,boundary:"act@t"+actTurns[i]};
  }
  if(unc.length>=ERA_CHAP_BATCH)return {sources:unc.slice(0,ERA_CHAP_BATCH),boundary:"batch"};
  return null;
}
// Era record builder — call BEFORE pushing (turnRange starts where coverage currently ends).
function eraRecord(summary,sources){
  var st=[],i;for(i=0;i<sources.length;i++)st.push(sources[i].turn);
  return {summary:String(summary||"").trim(),turnRange:[eraCoveredEnd()+1,st[st.length-1]],sourceChapterTurns:st,compiledAt:(typeof worldState!=="undefined"&&worldState)?worldState.turn:0};
}
function erasOverBudget(){var e=memEras(),n=0,i;for(i=0;i<e.length;i++)n+=String(e[i].summary||"").length;return n>ERAS_BUDGET_CHARS&&e.length>=2;}
// Merge the two OLDEST eras into one (the recursive over-budget compaction — bounded at any
// campaign length because each merge halves the head of the list). Provenance is the UNION, so
// rebuildability survives arbitrarily many merges.
function eraApplyMerge(summary){
  var e=memEras();if(e.length<2)return false;
  var m={summary:String(summary||"").trim(),turnRange:[e[0].turnRange[0],e[1].turnRange[1]],sourceChapterTurns:e[0].sourceChapterTurns.concat(e[1].sourceChapterTurns),compiledAt:(typeof worldState!=="undefined"&&worldState)?worldState.turn:0};
  memory.eras=[m].concat(e.slice(2));
  return true;
}
// Prompt composers + response appliers — SYNC and pure-ish (appliers mutate memory.eras only on
// a valid response; anything malformed throws and leaves memory untouched), split from the async
// orchestrator so every decision is engine-testable without an API call — the applySummaryExtract
// discipline. The prompts forbid invention outright: the recall gate measured the era arm's
// zero-confabulation property as its shipping requirement — prefer omission over guessing.
function eraCompilePrompt(sources){
  var lines=[],i;for(i=0;i<sources.length;i++)lines.push("[t"+sources[i].turn+"] "+sources[i].summary);
  var ids=typeof buildSummaryIdentityBlock==="function"?buildSummaryIdentityBlock(summaryIdentityTable(lines.join("\n"))):"";
  return "Compress this sequence of RPG campaign chapter summaries into ONE era summary of at most 150 tokens (5-7 tight sentences). Keep: major plot movements, the named characters who mattered, decisive outcomes, permanent changes to people and places. Drop: scene detail, travel, color. NEVER state anything the chapters do not contain — prefer omission over guessing.\n"+ids+"CHAPTERS (oldest first):\n"+lines.join("\n")+"\nOutput ONLY valid JSON, no markdown: {\"summary\":\"\"}";
}
function eraMergePrompt(eraA,eraB){
  var raw=String(eraA.summary||"")+"\n"+String(eraB.summary||""),ids=typeof buildSummaryIdentityBlock==="function"?buildSummaryIdentityBlock(summaryIdentityTable(raw)):"";
  return "Merge these two consecutive RPG campaign era summaries into ONE era summary of at most 150 tokens. Keep only what still matters at campaign scale; NEVER state anything the eras do not contain.\n"+ids+"ERA 1: "+eraA.summary+"\nERA 2: "+eraB.summary+"\nOutput ONLY valid JSON, no markdown: {\"summary\":\"\"}";
}
function eraApplyCompileResp(resp,due){
  var got=JSON.parse(repairModelJson(resp));
  if(!got||!got.summary||!String(got.summary).trim())throw new Error("era summary empty");
  if(typeof w6ValidateSummary==="function"){var raw=[],_eci,_ect;for(_eci=0;_eci<due.sources.length;_eci++)raw.push(String(due.sources[_eci].summary||""));_ect=summaryIdentityTable(raw.join("\n"));buildSummaryIdentityBlock(_ect);w6ValidateSummary({chapterSummary:String(got.summary)},_ect);}
  memEras().push(eraRecord(got.summary,due.sources));
  var _nr=memEras()[memEras().length-1];
  if(typeof console!=="undefined")console.info("[memory] #148: era compiled ("+due.boundary+") — turns "+_nr.turnRange[0]+"-"+_nr.turnRange[1]+" from "+due.sources.length+" chapters ("+memEras().length+" eras total)");
}
function eraApplyMergeResp(resp){
  var got=JSON.parse(repairModelJson(resp));
  if(!got||!got.summary||!String(got.summary).trim())throw new Error("era merge summary empty");
  if(typeof w6ValidateSummary==="function"){var _emt=summaryIdentityTable(memEras().slice(0,2).map(function(e){return String(e.summary||"");}).join("\n"));buildSummaryIdentityBlock(_emt);w6ValidateSummary({chapterSummary:String(got.summary)},_emt);}
  eraApplyMerge(got.summary);
  if(typeof console!=="undefined")console.info("[memory] #148: era text over budget — two oldest merged ("+memEras().length+" eras remain)");
}
// The maintenance orchestrator — fire-and-forget from summarize()'s success path. ONE model
// call per invocation (a compile, or if none is due, an over-budget merge), so a summarize
// cycle never stacks era work; the next cycle continues. Failure is LOUD and leaves memory
// untouched — the era simply compiles on a later cycle (chapters are immutable, nothing is
// lost by waiting).
var _eraBusy=false;
async function compileEraIfDue(){
  if(_eraBusy)return;
  var due=eraNextSources();
  var mergeDue=!due&&erasOverBudget();
  if(!due&&!mergeDue)return;
  _eraBusy=true;
  try{
    if(due){
      var resp=await callGM(eraCompilePrompt(due.sources),"You are a compression system. Output ONLY valid JSON. No prose, no markdown, no backticks.",600,null,{kind:"era",noHistory:true});
      eraApplyCompileResp(resp,due);
      saveMem();
    }else{
      var e2=memEras();
      var resp2=await callGM(eraMergePrompt(e2[0],e2[1]),"You are a compression system. Output ONLY valid JSON. No prose, no markdown, no backticks.",600,null,{kind:"era",noHistory:true});
      eraApplyMergeResp(resp2);
      saveMem();
    }
  }catch(eErr){
    if(typeof console!=="undefined")console.warn("[memory] #148: era compile failed ("+(eErr&&eErr.message?eErr.message:eErr)+") — memory untouched, retries after a later summarize");
  }
  _eraBusy=false;
}
// Files one extraction result into memory/worldState — split from summarize() so the filing
// rules (the #29 resolve→expire→file order, near-dup dedupe) are testable without an API call.
// Returns a stats object ({superseded, supersededNames}) so summarize() can surface what was
// retired in the visible "Memory updated" line (#57 — no silent memory surgery).
/* P5① (workdone_sol_review): the CANON-CONTRADICTION tripwire. The t1781 body-double was fed
   by a two-truths state that sat unnoticed for ~100 turns: roster dead=1648 beside knowledge
   text asserting present survival. Detection is deliberately narrow: a dead-stamped roster NPC
   whose knowledge asserts PRESENT-tense survival (is alive / survives / still lives / "now
   rallies…"). Past-tense "survived the raid as a child" is history and never trips. One latch
   at a time, per-NPC cooldown, GM-decides — the engine never edits the text itself. */
var CANON_CONTRA_RE=/\b(is (?:still )?alive|survives\b|still (?:alive|lives|breathes|commands|leads|rules)|lives on\b|walked out (?:of .{0,40})?alive)/i;
var CANON_CONTRA_NOW_RE=/\bsurviv\w*\b[\s\S]{0,120}?\b(?:now|remains|continues|still)\b/i;
/* P7 (workdone_sol_review; the W6 deferred item, owner go 2026-08-13): UNREGISTERED RECURRING
   NAMES. W6 validates only registered NPCs and explicit pronouns, so a character the GM keeps
   using without a [NPC:] tag escapes identity validation entirely. The scan walks the recent
   transcript for a capitalized token (optionally two words) that (a) recurs in >=
   RECURRING_NAME_MIN_TURNS distinct GM turns, (b) appears MID-SENTENCE at least once (a
   sentence-start-only word is capitalization, not identity), and (c) is not the hero, a roster
   NPC or alias, a map node, or a faction. Proposal-first: a GM-decides note offers [NPC:X|...]
   or explicit ignore; two ignored nudges retire the name forever. The engine never registers. */
var RECURRING_NAME_STOP={"Monday":1,"Tuesday":1,"Wednesday":1,"Thursday":1,"Friday":1,"Saturday":1,"Sunday":1,"Aunt":1,"Uncle":1,"Mother":1,"Father":1,"Brother":1,"Sister":1,"Cousin":1,"Lady":1,"Lord":1,"Sir":1,"Master":1,"Mistress":1,"Captain":1,"Sheriff":1,"Justice":1,"Mayor":1,"Another":1,"Something":1,"Anyone":1,"Anything":1,"One":1,"Two":1,"Three":1,"Four":1,"Five":1,"Six":1,"Seven":1,"Eight":1,"Nine":1,"Ten":1,"First":1,"Second":1,"Third":1,"Last":1,"Every":1,"Each":1,"Both":1,"Most":1,"More":1,"Some":1,"All":1,"None":1,"Half":1,"The":1,"A":1,"An":1,"You":1,"Your":1,"He":1,"She":1,"They":1,"It":1,"But":1,"And":1,"Then":1,"Now":1,"Not":1,"No":1,"Yes":1,"If":1,"When":1,"Where":1,"What":1,"Who":1,"Why":1,"How":1,"His":1,"Her":1,"Their":1,"Its":1,"This":1,"That":1,"These":1,"Those":1,"There":1,"Here":1,"Once":1,"Again":1,"Even":1,"Still":1,"Suddenly":1,"Word":1,"Nothing":1,"Nobody":1,"Someone":1,"Everything":1,"Everyone":1,"Inside":1,"Outside":1,"Beyond":1,"Behind":1,"Before":1,"After":1,"Day":1,"Night":1,"Morning":1,"Evening":1,"Dawn":1,"Dusk":1,"North":1,"South":1,"East":1,"West":1,"GM":1,"OK":1};
function _recurringKnownName(word){
  var low=word.toLowerCase();
  if(worldState.character&&String(worldState.character.name||"").toLowerCase().indexOf(low)>=0)return true;
  var i,ns=worldState.npcs||[];
  for(i=0;i<ns.length;i++){if(String(ns[i].name).toLowerCase().indexOf(low)>=0)return true;var al=(ns[i].aliases||[]).concat((memory.npcs&&memory.npcs[ns[i].name]&&memory.npcs[ns[i].name].aliases)||[]),j;for(j=0;j<al.length;j++)if(String(al[j]).toLowerCase()===low)return true;}
  var mk;for(mk in (memory.npcs||{}))if(mk.toLowerCase().indexOf(low)>=0)return true;
  var nodes=(memory.map&&memory.map.nodes)||{};for(mk in nodes){var leaf=(typeof locDisplayLeaf==="function")?locDisplayLeaf(mk):mk;if(String(leaf).toLowerCase().indexOf(low)>=0||mk.toLowerCase().indexOf(low)>=0)return true;}
  var fx=(memory.npcGraph&&memory.npcGraph.factions)||{};for(mk in fx)if(mk.toLowerCase().indexOf(low)>=0)return true;
  var q=(worldState.questLog||[]),qi;for(qi=0;qi<q.length;qi++)if(String(q[qi].title).toLowerCase().indexOf(low)>=0)return true;
  if(typeof capabilityLookup==="function"&&capabilityLookup(word))return true;/* corpus finding: spell names (Message, Silence, Phantasmal Force) recur like characters */
  var inv=(worldState.character&&worldState.character.inventory)||[],ii;for(ii=0;ii<inv.length;ii++)if(typeof inv[ii]==="string"&&inv[ii].toLowerCase().indexOf(low)>=0)return true;/* corpus finding: a NAMED ITEM (Cleaver) recurs like a character */
  return false;
}
function recurringNameScan(){
  if(typeof worldState==="undefined"||!worldState||worldState.recurringNamePing)return;
  var tr=(worldState.transcript||[]).slice(-16),cand={},i,j;
  for(i=0;i<tr.length;i++){
    var e=tr[i];if(!e||e.r!=="gm"||!e.x)continue;
    var text=String(e.x).replace(/"[^"]*"/g," ").replace(/\u201c[^\u201d]*\u201d/g," ");
    var re=/([A-Z][a-z\u00e0-\u00ff'\u2019-]{2,})(\s+[A-Z][a-z\u00e0-\u00ff'\u2019-]{2,})?/g,m;
    while((m=re.exec(text))){
      var name=m[0].replace(/[’']s?$/,""),first=m[1].replace(/[’']s?$/,"");/* corpus finding: possessives (Morwen’s) evaded the roster check and contractions (You’re) leaked through */
      if(/[’']/.test(name))continue;
      if(RECURRING_NAME_STOP[first])continue;
      var midSentence=m.index>0&&!/[.!?\n]\s*$/.test(text.slice(0,m.index));
      var c=cand[name]||(cand[name]={turns:{},mid:false});
      c.turns[e.t||i]=1;if(midSentence)c.mid=true;
    }
  }
  var names=Object.keys(cand),best=null;
  for(i=0;i<names.length;i++){
    var nm=names[i],c2=cand[nm],turnCount=Object.keys(c2.turns).length;
    if(turnCount<RECURRING_NAME_MIN_TURNS||!c2.mid)continue;
    var nudged=worldState.recurringNameNudged&&worldState.recurringNameNudged[nm];
    if(nudged&&(nudged.count>=RECURRING_NAME_MAX_NUDGES||(worldState.turn-nudged.turn)<RECURRING_NAME_COOLDOWN))continue;
    if(_recurringKnownName(nm))continue;
    if(!best||turnCount>best.count)best={name:nm,count:turnCount};
  }
  if(best){worldState.recurringNamePing={name:best.name,count:best.count,turn:worldState.turn};
    if(typeof console!=="undefined")console.info("[identity] unregistered recurring name detected: "+best.name+" ("+best.count+" turns) — registration note armed (P7)");}
}
function canonContradictionScan(){
  if(typeof worldState==="undefined"||!worldState||worldState.canonContradiction)return;
  var ns=worldState.npcs||[],i,j;
  for(i=0;i<ns.length;i++){
    var n=ns[i];if(!n||!npcIsDead(n))continue;
    var mm=memory.npcs&&memory.npcs[n.name];if(!mm||!mm.knowledge)continue;
    var cd=worldState.canonContraNudged&&worldState.canonContraNudged[n.name];
    if(cd!=null&&(worldState.turn-cd)<CANON_CONTRA_COOLDOWN)continue;
    for(j=0;j<mm.knowledge.length;j++){
      var line=String(mm.knowledge[j]||"");
      if(CANON_CONTRA_RE.test(line)||CANON_CONTRA_NOW_RE.test(line)){
        worldState.canonContradiction={name:n.name,line:line.slice(0,200),deadTurn:n.dead||mm.dead||0,turn:worldState.turn};
        if(typeof console!=="undefined")console.warn("[canon] contradiction: "+n.name+" is roster-DEAD but knowledge asserts survival — GM note armed (P5①)");
        return;
      }
    }
  }
}
function applySummaryExtract(extracted,identityTable){
  /* #168R2 (entry-13 review): the extractor may return prose tiers as ARRAYS; _w6SummaryTexts validates only
     strings, so an array-valued chapterSummary skipped identity validation entirely and filed the raw t1644
     contradiction into chapters + eventHistory — the exact class W6 shipped to close, back through a type
     variation. Normalize BEFORE the preflight so validation sees exactly what filing will write; an unusable
     shape is dropped LOUDLY and never filed. */
  if(extracted&&typeof extracted==="object"){
    var _snProse=function(v){var o=[],k;if(typeof v==="string")return v;if(!Array.isArray(v))return null;for(k=0;k<v.length;k++){if(typeof v[k]==="string")o.push(v[k]);else if(Array.isArray(v[k]))o.push(v[k].filter(function(x){return typeof x==="string";}).join(" "));else return null;}return o.join(" ");};
    var _snLists=["loreDiscovered","decisionsMade","resolvedEvents"],_snf,_snv,_sni,_snn;
    if(extracted.chapterSummary!=null&&typeof extracted.chapterSummary!=="string"){_snn=_snProse(extracted.chapterSummary);if(_snn!=null)extracted.chapterSummary=_snn;else{if(typeof console!=="undefined")console.warn("[memory] chapterSummary had an unusable shape — dropped, not filed (#168R2)");delete extracted.chapterSummary;}}
    for(_snf=0;_snf<_snLists.length;_snf++){_snv=extracted[_snLists[_snf]];if(Array.isArray(_snv))for(_sni=0;_sni<_snv.length;_sni++)if(_snv[_sni]!=null&&typeof _snv[_sni]!=="string"){_snn=_snProse(_snv[_sni]);if(_snn!=null)_snv[_sni]=_snn;else{if(typeof console!=="undefined")console.warn("[memory] "+_snLists[_snf]+"["+_sni+"] had an unusable shape — dropped, not filed (#168R2)");_snv.splice(_sni,1);_sni--;}}}
    var _snFE=extracted.futureEvents;if(Array.isArray(_snFE))for(_sni=0;_sni<_snFE.length;_sni++)if(_snFE[_sni]&&typeof _snFE[_sni]==="object"){if(_snFE[_sni].what!=null&&typeof _snFE[_sni].what!=="string"){_snn=_snProse(_snFE[_sni].what);if(_snn!=null)_snFE[_sni].what=_snn;}if(_snFE[_sni].when!=null&&typeof _snFE[_sni].when!=="string"){_snn=_snProse(_snFE[_sni].when);if(_snn!=null)_snFE[_sni].when=_snn;}}
  }
  if(typeof validateSummaryExtract==="function")validateSummaryExtract(extracted,identityTable);/* #168 W2/W6: whole-extraction preflight before any tier can ratchet disputed identity */
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
    fileNpcKnowledge(sfName,newFact,worldState.turn,true);/* #269①: preferNew — the superseding fact beats any near-dup stale survivor; #144A archiving lives in the helper */
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
      _queueMergeHint(snC,snD);/* #128: shared queue discipline (once-ever latch both orders + pending dedupe) — one implementation for both producers */
    }
  }
  // B3 backstop: deaths the GM narrated but never tagged (the docks class — the kill that spawned
  // this bug left ZERO structured record). Only stamps NPCs already ON FILE — the extractor must
  // never mint a corpse the world doesn't know; a wrong stamp is loud, visible (DECEASED line),
  // and reversible via [NPC:name|resurrected|...].
  if(Array.isArray(extracted.npcDeaths)){for(i=0;i<extracted.npcDeaths.length;i++){var nd=extracted.npcDeaths[i];if(!nd)continue;
    var ndRaw=(typeof nd==="object"&&nd.name)?nd.name:nd,ndName=resolveNpcName(String(ndRaw)),ndWs=(typeof wsNpcByName==="function")?wsNpcByName(ndName):null;
    if(memoryNpcIsPlayer(ndName)){if(typeof console!=="undefined")console.warn("[memory] npcDeaths rejected the player identity '"+ndName+"' — player canon never enters memory.npcs");continue;}
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
  if(Array.isArray(extracted.npcUpdates)){for(i=0;i<extracted.npcUpdates.length;i++){var nu=extracted.npcUpdates[i];if(nu&&nu.name){var nuName=resolveNpcName(nu.name);if(memoryNpcIsPlayer(nuName)){if(typeof console!=="undefined")console.warn("[memory] npcUpdates rejected the player identity '"+nuName+"' — player canon stays on the character sheet");continue;}if(!memory.npcs[nuName])memory.npcs[nuName]={attitude:"",knowledge:[],events:[],aliases:[]};if(nu.attitude)memory.npcs[nuName].attitude=clampNpcMood(nu.attitude);if(nu.knowledgeGained){var _kgV=nu.knowledgeGained,_kgFact=null,_kgScene=false;if(typeof _kgV==="object"&&_kgV&&_kgV.fact){_kgFact=String(_kgV.fact);_kgScene=String(_kgV.kind||"").toLowerCase()==="scene";}else if(typeof _kgV==="string")_kgFact=_kgV;/* #144B: the extractor now TYPES facts — durable (standing truth) vs scene (true only in the moment); unknown kind defaults durable, the safe side now that evictions archive (#144A). The legacy string shape stays byte-compatible. */if(_kgFact&&_kgScene){fileNpcEvent(nuName,_kgFact,worldState.turn);/* scene facts are dated history, never standing Knows — the t1549 stale-posture class (Sol R1) */}else if(_kgFact){fileNpcKnowledge(nuName,_kgFact,worldState.turn,false);/* #269①: near-dup folds (richer wins, loser archived) instead of twinning; #144A archiving lives in the helper */}}}}}/* dedupe + cap knowledge so ACTIVE NPC DETAILS can't grow unbounded (audit E51) */
  if(Array.isArray(extracted.loreDiscovered)){for(i=0;i<extracted.loreDiscovered.length;i++)fileLore(extracted.loreDiscovered[i]);}
  if(Array.isArray(extracted.decisionsMade)){for(i=0;i<extracted.decisionsMade.length;i++)fileDecision(worldState.turn,extracted.decisionsMade[i]);}
  // #128: the deterministic variant scan runs every summarize — after npcUpdates above, so keys
  // minted THIS window are already on file. The extractor's own sameNpc hints queued first
  // (session-confirmed evidence outranks token containment); buildMergeConfirmNudge drains one
  // pair per turn regardless.
  scanNpcNameVariants();
  // #29 order matters: sweep stale → file new → resolve LAST. Resolving last means an event the
  // extractor lists in BOTH futureEvents and resolvedEvents (set and finished inside one window)
  // nets out removed — the near-dup filing collapses it onto the existing entry, then resolve
  // deletes it. Resolve-first would delete then re-file it as fresh pending.
  expireFutureEvents();
  if(Array.isArray(extracted.futureEvents)){for(i=0;i<extracted.futureEvents.length;i++){var fe=extracted.futureEvents[i];if(fe&&fe.what)fileFutureEvent(fe.when||"soon","",fe.what,worldState.turn);}}
  if(Array.isArray(extracted.resolvedEvents)){for(i=0;i<extracted.resolvedEvents.length;i++)resolveFutureEvent(extracted.resolvedEvents[i]);}
  canonContradictionScan();/* P5①: after all tiers land, look for the two-truths state */
  recurringNameScan();/* P7: and for characters the GM keeps using without registering */
  // Chapter filed LAST (audit E46) so a throw in an earlier step can't leave a duplicated chapter
  // when summarize retries the same window.
  if(extracted.chapterSummary){fileChapter(worldState.turn,extracted.chapterSummary);futureResolveAssist(extracted.chapterSummary);}
  // #147: a completed extraction SAW the corrected exchange while it was still in the session
  // window — the correction pin's job is done. Archive it (never a silent drop). Runs after the
  // chapter file so a throw in any earlier step keeps the pin alive for the retry.
  if(typeof worldState!=="undefined"&&worldState&&worldState.retconPin){memArchive().retconPins.push(worldState.retconPin);delete worldState.retconPin;}
  if(typeof sceneRefsSummarySuccess==="function")sceneRefsSummarySuccess();
  if(typeof w2TxnSummaryRetire==="function")w2TxnSummaryRetire();/* #168R3: committed receipts retire once out of replay range; the overflow latch recovers *//* active evidence remains; only safely covered transitioned frames retire */
  return stats;
}
// ── #10 (B11): keep the gameplay channel's imperatives out of the JSON channel ────────────────
// Root cause (BUGS.md B11, 2026-07-21, high confidence): sendAction prepends engine notes to the
// OUTGOING user message and commitGmTurn archives that exact string — so summarize() replayed
// them into the extraction call, and on a quest-escalation turn the 500-char user slice was 100%
// engine imperative ending in "emit [QUEST_STEP:…]". The extractor obeyed IT and answered in
// state tags instead of JSON. Notes are engine-authored and exactly delimited, so they are
// stripped from the SESSION slice ONLY — #57 RECORDED-FACTS detection stays on the UNSTRIPPED
// window (the sketch's critical refinement: names appearing only inside notes must keep serving
// their recorded facts, or supersession silently narrows).
// Bracket-depth scan, not a regex: notes NEST brackets ("…emit [QUEST_STEP:…].]"), so [^\]]*
// would strip half a note and leave residue. An unclosed note swallows to end-of-string — a
// malformed note never reaches the extractor either.
function stripEngineNotes(s){
  s=String(s||"");
  var out="",i=0;
  while(i<s.length){
    if(s.charAt(i)==="["&&s.slice(i,i+12)==="[ENGINE NOTE"){ /* covers "[ENGINE NOTE —" and "[ENGINE NOTES PROTOCOL:" */
      var depth=0,j=i;
      for(;j<s.length;j++){var ch=s.charAt(j);if(ch==="[")depth++;else if(ch==="]"){depth--;if(depth===0){j++;break;}}}
      i=j;
      continue;
    }
    out+=s.charAt(i);i++;
  }
  return out.replace(/^\s+/,"");
}
// The B11 failure shape verbatim: a response with no "{" anywhere has zero JSON in it — exactly
// the case repairModelJson cannot and should not repair. Refused at the CALL SITE with a named
// error (repairModelJson is shared by 8 call sites and stays untouched).
function extractorRespHasJson(resp){return String(resp||"").indexOf("{")>=0;}
// Pure prompt composer — factored so the two load-bearing properties are engine-testable:
// the schema + JSON directive sit LAST (end-of-prompt position is load-bearing, audit #2 — the
// discipline already applied at campaign_generator.js and blueprint-designer.html), and the
// SESSION block is the note-stripped text while RECORDED FACTS detects on the raw window.
function buildExtractPrompt(chapterDesc,pend,sessRaw,sessStripped,identityTable){
  var p="Extract structured data from this RPG session.\n";
  if(typeof buildSceneRefBlock==="function")p+="\n"+buildSceneRefBlock();/* #168: exact handles/exclusions survive the transcript's summarize boundary */
  if(pend.length)p+="\nANTICIPATED EVENTS currently on file — if this session shows one has already happened, failed, or become moot, copy its EXACT text into resolvedEvents:\n- "+pend.join("\n- ")+"\n";
  p+=buildRecordedFactsBlock(sessRaw);/* #57 leg A serve-side — "" when no known NPC appears in the window */
  if(typeof buildSummaryIdentityBlock==="function")p+="\n"+buildSummaryIdentityBlock(identityTable&&identityTable.rows?identityTable:summaryIdentityTable(sessRaw));
  p+="\nSESSION:\n"+sessStripped;
  p+="\nREFERENTIAL SCHEMA OVERRIDE: npcDeaths MUST be objects shaped [{\"name\":\"exact on-file NPC name\",\"handle\":\"scene handle\",\"sourceTurn\":0,\"canonTxnId\":\"stable id if one exists\"}], never bare strings. Cite only prior engine-authoritative SCENE REFERENTS. If the victim is anonymous, omit npcDeaths rather than substituting a known name. A death-like chapter sentence without a matching cited npcDeaths object is rejected as a whole.\n";
  p+="\nOutput ONLY valid JSON, no markdown:\n{\"chapterSummary\":\""+chapterDesc+"\",\"npcUpdates\":[{\"name\":\"\",\"attitude\":\"how this NPC regards the PLAYER in 2-4 words -- their standing DISPOSITION (e.g. 'wary, testing' or 'openly loyal'), NOT their momentary mood, which the engine tracks separately\",\"knowledgeGained\":{\"fact\":\"\",\"kind\":\"durable = standing truth about the person or world (secrets, history, learned facts, commitments); scene = true only in that moment (where they stood, what they were doing) -- scene facts are filed as dated history, never as permanent knowledge\"}}],\"loreDiscovered\":[\"string\"],\"decisionsMade\":[\"string\"],\"futureEvents\":[{\"what\":\"\",\"when\":\"\"}],\"resolvedEvents\":[\"string\"],\"supersededFacts\":[{\"name\":\"\",\"old\":\"exact text of the outdated recorded fact\",\"new\":\"the fact that replaces it\"}],\"sameNpc\":[{\"canonical\":\"\",\"duplicate\":\"\"}],\"npcDeaths\":[{\"name\":\"exact on-file NPC name\",\"handle\":\"scene handle\",\"sourceTurn\":0,\"canonTxnId\":\"stable id if one exists\"}]}\n";
  return p;
}
var _sumFails=0; // runtime mirror of worldState.summaryFailure.count; persisted state is authoritative across reloads
function summaryFailureBump(e){
  var old=worldState&&worldState.summaryFailure,prior=old&&typeof old.count==="number"?old.count:0,isIdentity=!!(e&&(e.summaryIdentity||e.w2Identity)),msg="unknown";try{msg=(e&&e.message!=null)?String(e.message):String(e);}catch(_sfb){}
  /* #190ⓔ: a DEFERRED identity failure (subject owned by an open tag-lane conflict) never advances
     the strike count — the log is kept and summarize retries naturally; the #17 panel already
     shows the owning conflict. Strikes resume the moment the conflict resolves or shelves stale. */
  if(e&&e.w2Defer){if(typeof console!=="undefined")console.warn("[memory] summary failure deferred, strike count stays "+prior+" of 3 (#190e)");
    /* #263 (JP0-13/f41): record WHO owns the deferral so the next attempts can be skipped instead
       of billed. The old shape re-sent the whole growing window as a doomed extraction call and
       printed a failure line EVERY turn for the deferral's whole life (~15-20 turns to stale). */
    if(worldState){if(!worldState.summaryFailure)worldState.summaryFailure={count:prior,firstTurn:worldState.turn,lastTurn:worldState.turn,kind:"identity-validation",reason:"deferred",subject:e.subject?String(e.subject).slice(0,120):"",identityValidation:true};
      if(!worldState.summaryFailure.deferSubject){worldState.summaryFailure.deferSubject=e.subject?String(e.subject).slice(0,120):"?";worldState.summaryFailure.deferSince=worldState.turn;}}
    return prior;}
  if(!worldState)return Math.min(3,prior+1);
  worldState.summaryFailure={count:Math.min(3,prior+1),firstTurn:old&&old.firstTurn!=null?old.firstTurn:worldState.turn,lastTurn:worldState.turn,kind:isIdentity?"identity-validation":"extraction",reason:msg.slice(0,400),subject:e&&e.subject?String(e.subject).slice(0,120):"",identityValidation:!!(isIdentity||(old&&old.identityValidation))};
  return worldState.summaryFailure.count;
}
function summaryFailureClear(){if(worldState&&worldState.summaryFailure)delete worldState.summaryFailure;_sumFails=0;}
function summaryIdentityQuarantine(e,rawBits,attempts){
  var a=memArchive().identityQuarantines,msg="unknown";try{msg=(e&&e.message!=null)?String(e.message):String(e);}catch(_siq){}
  a.push({turn:(worldState&&worldState.turn)||0,kind:e&&e.summaryIdentity?"summary-validation":"referential-validation",subject:e&&e.subject?String(e.subject).slice(0,120):"",reason:msg.slice(0,400),attempts:attempts||3,raw:(rawBits||[]).join(" ... ").slice(0,900)});
  while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP){var _ev=a.shift();if(typeof console!=="undefined")console.warn("[identity] oldest identity quarantine EVICTED (t"+(_ev&&_ev.turn)+", "+((_ev&&_ev.subject)||"-")+") — the archive is at its cap of "+SUMMARY_IDENTITY_QUARANTINE_CAP+" (P3: eviction is never silent)");}return a[a.length-1];
}
/* #263 (JP0-13/f41): the defer gate. While a deferred summary failure's owning tag-lane conflict
   is still LIVE (open, non-stale), another extraction attempt is unresolvable by construction —
   the #190ⓔ deferral already refuses to strike, so attempting it just bills a doomed call and
   prints a failure line at the player, every turn, for the conflict's whole life. Skip quietly.
   The deferral cannot disable the terminal ladder: a resolved/shelved conflict OR the
   SUMMARY_DEFER_TURNS cap ends it (the stamp clears, the next attempt runs, strikes resume). */
function summarizeShouldDefer(){
  if(typeof worldState==="undefined"||!worldState||!worldState.summaryFailure)return false;
  var sf=worldState.summaryFailure;
  if(!sf.deferSubject)return false;
  var live=false,q=worldState.identityConflicts||[],i;
  for(i=0;i<q.length;i++)if(!q[i].resolved&&!q[i].stale&&q[i].subject===sf.deferSubject){live=true;break;}
  var capped=(worldState.turn-(sf.deferSince||0))>=SUMMARY_DEFER_TURNS;
  if(live&&!capped)return true;
  if(typeof console!=="undefined")console.info("[memory] #263: summary deferral for "+sf.deferSubject+" ended ("+(live?"cap reached":"conflict resolved or shelved")+") — extraction attempts resume");
  delete sf.deferSubject;delete sf.deferSince;
  return false;
}
async function summarize(){
  if(sessionTokens()<SUMMARIZE_AT)return;
  if(summarizeShouldDefer()){if(typeof console!=="undefined")console.info("[memory] #263: extraction attempt skipped — the "+worldState.summaryFailure.deferSubject+" dispute owns this window; no call billed, no strike counted");return;}
  addMsg("system","Filing memories...");
  try{
    var _sumVc="";var _sumPaId=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:"";if(_sumPaId&&typeof AUTHORS!=="undefined"){var _spi;for(_spi=0;_spi<AUTHORS.length;_spi++){if(AUTHORS[_spi].id===_sumPaId&&AUTHORS[_spi].vc){_sumVc=AUTHORS[_spi].vc;break;}}}
    var _chapterDesc=_sumVc?"5-8 sentence narrative summary written in this prose voice — "+_sumVc:"5-8 sentence narrative summary";
    // #29 ③: the extractor reads the session anyway — hand it the pending list and let it echo back
    // what the session shows is finished. EXACT text echo, so resolveFutureEvent's exact/substring
    // match lands without fuzzy matching. The GM itself rarely emits [FUTURE_EVENT_RESOLVED:].
    var _pend=[],_pi;for(_pi=0;_pi<memory.futureEvents.length;_pi++){if(!memory.futureEvents[_pi].resolved)_pend.push(memory.futureEvents[_pi].what);}
    // GM turns carry the events — send them near-whole (a 1000-token turn is ~4000 chars; the old
    // 300-char slice fed the extractor only scene openings, silently dropping mid/late-scene events
    // from long-term memory — audit #3). Player turns are short; trim them lightly.
    // #10/B11: TWO windows — _sessRaw (byte-identical to the old composition) drives RECORDED
    // FACTS detection; _sessTxt has engine notes stripped from the USER halves (BEFORE the
    // 500-char slice, so the budget is spent on the player's words, not the replayed imperative
    // that made the extractor answer in state tags at t881).
    var _sessTxt="",_sessRaw="",i;
    for(i=sessKeptStart();i<sessionLog.length;i++){var _se=sessionLog[i];
      if(!_se||_se.bk||_se.content==null)continue;
      _sessRaw+=_se.role+": "+_se.content.slice(0,_se.role==="assistant"?4000:500)+"\n";
      var _ssc=_se.role==="user"?stripEngineNotes(_se.content):_se.content;
      _sessTxt+=_se.role+": "+_ssc.slice(0,_se.role==="assistant"?4000:500)+"\n";
    }
    var _identityTable=typeof summaryIdentityTable==="function"?summaryIdentityTable(_sessRaw):null;
    var extractPrompt=buildExtractPrompt(_chapterDesc,_pend,_sessRaw,_sessTxt,_identityTable);
    var resp=await callGM(extractPrompt,"You are a data extraction system. Output ONLY valid JSON. No prose, no markdown, no backticks.",2000,null,{kind:"summarize",noHistory:true});/* the extraction prompt already contains the session slice — don't also prepend the full sessionLog (audit E47) */
    if(!extractorRespHasJson(resp))throw new Error("extractor returned NO JSON at all (B11 class) — head: \""+String(resp).slice(0,60).replace(/\s+/g," ")+"\"");/* named at the call site; repairModelJson (8 shared callers) stays untouched */
    var extracted=JSON.parse(repairModelJson(resp)); // shared cleanup (api.js) — also fixes trailing-comma/preamble failures that used to burn a retry
    var _exStats=applySummaryExtract(extracted,_identityTable);
    retainSessionTail();summaryFailureClear();saveMem();saveCore();addMsg("system","Memory updated: "+Object.keys(memory.npcs).length+" NPCs, "+memory.lore.length+" lore, "+memory.chapters.length+" chapters."+(_exStats&&_exStats.superseded?" "+_exStats.superseded+" outdated fact"+(_exStats.superseded>1?"s":"")+" superseded ("+_exStats.supersededNames.join(", ")+").":""));
    compileEraIfDue();/* #148 Phase 2 — fire-and-forget: era maintenance must never delay the turn; failures are loud inside and retry on a later cycle */
  }catch(e){
    // Do NOT discard the session log on a transient failure — that permanently erased up to a
    // chapter's worth of events from long-term memory (audit #5). Keep it and retry next turn;
    // only after 3 consecutive failures archive the raw text as a degraded chapter and clear.
    _sumFails=summaryFailureBump(e);saveCore();/* the retry ceiling survives reloads; saveCore reports storage failure loudly */
    if(typeof sceneRefsSummaryFailure==="function")sceneRefsSummaryFailure(_sumFails>=3);
    // #16c (user policy call 2026-07-22: crash detail MAY carry app-generated content).
    // B11 was undiagnosable because the ONLY evidence of what the extractor returned was 11
    // characters inside a V8 message. The head of the response answers "did it reply in state
    // tags, and which one" outright. The counts alongside it test the engine-note replay
    // hypothesis WITHOUT shipping any narrative — how many archived user halves in this window
    // open with an engine note is structure, not story.
    var _dbg="consecutive fails: "+_sumFails;
    try{
      var _noted=0,_users=0,_di;
      for(_di=sessKeptStart();_di<sessionLog.length;_di++){
        if(sessionLog[_di].role!=="user"||sessionLog[_di].bk)continue;
        _users++;
        if(/^\s*\[ENGINE NOTE/.test(sessionLog[_di].content||""))_noted++;
      }
      _dbg+=" | window "+(sessionLog.length-sessKeptStart())+" msgs, "+_noted+"/"+_users+" user halves open with an engine note";
      if(typeof resp==="string")_dbg+="\nRESPONSE HEAD (200): "+resp.slice(0,200).replace(/\s+/g," ");
    }catch(_de){_dbg+=" | (context gather failed: "+((_de&&_de.message)||"?")+")";}
    // v1.439 (F8, brief A probes G/H): extract message/stack DEFENSIVELY — these expressions used
    // to run inline in the reportError call, so a hostile thrown value (throwing getter, poisoned
    // toString) masked the ORIGINAL failure with zero reports sent. String() + try make the
    // reporter unkillable by its own arguments; the same _eMsg serves the retry toast below.
    var _eMsg="unknown",_eStk="";
    try{_eMsg=(e&&e.message!=null)?String(e.message):String(e);}catch(_ee){}
    try{_eStk=(e&&e.stack!=null)?String(e.stack):"";}catch(_ee2){}
    if(typeof reportError==="function")reportError("summarize",_eMsg,_dbg+"\n"+_eStk);/* #16 */
    if(_sumFails>=3&&((e&&(e.w2Identity||e.summaryIdentity))||(worldState.summaryFailure&&worldState.summaryFailure.identityValidation))){
      var _iqBits=[],_iqi;for(_iqi=sessKeptStart();_iqi<sessionLog.length;_iqi++){if(sessionLog[_iqi]&&!sessionLog[_iqi].bk&&sessionLog[_iqi].role==="assistant")_iqBits.push(String(sessionLog[_iqi].content||"").slice(0,200));}
      summaryIdentityQuarantine(e,_iqBits,_sumFails);
      retainSessionTail();summaryFailureClear();saveMem();saveCore();addMsg("system","Memory identity conflict quarantined; no chapter or canon consequence was filed.");
      return;
    }
    if(_sumFails>=3){
      var _rawBits=[],_ri;for(_ri=sessKeptStart();_ri<sessionLog.length;_ri++){if(sessionLog[_ri]&&!sessionLog[_ri].bk&&sessionLog[_ri].role==="assistant")_rawBits.push(String(sessionLog[_ri].content||"").slice(0,200));}/* v1.439 (F8, probes C/E): String() — a non-string content threw OUT of the catch and aborted the archive */
      var _rawSum="(summary failed; raw excerpt) "+_rawBits.join(" … ").slice(0,900);
      fileChapter(worldState.turn,_rawSum);/* audit #10: same routine as applySummaryExtract — the P12 cap/archive discipline cannot fork */
      retainSessionTail();summaryFailureClear();saveMem();saveCore();addMsg("system","Memory saved (raw).");
    }else{
      addMsg("system","Memory filing failed ("+_eMsg+") — retry "+_sumFails+" of 3; the third failure archives this window raw."/* P3: the player sees how close the window is to degrading */);
    }
  }
}
