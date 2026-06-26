function resolveNpcName(name){
  if(!memory.npcs)return name;
  if(memory.npcs[name])return name;
  var k;for(k in memory.npcs){if(memory.npcs[k].aliases&&memory.npcs[k].aliases.indexOf(name)>=0)return k;}
  // #4: conservative first-name consolidation. If `name` is a single word that is the first name of
  // EXACTLY ONE existing NPC, treat it as that NPC — the GM often drops "Aldara Perdrath" to "Aldara",
  // which otherwise spawns a duplicate. The single-candidate guard prevents merging two distinct people
  // who happen to share a first name (then it stays ambiguous and a separate entry is created).
  if(name.indexOf(" ")<0){
    var match=null,cnt=0;
    for(k in memory.npcs){ if(k.split(" ")[0]===name && k!==name){ match=k; cnt++; if(cnt>1)break; } }
    if(cnt===1)return match;
  }
  return name;
}

function getNameSuggestions(count){
  var firstNames=[],cats=Object.keys(NAMES),k,i;
  for(k=0;k<cats.length;k++){if(cats[k]==="surnames")continue;for(i=0;i<NAMES[cats[k]].length;i++)firstNames.push(NAMES[cats[k]][i]);}
  var surnames=NAMES.surnames||[];
  if(!firstNames.length)return[];
  if(typeof memory.nameIdx!=="number")memory.nameIdx=0;
  var result=[],n=count||10;
  for(i=0;i<n;i++){
    var first=firstNames[memory.nameIdx%firstNames.length];
    var last=surnames.length?surnames[(memory.nameIdx*7+3)%surnames.length]:"";
    result.push(last?first+" "+last:first);
    memory.nameIdx++;
  }
  return result;
}
function fileNpcEvent(name,note,turn){name=resolveNpcName(name);if(!memory.npcs[name])memory.npcs[name]={attitude:"unknown",knowledge:[],events:[],aliases:[]};memory.npcs[name].events.push({turn:turn,note:note});if(memory.npcs[name].events.length>8)memory.npcs[name].events.shift();}
function fileLocation(loc,note,turn){
  // Legacy locations index
  if(!memory.locations[loc])memory.locations[loc]={visited:[],notes:[]};
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
async function summarize(){
  if(sessionTokens()<1200)return;
  addMsg("system","Filing memories...");
  try{
    var extractPrompt="Extract structured data from this RPG session. Output ONLY valid JSON, no markdown:\n{\"chapterSummary\":\"5-8 sentence narrative summary\",\"npcUpdates\":[{\"name\":\"\",\"attitude\":\"\",\"knowledgeGained\":\"\"}],\"loreDiscovered\":[\"string\"],\"decisionsMade\":[\"string\"],\"futureEvents\":[{\"what\":\"\",\"when\":\"\"}]}\n\nSESSION:\n";
    var i;for(i=0;i<sessionLog.length;i++)extractPrompt+=sessionLog[i].role+": "+sessionLog[i].content.slice(0,300)+"\n";
    var resp=await callGM(extractPrompt,"You are a data extraction system. Output ONLY valid JSON. No prose, no markdown, no backticks.",2000);
    var cleaned=resp.replace(/```json/g,"").replace(/```/g,"").trim();
    var extracted=JSON.parse(cleaned);
    if(extracted.chapterSummary){memory.chapters.push({turn:worldState.turn,summary:extracted.chapterSummary});if(memory.chapters.length>10)memory.chapters.shift();worldState.eventHistory.push("[T"+worldState.turn+"] "+extracted.chapterSummary);if(worldState.eventHistory.length>8)worldState.eventHistory.shift();}
    if(extracted.npcUpdates){for(i=0;i<extracted.npcUpdates.length;i++){var nu=extracted.npcUpdates[i];if(nu.name){if(!memory.npcs[nu.name])memory.npcs[nu.name]={attitude:"unknown",knowledge:[],events:[]};if(nu.attitude)memory.npcs[nu.name].attitude=nu.attitude;if(nu.knowledgeGained)memory.npcs[nu.name].knowledge.push(nu.knowledgeGained);}}}
    if(extracted.loreDiscovered){for(i=0;i<extracted.loreDiscovered.length;i++)fileLore(extracted.loreDiscovered[i]);}
    if(extracted.decisionsMade){for(i=0;i<extracted.decisionsMade.length;i++)fileDecision(worldState.turn,extracted.decisionsMade[i]);}
    if(extracted.futureEvents){for(i=0;i<extracted.futureEvents.length;i++){var fe=extracted.futureEvents[i];if(fe.what)fileFutureEvent(fe.when||"soon","",fe.what,worldState.turn);}}
    sessionLog=[];saveMem();addMsg("system","Memory updated: "+Object.keys(memory.npcs).length+" NPCs, "+memory.lore.length+" lore, "+memory.chapters.length+" chapters.");
  }catch(e){worldState.eventHistory.push("[T"+worldState.turn+"] Summarisation failed — "+sessionLog.length+" turns not archived.");sessionLog=[];saveCore();addMsg("system","Memory saved (raw).");}
}
