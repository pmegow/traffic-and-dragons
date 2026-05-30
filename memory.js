function fileUsedName(name){if(!memory.usedNames)memory.usedNames=[];if(name&&memory.usedNames.indexOf(name)<0){memory.usedNames.push(name);saveMem();}}
function getNameSuggestions(count){
  if(!memory.usedNames)memory.usedNames=[];
  var all=[],cats=Object.keys(NAMES),k,i;
  for(k=0;k<cats.length;k++){for(i=0;i<NAMES[cats[k]].length;i++)all.push(NAMES[cats[k]][i]);}
  var avail=all.filter(function(n){return memory.usedNames.indexOf(n)<0;});
  for(i=avail.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=avail[i];avail[i]=avail[j];avail[j]=tmp;}
  return avail.slice(0,count||10);
}
function fileNpcEvent(name,note,turn){if(!memory.npcs[name])memory.npcs[name]={attitude:"unknown",knowledge:[],events:[]};memory.npcs[name].events.push({turn:turn,note:note});if(memory.npcs[name].events.length>8)memory.npcs[name].events.shift();}
function fileLocation(loc,note,turn){if(!memory.locations[loc])memory.locations[loc]={visited:[],notes:[]};memory.locations[loc].visited.push(turn);if(note){memory.locations[loc].notes.push(note);if(memory.locations[loc].notes.length>5)memory.locations[loc].notes.shift();}}
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
function memoryNpcDetail(name){var n=memory.npcs[name];if(!n)return"";var lines=[name+(n.pronouns?" ("+n.pronouns+")":"")+": "+n.attitude],i;if(n.knowledge.length)lines.push("  Knows: "+n.knowledge.join("; "));if(n.events.length){var ev=[];for(i=0;i<n.events.length;i++)ev.push("[T"+n.events[i].turn+"] "+n.events[i].note);lines.push("  History: "+ev.join("; "));}return lines.join("\n");}
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
