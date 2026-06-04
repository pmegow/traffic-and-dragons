function resolveNpcName(name){
  if(!memory.npcs)return name;
  if(memory.npcs[name])return name;
  var k;for(k in memory.npcs){if(memory.npcs[k].aliases&&memory.npcs[k].aliases.indexOf(name)>=0)return k;}
  return name;
}
function fileUsedName(name){if(!memory.usedNames)memory.usedNames=[];if(name&&memory.usedNames.indexOf(name)<0){memory.usedNames.push(name);saveMem();}}
function getNameSuggestions(count){
  if(!memory.usedNames)memory.usedNames=[];
  var all=[],cats=Object.keys(NAMES),k,i;
  for(k=0;k<cats.length;k++){for(i=0;i<NAMES[cats[k]].length;i++)all.push(NAMES[cats[k]][i]);}
  var avail=all.filter(function(n){return memory.usedNames.indexOf(n)<0;});
  for(i=avail.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=avail[i];avail[i]=avail[j];avail[j]=tmp;}
  return avail.slice(0,count||10);
}
function fileNpcEvent(name,note,turn){name=resolveNpcName(name);if(!memory.npcs[name])memory.npcs[name]={attitude:"unknown",knowledge:[],events:[],aliases:[]};memory.npcs[name].events.push({turn:turn,note:note});if(memory.npcs[name].events.length>8)memory.npcs[name].events.shift();}
function fileLocation(loc,note,turn){
  // Legacy locations index
  if(!memory.locations[loc])memory.locations[loc]={visited:[],notes:[]};
  memory.locations[loc].visited.push(turn);
  if(note){memory.locations[loc].notes.push(note);if(memory.locations[loc].notes.length>5)memory.locations[loc].notes.shift();}
  // Map node
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.nodes[loc])memory.map.nodes[loc]={firstVisit:turn,visits:0,description:null,parent:null,npcs:[],items:[]};
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
  if(!memory.map.nodes[key])memory.map.nodes[key]={firstVisit:turn,visits:0,description:null,parent:parent,npcs:[],items:[]};
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
function fileFutureEvent(when,who,what,setTurn){memory.futureEvents.push({when:when,who:who||"",what:what,setTurn:setTurn,resolved:false});}
function resolveFutureEvent(what){var i;for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what===what){memory.futureEvents[i].resolved=true;return;}}// Partial match
for(i=0;i<memory.futureEvents.length;i++){if(memory.futureEvents[i].what.indexOf(what)>=0){memory.futureEvents[i].resolved=true;return;}}}
function memoryTOC(){
  var lines=[],i;
  var nk=Object.keys(memory.npcs);if(nk.length)lines.push("KNOWN NPCs: "+nk.join(", "));
  var lk=Object.keys(memory.locations);if(lk.length)lines.push("VISITED: "+lk.join(", "));
  var fe=memory.futureEvents.filter(function(e){return !e.resolved;});
  if(fe.length){var fs=[];for(i=0;i<fe.length;i++)fs.push(fe[i].what+" ("+fe[i].when+")");lines.push("PENDING EVENTS: "+fs.join("; "));}
  if(memory.lore.length)lines.push("LORE: "+memory.lore.join("; "));
  if(memory.keyDecisions.length){var d=memory.keyDecisions.slice(-5),ds=[];for(i=0;i<d.length;i++)ds.push("[T"+d[i].turn+"] "+d[i].desc);lines.push("RECENT DECISIONS: "+ds.join("; "));}
  if(memory.chapters.length){var ch=memory.chapters.slice(-3),cs2=[];for(i=0;i<ch.length;i++)cs2.push(ch[i].summary);lines.push("CHAPTER SUMMARIES:\n"+cs2.join("\n"));}
  if(memory.usedNames&&memory.usedNames.length)lines.push("USED NAMES (never reuse these): "+memory.usedNames.join(", "));
  return lines.join("\n");
}
function memoryNpcDetail(name){var n=memory.npcs[name];if(!n)return"";var akaStr=n.aliases&&n.aliases.length?" (aka: "+n.aliases.join(", ")+")":"";var lines=[name+akaStr+(n.pronouns?" ["+n.pronouns+"]":"")+": "+n.attitude],i;if(n.knowledge.length)lines.push("  Knows: "+n.knowledge.join("; "));if(n.events.length){var ev=[];for(i=0;i<n.events.length;i++)ev.push("[T"+n.events[i].turn+"] "+n.events[i].note);lines.push("  History: "+ev.join("; "));}return lines.join("\n");}
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
  return lines.join("\n")+"\n\n";
}
function sessionTokens(){var total=0,i;for(i=0;i<sessionLog.length;i++)total+=sessionLog[i].content.length;return Math.ceil(total/4);}
async function summarize(){
  if(sessionTokens()<1000)return;
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
  }catch(e){worldState.eventHistory.push("[T"+worldState.turn+"] Session continued.");sessionLog=[];addMsg("system","Memory saved (raw).");}
}
