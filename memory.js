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
function memoryTOC(){
  var lines=[],i;
  var nk=Object.keys(memory.npcs);if(nk.length)lines.push("KNOWN NPCs: "+nk.join(", "));
  var lk=Object.keys(memory.locations);if(lk.length)lines.push("VISITED: "+lk.join(", "));
  var fe=memory.futureEvents.filter(function(e){return !e.resolved;}).slice(-8);
  if(fe.length){var fs=[];for(i=0;i<fe.length;i++)fs.push(fe[i].what+" ("+fe[i].when+")");lines.push("PENDING EVENTS: "+fs.join("; "));}
  if(memory.lore.length)lines.push("LORE: "+memory.lore.join("; "));
  if(memory.keyDecisions.length){var d=memory.keyDecisions.slice(-5),ds=[];for(i=0;i<d.length;i++)ds.push("[T"+d[i].turn+"] "+d[i].desc);lines.push("RECENT DECISIONS: "+ds.join("; "));}
  if(memory.chapters.length){var ch=memory.chapters.slice(-3),cs2=[];for(i=0;i<ch.length;i++)cs2.push(ch[i].summary);lines.push("CHAPTER SUMMARIES:\n"+cs2.join("\n"));}
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
