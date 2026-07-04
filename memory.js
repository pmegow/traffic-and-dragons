// Distinctive-name tokens: lowercase, drop parentheticals, then drop honorifics/titles and generic
// role nouns so only the words that actually identify a person remain. "Sheriff Belor Hemlock" ->
// [belor,hemlock]; "The Scarred Man" -> [scarred]; "Barkeep (Rusty Dragon)" -> [] (role-only, no
// distinctive name — deliberately unmergeable so anonymous functionaries never absorb a real NPC).
var _NPC_STOP={sheriff:1,father:1,mother:1,lord:1,lady:1,ser:1,sir:1,captain:1,master:1,mistress:1,
  brother:1,sister:1,saint:1,st:1,king:1,queen:1,prince:1,princess:1,dame:1,elder:1,dr:1,doctor:1,
  professor:1,the:1,old:1,young:1,a:1,an:1,man:1,woman:1,girl:1,boy:1,child:1,lad:1,lass:1,
  stranger:1,guard:1,barkeep:1,keeper:1,innkeeper:1,merchant:1,wife:1,husband:1,soldier:1,priest:1,
  priestess:1,mage:1,wizard:1,knight:1,thief:1,beggar:1,drunk:1,unnamed:1};
function npcCoreTokens(name){
  var s=String(name||"").toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9\s]/g," ");
  var raw=s.split(/\s+/),out=[],i;
  for(i=0;i<raw.length;i++){if(raw[i]&&!_NPC_STOP[raw[i]])out.push(raw[i]);}
  return out;
}
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
function fileNpcEvent(name,note,turn){name=resolveNpcName(name);if(!memory.npcs[name])memory.npcs[name]={attitude:"unknown",knowledge:[],events:[],aliases:[]};memory.npcs[name].events.push({turn:turn,note:note});if(memory.npcs[name].events.length>8)memory.npcs[name].events.shift();}
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
  memory.map.nodes[key].visits++;
}
function fileLocationDesc(desc){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;
  if(!memory.map.nodes[key])return;
  if(!memory.map.nodes[key].description)memory.map.nodes[key].description=desc;
}
function fileLocationItem(name,action,turn){
  if(!memory.map||!worldState||!worldState.world)return;
  var key=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;
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
  var key=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;
  var node=memory.map.nodes[key];if(!node)return;
  var i;for(i=0;i<node.items.length;i++){if(node.items[i].name.toLowerCase()===itemName.toLowerCase()&&!node.items[i].taken){node.items[i].taken=true;return;}}
}
function mapNpcLocation(name){
  if(!memory.map||!worldState||!worldState.world)return;
  name=resolveNpcName(name);
  var key=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;
  if(!memory.map.nodes[key])return;
  var npcs=memory.map.nodes[key].npcs;if(npcs.indexOf(name)<0)npcs.push(name);
  if(memory.npcs[name])memory.npcs[name].lastSeenAt=key;
}
function fileLore(fact){if(memory.lore.indexOf(fact)<0)memory.lore.push(fact);if(memory.lore.length>30)memory.lore.shift();}
function fileDecision(turn,desc){memory.keyDecisions.push({turn:turn,desc:desc});if(memory.keyDecisions.length>30)memory.keyDecisions.shift();}
// Future events were unbounded — pushed every summarize() cycle, never removed (resolve only flagged),
// and memoryTOC injected ALL unresolved ones into every prompt (a save reached 469). Now: dedupe by
// `what`, drop resolved on resolve, and cap to the most-recent 30 (same discipline as lore/decisions).
function fileFutureEvent(when,who,what,setTurn){
  if(!what)return;
  var i;for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what===what)return;}// dedupe
  memory.futureEvents.push({when:when,who:who||"",what:what,setTurn:setTurn,resolved:false});
  if(memory.futureEvents.length>30)memory.futureEvents=memory.futureEvents.slice(-30);
}
function resolveFutureEvent(what){var i;
  for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what===what){memory.futureEvents.splice(i,1);return;}}// exact, remove
  for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what.indexOf(what)>=0){memory.futureEvents.splice(i,1);return;}}}// partial, remove
// ── RAG episodic memory (#27 Phase 1 — see RAG_MEMORY.md) ──────────────────────
// Entity-keyed retrieval over the verbatim transcript — no vectors, no extra API calls.
// READ-SIDE ONLY: nothing here changes what gets written to memory/chapters/summaries.
// The per-campaign flag worldState.ragMemory gates retrieval AND the memoryTOC diet
// together; flag off must reproduce today's prompt byte-for-byte (engine-tested).
// Retrieved excerpts are episodic TEXTURE, never current truth — the block framing
// subordinates them to the state blocks above it (the stale-chunk drift guard).
function ragEnabled(){return !!(typeof worldState!=="undefined"&&worldState&&worldState.ragMemory);}
var RAG_BUDGET=2400;   // ~600 tokens of excerpt payload per turn, hard cap
var RAG_RECENT=10;     // skip entries this close to the current turn (already in sessionLog)
var RAG_MAX=3;         // excerpts per turn
// Known-NPC scan list (lowercased, with aliases). Names under 3 chars are unscannable
// (substring false positives) unless an alias qualifies.
function ragKnownNames(){
  var out=[],i,j;
  if(typeof memory==="undefined"||!memory||!memory.npcs)return out;
  var ks=Object.keys(memory.npcs);
  for(i=0;i<ks.length;i++){
    var low=ks[i].toLowerCase(),als=[],src=memory.npcs[ks[i]].aliases||[];
    for(j=0;j<src.length;j++){if(src[j]&&String(src[j]).length>=3)als.push(String(src[j]).toLowerCase());}
    if(low.length>=3||als.length)out.push({nm:ks[i],low:low,als:als});
  }
  return out;
}
function ragScanNames(lowText,names,addFn){
  var i,j;
  for(i=0;i<names.length;i++){
    var hit=names[i].low.length>=3&&lowText.indexOf(names[i].low)>=0;
    for(j=0;!hit&&j<names[i].als.length;j++){if(lowText.indexOf(names[i].als[j])>=0)hit=true;}
    if(hit)addFn(names[i].nm);
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
  var q={input:{},scene:{},party:{},loc:null,quests:[]},i;
  if(typeof worldState==="undefined"||!worldState)return q;
  q.loc=worldState.world?worldState.world.location:null;
  var key=worldState.world?(worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location):null;
  for(i=0;i<(worldState.npcs||[]).length;i++){if(worldState.npcs[i].partyMember){q.scene[worldState.npcs[i].name]=1;q.party[worldState.npcs[i].name]=1;}}
  var names=ragKnownNames();
  for(i=0;i<names.length;i++){
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
// The retrieval pass — returns the PAST SCENE EXCERPTS block for buildSysPrompt's volatile
// half, or "" (flag off / young campaign / no hits). Scores indexed GM entries by entity
// overlap with the current scene, skips the last RAG_RECENT turns (already in sessionLog),
// picks the top RAG_MAX at least 3 turns apart (adjacent turns are one scene), renders
// oldest-first within RAG_BUDGET. Only mutation is filling missing .e index fields (lazy
// backfill — idempotent, so repeated buildSysPrompt calls are safe; no cursor advances
// here, same discipline as getNameSuggestions peek mode).
function ragRetrieve(inputText){
  if(!ragEnabled())return "";
  var tr=worldState.transcript;
  if(!tr||tr.length<6)return "";
  var q=ragQueryEntities(inputText||"");
  var terms=ragQueryTerms(inputText||"");
  var w={},k;
  for(k in q.input)w[k]=3;
  for(k in q.scene){if(!w[k])w[k]=q.party[k]?1:2;} // party members are everywhere — near-zero signal
  var qws={},qi;for(qi=0;qi<q.quests.length;qi++)qws[q.quests[qi].toLowerCase()]=1;
  var cands=[],names=null,i,j;
  for(i=0;i<tr.length;i++){
    var en=tr[i];
    if(en.r!=="gm")continue;
    if(en.t>worldState.turn-RAG_RECENT)continue;
    if(!en.e){if(!names)names=ragKnownNames();en.e=ragBackfillEntry(en,names);}
    var sc=0;
    for(j=0;j<en.e.n.length;j++){if(w[en.e.n[j]])sc+=w[en.e.n[j]];}
    if(q.loc&&en.e.l===q.loc)sc+=2;
    for(j=0;j<(en.e.q||[]).length;j++){if(qws[en.e.q[j].toLowerCase()])sc+=1;}
    // Lexical boost — topical words from the input found in the entry (or its player line)
    // dominate flat entity scores; +2 per distinct term, capped +6. This is what routes a
    // "where did I get the pin?" quiz to the scene that actually contains the pin.
    if(terms.length&&sc>0){
      var low=String(en.x).toLowerCase();
      var prev=i>0&&tr[i-1].r==="player"?String(tr[i-1].x).toLowerCase():"";
      var hits=0;
      for(j=0;j<terms.length&&hits<3;j++){if(low.indexOf(terms[j])>=0||(prev&&prev.indexOf(terms[j])>=0))hits++;}
      sc+=hits*2;
    }
    if(sc>0)cands.push({i:i,t:en.t,sc:sc});
  }
  if(!cands.length)return "";
  cands.sort(function(a,b){return b.sc-a.sc||b.t-a.t;});
  var picked=[],pi,pj;
  for(pi=0;pi<cands.length&&picked.length<RAG_MAX;pi++){
    var apart=true;
    for(pj=0;pj<picked.length;pj++){if(Math.abs(picked[pj].t-cands[pi].t)<3){apart=false;break;}}
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
  var nk=Object.keys(memory.npcs);if(nk.length)lines.push("KNOWN NPCs: "+nk.join(", "));
  var lk=Object.keys(memory.locations);if(lk.length)lines.push("VISITED: "+lk.join(", "));
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
function memoryNpcDetail(name){var n=memory.npcs[name];if(!n)return"";var akaStr=n.aliases&&n.aliases.length?" (aka: "+n.aliases.join(", ")+")":"";var lines=[name+akaStr+(n.pronouns?" ["+n.pronouns+"]":"")+": "+n.attitude],i;if(n.knowledge.length)lines.push("  Knows: "+n.knowledge.join("; "));if(n.events.length){var ev=[];for(i=0;i<n.events.length;i++)ev.push("[T"+n.events[i].turn+"] "+n.events[i].note);lines.push("  History: "+ev.join("; "));}if(n.firstEncounter)lines.push("  First met: "+n.firstEncounter);return lines.join("\n");}
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
    var wsNpc=null;for(var wi=0;wi<worldState.npcs.length;wi++){if(worldState.npcs[wi].name===name){wsNpc=worldState.npcs[wi];break;}}
    var meta=[];
    if(npc.attitude)meta.push(npc.attitude);
    if(wsNpc&&wsNpc.partyMember)meta.push("PARTY");
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
function sessionTokens(){var total=0,i;for(i=0;i<sessionLog.length;i++)total+=sessionLog[i].content.length;return Math.ceil(total/4);}
var _sumFails=0; // consecutive summarize() failures; the log is only discarded after 3 (audit #5)
async function summarize(){
  if(sessionTokens()<SUMMARIZE_AT)return;
  addMsg("system","Filing memories...");
  try{
    var _sumVc="";var _sumPaId=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:"";if(_sumPaId&&typeof AUTHORS!=="undefined"){var _spi;for(_spi=0;_spi<AUTHORS.length;_spi++){if(AUTHORS[_spi].id===_sumPaId&&AUTHORS[_spi].vc){_sumVc=AUTHORS[_spi].vc;break;}}}
    var _chapterDesc=_sumVc?"5-8 sentence narrative summary written in this prose voice — "+_sumVc:"5-8 sentence narrative summary";
    var extractPrompt="Extract structured data from this RPG session. Output ONLY valid JSON, no markdown:\n{\"chapterSummary\":\""+_chapterDesc+"\",\"npcUpdates\":[{\"name\":\"\",\"attitude\":\"\",\"knowledgeGained\":\"\"}],\"loreDiscovered\":[\"string\"],\"decisionsMade\":[\"string\"],\"futureEvents\":[{\"what\":\"\",\"when\":\"\"}]}\n\nSESSION:\n";
    // GM turns carry the events — send them near-whole (a 1000-token turn is ~4000 chars; the old
    // 300-char slice fed the extractor only scene openings, silently dropping mid/late-scene events
    // from long-term memory — audit #3). Player turns are short; trim them lightly.
    var i;for(i=0;i<sessionLog.length;i++){var _se=sessionLog[i];extractPrompt+=_se.role+": "+_se.content.slice(0,_se.role==="assistant"?4000:500)+"\n";}
    var resp=await callGM(extractPrompt,"You are a data extraction system. Output ONLY valid JSON. No prose, no markdown, no backticks.",2000,null,{kind:"summarize"});
    var extracted=JSON.parse(repairModelJson(resp)); // shared cleanup (api.js) — also fixes trailing-comma/preamble failures that used to burn a retry
    if(extracted.chapterSummary){memory.chapters.push({turn:worldState.turn,summary:extracted.chapterSummary});if(memory.chapters.length>10)memory.chapters.shift();worldState.eventHistory.push("[T"+worldState.turn+"] "+extracted.chapterSummary);if(worldState.eventHistory.length>8)worldState.eventHistory.shift();}
    // Route extractor names through resolveNpcName — the extractor freely returns variants
    // ("Morwen (Ammut's wife)"), which forked NPCs exactly the way the v1.143 tag fix prevents (audit #6).
    if(extracted.npcUpdates){for(i=0;i<extracted.npcUpdates.length;i++){var nu=extracted.npcUpdates[i];if(nu.name){var nuName=resolveNpcName(nu.name);if(!memory.npcs[nuName])memory.npcs[nuName]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(nu.attitude)memory.npcs[nuName].attitude=nu.attitude;if(nu.knowledgeGained)memory.npcs[nuName].knowledge.push(nu.knowledgeGained);}}}
    if(extracted.loreDiscovered){for(i=0;i<extracted.loreDiscovered.length;i++)fileLore(extracted.loreDiscovered[i]);}
    if(extracted.decisionsMade){for(i=0;i<extracted.decisionsMade.length;i++)fileDecision(worldState.turn,extracted.decisionsMade[i]);}
    if(extracted.futureEvents){for(i=0;i<extracted.futureEvents.length;i++){var fe=extracted.futureEvents[i];if(fe.what)fileFutureEvent(fe.when||"soon","",fe.what,worldState.turn);}}
    sessionLog=[];_sumFails=0;saveMem();addMsg("system","Memory updated: "+Object.keys(memory.npcs).length+" NPCs, "+memory.lore.length+" lore, "+memory.chapters.length+" chapters.");
  }catch(e){
    // Do NOT discard the session log on a transient failure — that permanently erased up to a
    // chapter's worth of events from long-term memory (audit #5). Keep it and retry next turn;
    // only after 3 consecutive failures archive the raw text as a degraded chapter and clear.
    _sumFails++;
    if(_sumFails>=3){
      var _rawBits=[],_ri;for(_ri=0;_ri<sessionLog.length;_ri++){if(sessionLog[_ri].role==="assistant")_rawBits.push(sessionLog[_ri].content.slice(0,200));}
      var _rawSum="(summary failed; raw excerpt) "+_rawBits.join(" … ").slice(0,900);
      memory.chapters.push({turn:worldState.turn,summary:_rawSum});if(memory.chapters.length>10)memory.chapters.shift();
      worldState.eventHistory.push("[T"+worldState.turn+"] "+_rawSum);if(worldState.eventHistory.length>8)worldState.eventHistory.shift();
      sessionLog=[];_sumFails=0;saveMem();saveCore();addMsg("system","Memory saved (raw).");
    }else{
      addMsg("system","Memory filing failed ("+(e&&e.message?e.message:"unknown")+") — will retry next turn.");
    }
  }
}
