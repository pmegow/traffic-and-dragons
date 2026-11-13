/* atlas-knowledge.js — narrated geography admission. MAP_REVEAL is public narrative content:
   a committed, validated declaration publishes its readable receipt in the GM turn. Parsing,
   cleanTxt, Table Talk, sheet sync, and prose rerolls cannot disclose a new feature. */
function atlasKnowledgeActive(){return !!(typeof worldState!=="undefined"&&worldState&&worldState.atlas&&worldState.atlas.knowledge===1);}
function atlasKnowledgeContext(){
  var k=(typeof currentNodeKey==="function")?currentNodeKey():null,w=(typeof worldState!=="undefined"&&worldState)?worldState.world:null;
  if(!k&&w)k=w.location+(w.sublocation?"|"+w.sublocation:"");
  return k&&typeof locResolve==="function"?locResolve(k):k;
}
var ATLAS_KNOWLEDGE_DIRECTIONS={N:"north",NE:"northeast",E:"east",SE:"southeast",S:"south",SW:"southwest",W:"west",NW:"northwest"};
function atlasKnowledgeReceipt(e){
  var label=String(e.label||""),direction=Object.prototype.hasOwnProperty.call(ATLAS_KNOWLEDGE_DIRECTIONS,e.bearing)?ATLAS_KNOWLEDGE_DIRECTIONS[e.bearing]:null;
  return (e.mode==="reported"?"You hear of ":"You see ")+label+(direction?" to the "+direction+".":"; its precise position is not established.");
}
/* Five-field directives are retained for old model context; their type is private provenance. */
function atlasKnowledgeFields(fields){
  if(fields.length!==4&&fields.length!==5)return null;
  var old=fields.length===5,e={op:"disclose",id:fields[0],label:fields[1],proposalKind:old?fields[2]:"",bearing:fields[old?3:2],mode:fields[old?4:3],quote:""};
  e.quote=atlasKnowledgeReceipt(e);return e;
}
/* The parser's location timeline supplies scope at the directive, before later arrivals overwrite
   the live pointer. Only plain fields are accepted; the core owns the closed enum/schema checks. */
function atlasKnowledgeRead(raw,R){
  var text=String(raw||""),re=/\[MAP_REVEAL:([^\[\]\r\n]*)\]/g,m,fields,e,st,k,out={raw:text,items:[],reason:""},count=(text.match(/\[MAP_REVEAL(?::|\])/g)||[]).length;
  while((m=re.exec(text))){
    var depth=0,cursor=0;
    for(cursor=0;cursor<m.index;cursor++){if(text.charAt(cursor)==="[")depth++;else if(text.charAt(cursor)==="]")depth=Math.max(0,depth-1);}
    if(depth){out.reason="a nested MAP_REVEAL is not a public narrative directive";break;}
    if(out.items.length>=16){out.reason="at most 16 public map disclosures are accepted per turn";break;}
    fields=m[1].split("|");
    if(fields.length!==4&&fields.length!==5){out.reason="MAP_REVEAL needs handle, public label, bearing, and observed/reported";break;}
    fields=fields.map(function(x){return x.trim();});
    e=atlasKnowledgeFields(fields);
    out.reason=MapKnowledge.eventProblem(e);if(out.reason)break;
    st=R&&typeof R.placeAt==="function"?R.placeAt(m.index):null;k=st&&st.key?st.key:atlasKnowledgeContext();
    if(k&&typeof locResolve==="function")k=locResolve(k);
    var publicFeatures=memory&&memory.map&&memory.map.geography&&memory.map.geography.features,existing,featureKeys,fi,match=null;
    if(publicFeatures&&e.id!=="new"&&Object.prototype.hasOwnProperty.call(publicFeatures,e.id)){
      existing=publicFeatures[e.id];
      if(existing&&typeof existing.container==="string"&&((typeof locResolve==="function")?locResolve(existing.container):existing.container)===k)k=existing.container;
    }else if(publicFeatures&&e.id==="new"){
      featureKeys=Object.keys(publicFeatures);
      for(fi=0;fi<featureKeys.length;fi++){
        existing=publicFeatures[featureKeys[fi]];
        if(!existing||typeof existing.container!=="string"||typeof existing.label!=="string"||((typeof locResolve==="function")?locResolve(existing.container):existing.container)!==k||existing.label.replace(/\s+/g," ").toLowerCase()!==e.label.replace(/\s+/g," ").toLowerCase())continue;
        if(match){out.reason="the public label is ambiguous in this resolved place";break;}match=existing;
      }
      if(out.reason)break;
      if(match)k=match.container;
    }
    if(!k){out.reason="the public discovery has no established containing place";break;}
    out.items.push({container:k,event:e,start:m.index,end:re.lastIndex,directive:m[0]});
  }
  if(!out.reason&&count!==out.items.length)out.reason="a MAP_REVEAL directive is truncated or malformed";
  return out;
}
/* Alias repair can fold distinct filing keys into one public place. Refuse ambiguous labels
   in touched scopes before any candidate or public receipt becomes part of the turn. */
function atlasKnowledgeCollision(s,groups){
  var scopes=Object.create(null),labels=Object.create(null),keys=Object.keys(s.features),i,f,k,label,resolve=function(x){return typeof locResolve==="function"?locResolve(x):x;};
  for(i=0;i<groups.length;i++)scopes[resolve(groups[i].container)]=1;
  for(i=0;i<keys.length;i++){
    f=s.features[keys[i]];k=resolve(f.container);if(!Object.prototype.hasOwnProperty.call(scopes,k))continue;
    label=JSON.stringify([k,f.label.replace(/\s+/g," ").toLowerCase()]);
    if(Object.prototype.hasOwnProperty.call(labels,label))return "public label already identifies "+labels[label]+" in this resolved place; use its handle or a distinct label";
    labels[label]=f.id;
  }
  return "";
}
/* Each readable receipt occupies the directive's original place in the narration. A copied
   quotation elsewhere cannot suppress it or move its meaning past a subsequent arrival. */
function atlasKnowledgePublish(raw,items){
  var text=String(raw||""),out="",cursor=0,i,item,m,fields,e;
  for(i=0;i<items.length;i++){
    item=items[i];e=item.event;
    if(typeof item.start!=="number"||Math.floor(item.start)!==item.start||item.start<cursor||typeof item.end!=="number"||Math.floor(item.end)!==item.end||item.end<=item.start||item.end>text.length||text.slice(item.start,item.end)!==item.directive)throw new Error("the queued map directive no longer matches its narrated source");
    m=/^\[MAP_REVEAL:([^\[\]\r\n]*)\]$/.exec(item.directive);fields=m?m[1].split("|").map(function(x){return x.trim();}):[];
    if(JSON.stringify(typeof atlasKnowledgeDirectiveEvent==="function"?atlasKnowledgeDirectiveEvent(item.directive):atlasKnowledgeFields(fields))!==JSON.stringify(e))throw new Error("the queued map disclosure differs from its public directive");
    out+=text.slice(cursor,item.end)+"\n\n"+e.quote+"\n\n";cursor=item.end;
  }
  return out+text.slice(cursor);
}
function atlasKnowledgeSay(reason){
  if(typeof console!=="undefined")console.warn("[map knowledge] "+reason);
  if(typeof showToast==="function")showToast("Map: "+reason,6000);
}
/* A detached candidate is installed only when every scoped group passes. The resulting receipt
   text is stored in the same narrated turn; cleanTxt later strips the original directive normally. */
function atlasKnowledgeCommit(raw,parsed,opts){
  if(!atlasKnowledgeActive())return raw;
  try{
    var q=parsed||atlasKnowledgeRead(raw),s=memory&&memory.map&&memory.map.geography,problem=MapKnowledge.problem(s),groups=[],lookup=Object.create(null),i,j,item,group,r,token,visible,out,items;
    if(q.reason){atlasKnowledgeSay(q.reason+"; no new map discoveries were filed");return raw;}
    if(!q.items.length)return raw;
    if(q.raw!==String(raw||"")){atlasKnowledgeSay("the queued map disclosure source changed; no new map discoveries were filed");return raw;}
    if(problem){atlasKnowledgeSay(problem+"; existing map data was preserved");return raw;}
    token=(opts&&opts.commit)||("gm:"+worldState.turn+":"+Date.now().toString(36)+":"+Math.random().toString(36).slice(2));
    atlasKnowledgePublish(raw,q.items);/* Validate every queued source before any coalescing can hide a changed declaration. */
    items=typeof atlasKnowledgeExitSelect==="function"?atlasKnowledgeExitSelect(q.items,s,token):q.items;
    if(!items.length)return raw;
    for(i=0;i<items.length;i++){
      item=items[i];
      if(!Object.prototype.hasOwnProperty.call(lookup,item.container)){lookup[item.container]=groups.length;groups.push({container:item.container,events:[]});}
      group=groups[lookup[item.container]];group.events.push(item.event);
    }
    out=atlasKnowledgePublish(raw,items);visible=cleanTxt(out);
    for(j=0;j<groups.length;j++){
      group=groups[j];r=MapKnowledge.prepare(s,group.events,{channel:"gm",commit:token+":"+j,turn:worldState.turn,container:group.container,text:visible});
      if(!r.ok){atlasKnowledgeSay(r.reason+"; no new map discoveries were filed");return raw;}s=r.state;
    }
    problem=atlasKnowledgeCollision(s,groups);if(problem){atlasKnowledgeSay(problem+"; no new map discoveries were filed");return raw;}
    memory.map.geography=s;
    return out;
  }catch(e){atlasKnowledgeSay("the discovery could not be recorded: "+((e&&e.message)||e));return raw;}
}
function atlasKnowledgeTurnReceipts(){
  var s=memory&&memory.map&&memory.map.geography,out=[],keys,i,j,r;
  var problem=MapKnowledge.problem(s);if(problem){atlasKnowledgeSay(problem+"; committed map receipts could not be read");return out;}
  keys=Object.keys(s.receipts).sort();
  for(i=0;i<keys.length;i++){r=s.receipts[keys[i]];if(r.turn!==worldState.turn)continue;for(j=0;j<r.events.length;j++){var scope=typeof locResolve==="function"?locResolve(r.container):r.container,line="At "+scope.replace(/\|/g," — ")+": "+atlasKnowledgeReceipt(r.events[j]);if(out.indexOf(line)<0)out.push(line);}}
  return out;
}
function atlasKnowledgeRerollNote(){
  if(!atlasKnowledgeActive())return "";
  var lines=atlasKnowledgeTurnReceipts();
  return "\n\nPROSE REROLL: keep all committed geography unchanged. Do not add MAP_REVEAL or EXIT directives or introduce new locations, landmarks, names, directions, or rooms. Preserve these public discoveries: "+(lines.length?lines.join(" "):"none were committed in this turn.");
}
function atlasKnowledgeReroll(raw,previous){
  if(!atlasKnowledgeActive())return raw;
  if(typeof detectModelRefusal==="function"&&detectModelRefusal(cleanTxt(raw))){
    atlasKnowledgeSay("the prose reroll was refused; the original narrated discoveries are retained");
    if(typeof previous!=="string")throw new Error("the refused reroll has no prior narration to preserve");
    return previous;
  }
  var text=String(raw||""),lines=atlasKnowledgeTurnReceipts(),i;
  if(/\[(?:MAP_REVEAL|EXIT)(?::|\])/.test(text))atlasKnowledgeSay("a prose reroll cannot add map discoveries; the committed discoveries are retained");
  text=text.replace(/\[(?:MAP_REVEAL|EXIT)(?::[^\]]*)?\]/g,"").replace(/\[(?:MAP_REVEAL|EXIT)[^\]]*$/,"");
  if(lines.length)text+=(text?"\n\n":"")+"Retained discoveries from this turn:\n"+lines.join("\n");
  return text;
}
/* Filing keys remain immutable across place repairs. Resolve container identity at the read
   boundary, so a merge/reparent cannot orphan the disclosures or duplicate persistent records. */
function atlasKnowledgeProjection(container){
  var k=container||atlasKnowledgeContext(),resolve=function(x){return typeof locResolve==="function"?locResolve(x):x;};
  return MapKnowledge.project(memory&&memory.map&&memory.map.geography,resolve(k),"player",resolve);
}

function atlasKnowledgePlayerBlock(){
  if(!atlasKnowledgeActive())return "";
  var k=atlasKnowledgeContext(),out="PLAYER-KNOWN GEOGRAPHY\nCurrent place: "+(k||"not established")+".\n",p,i,f;
  try{
    p=atlasKnowledgeProjection(k);
    for(i=0;i<p.features.length&&i<40;i++){f=p.features[i];out+=f.id+": "+f.label+" ("+f.mode+", "+(f.bearing==="unknown"?"position unknown":f.bearing)+").\n";}
    if(p.features.length>40)out+="Additional known features are omitted from this brief.\n";
    if(!p.features.length)out+="No landmarks have been disclosed here.\n";
  }catch(e){out+="The map knowledge could not be read; no private geography is substituted.\n";if(typeof console!=="undefined")console.warn("[map knowledge] public brief refused: "+((e&&e.message)||e));}
  return out+"Positions are schematic unless explicitly established; do not infer metres, routes, interiors, ownership, or exploration.\n\n";
}
function atlasKnowledgePrompt(){
  if(!atlasKnowledgeActive())return "";
  return atlasKnowledgePlayerBlock()+
    "PUBLIC MAP DISCLOSURES: world facts and accepted changes constrain the map; a generated layout never overrules the story.\n"+
    "On EVERY narrated turn, disclose newly introduced FIXED geographic features that help the player navigate or act: distinctive trees or stones, buildings, paths, exits, and destinations. Include features described in NPC dialogue, directions, EXIT descriptions, and SUGGEST targets, even while the party stands still. Exclude NPCs, creatures (including a living stone elemental), portable items, ordinary terrain texture, and absent, removed, or hypothetical structures. Suggestion-only utility calls are read-only: no new map facts or MAP_REVEAL.\n"+
    "Before finalizing, check each such feature against PLAYER-KNOWN GEOGRAPHY. For a new feature emit [MAP_REVEAL:new|public label|bearing|observed]; use reported instead of observed for testimony. For an existing feature use its f-handle only when disclosing a new name or other newly learned attribute. Do not repeat unchanged discoveries or declare an existing feature as new. Do not change its established direction.\n"+
    "Bearings: N, NE, E, SE, S, SW, W, NW, unknown. Use unknown when no bearing is established; a direction is not a distance. Disclose only the label actually learned. Do not classify its type; the map uses neutral labelled pins. Seeing a hut reveals neither owner nor interior; keep a generic label until its name is learned. Testimony remains reported until the party actually perceives the feature; do not narrate a reported destination as newly seen.\n"+
    "Place each directive at top level, never inside another tag. Narrate naturally; do not write or imitate the engine's formulaic \"You see/hear of [label]\" confirmations. This directive is PUBLIC NARRATION: the engine inserts and speaks its discovery sentence here. Never use a disclosure for secrets, negation, hypotheticals, or private preparation.\n"+
    "Put LOCATION/SUBLOCATION before disclosures belonging there: each directive belongs to the place in force at its position. For a new room, use the full building — room path in SUBLOCATION; a bare room name cannot establish its building. Never invent a feature, owner, interior, bearing, or measurement to populate the drawing.\n"+"\n";
}
