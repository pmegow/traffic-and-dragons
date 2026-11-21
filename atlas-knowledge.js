/* atlas-knowledge.js — narrated geography admission. MAP_REVEAL is a public declaration: a committed,
   validated one files its feature on the player's map. Since #775 (owner 2026-11-18 and 2026-11-20) NOTHING is
   written into the story for it: the receipt sentence is the map record's own evidence (the store keeps it), the
   map shows the feature, and the Console says what the map gained. Parsing, cleanTxt, Table Talk, sheet sync,
   and prose rerolls cannot disclose a new feature. */
function atlasKnowledgeActive(){return !!(typeof worldState!=="undefined"&&worldState&&worldState.atlas&&worldState.atlas.knowledge===1);}
function atlasKnowledgeContext(){
  var k=(typeof currentNodeKey==="function")?currentNodeKey():null,w=(typeof worldState!=="undefined"&&worldState)?worldState.world:null;
  if(!k&&w)k=w.location+(w.sublocation?"|"+w.sublocation:"");
  return k&&typeof locResolve==="function"?locResolve(k):k;
}
/* #756 (owner 2026-11-14, Kaelon at The Ironwood Heart: "there are several places listed, but none are drawn on the map";
   rulings by chips: ask the GM for directions, and drop the entries that are the place itself). Two mechanisms:
   (1) A place was listed as a feature OF ITSELF: the extractor read "the winding path yields to the Ironwood Heart" inside
       The Ironwood Heart and filed "Ironwood Heart" there, position unknown. atlasKnowledgeSelfLabel is the one test — the
       label, a leading "the" and punctuation folded, IS the containing place's own name. The extractor skips such a record
       and the player's sheet does not show one already on file; the record itself is never rewritten.
   (2) A feature disclosed without a bearing can only be listed, and nothing ever asked for the bearing afterwards. The
       player-known block now names the features of the current place whose direction is OWED (atlasKnowledgeOwed, capped
       at ATLAS_KNOWLEDGE_OWED_CAP) with the directive that settles each — the core has always let a handle's "unknown"
       bearing be established once (MapKnowledge.prepare), nothing taught the GM to do it. */
var ATLAS_KNOWLEDGE_OWED_CAP=6;
function atlasKnowledgeFold(s){return String(s==null?"":s).toLowerCase().replace(/^\s*the\s+/,"").replace(/[^a-z0-9]+/g," ").trim();}
function atlasKnowledgeSelfLabel(container,label){
  var leaf=(typeof locDisplayLeaf==="function")?locDisplayLeaf(container):String(container==null?"":container).split("|").pop(),a=atlasKnowledgeFold(leaf);
  return !!a&&a===atlasKnowledgeFold(label);
}
/* #769, #770 (owner 2026-11-15, the nest at Shattered Ridge: "6 map labels overlap and are omitted"; "the nest is treated as
   a dungeon rather than overlapping site after site"; rulings by chips: its own sheet, and plain scenery kept off).
   Two mechanisms piled one sheet high. (1) The party went INSIDE the beast's den and the GM never declared it, so every
   thing found inside was filed on Shattered Ridge. A sub-location has always had a sheet of its own; nothing told the GM
   that entering a den is entering one. The standing rules now say so (ENCLOSED SITES), a sheet past
   ATLAS_KNOWLEDGE_CROWDED features says so again on the turn's brief, and the parent sheet's pin for the site opens the
   site's sheet (atlas-public.js). (2) Plain scenery was pinned ("stone floor"): the ground underfoot is not a place.
   atlasKnowledgeScenery is the one test — a plain phrase whose head noun is a surface or loose matter; a NAME (a capital
   past the phrase's first letter: the Black Floor) is never scenery. It is kept out at both doors (the GM's directive,
   the landmark reader) and a record already on file is not shown; the record itself is never rewritten. */
var ATLAS_KNOWLEDGE_CROWDED=8;
var ATLAS_KNOWLEDGE_SCENERY=["floor","floors","ceiling","ground","rubble","debris","dirt","dust","mud","soil","fog","mist","smoke","air","darkness","shadows","gloom"];
function atlasKnowledgeScenery(label){
  var raw=String(label==null?"":label).replace(/^\s*(?:the|a|an)\s+/i,"").trim(),words;
  if(!raw||/[A-Z]/.test(raw.slice(1)))return false;/* a name is a place, whatever its last word */
  words=atlasKnowledgeFold(raw).split(" ");
  return ATLAS_KNOWLEDGE_SCENERY.indexOf(words[words.length-1])>=0;
}
/* The features of one place the player's sheet shows: the projection without the place's own name and without scenery. */
function atlasKnowledgeShown(container,features){var out=[],i;for(i=0;i<features.length;i++)if(!atlasKnowledgeSelfLabel(container,features[i].label)&&!atlasKnowledgeScenery(features[i].label))out.push(features[i]);return out;}
/* The brief's line for a sheet that has grown crowded: the usual cause is a site the party is inside and nobody declared. */
function atlasKnowledgeCrowdedLine(container,features){
  var n=atlasKnowledgeShown(container,features).length;
  return n>=ATLAS_KNOWLEDGE_CROWDED?"SHEET CROWDED: "+n+" features are filed on this one place, more than its sheet can label. If the party is INSIDE a site within it (a den, a lair, a cave, ruins, a building), that site is owed its own sheet: declare it now with [SUBLOCATION:its name] and file what is inside it there.\n":"";
}
/* The features of one place whose direction is owed: shown, and position unknown. */
function atlasKnowledgeOwed(container,features){var shown=atlasKnowledgeShown(container,features),out=[],i;for(i=0;i<shown.length;i++)if(shown[i].bearing==="unknown")out.push(shown[i]);return out;}
function atlasKnowledgeOwedLine(container,features){
  var owed=atlasKnowledgeOwed(container,features),parts=[],i;if(!owed.length)return "";
  for(i=0;i<owed.length&&i<ATLAS_KNOWLEDGE_OWED_CAP;i++)parts.push("[MAP_REVEAL:"+owed[i].id+"|"+owed[i].label+"|<bearing>|"+owed[i].mode+"]");
  return "DIRECTION OWED: "+owed.length+" feature"+(owed.length>1?"s":"")+" here "+(owed.length>1?"are":"is")+" known without a direction, so the player's map can only list "+(owed.length>1?"them":"it")+". You are the author of this world: a feature the party can SEE lies somewhere, so decide where each observed one lies from this place and settle it THIS turn, once, with its handle and a real bearing; a reported one waits until its direction is told: "+parts.join(" ")+(owed.length>ATLAS_KNOWLEDGE_OWED_CAP?" (and "+(owed.length-ATLAS_KNOWLEDGE_OWED_CAP)+" more)":"")+". Keep to what the narration already implies; where it implies nothing, your choice becomes the fact. Leave one alone only when it is this place itself, a phrase that only describes it, or a thing with no fixed position.\n";/* #766 (owner 2026-11-15: "any way we can force the GM to give direction?" — both: this rule, and atlas-directions.js behind it) */
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
   in touched scopes before any candidate or public receipt becomes part of the turn.
   audit 2026-11-19, A2: only a clash THIS TURN makes is refused — one that involves a feature the turn created, renamed
   or moved (`before` is the store as it stood before the turn). The scan used to cover every feature of the scope, so
   once a place merge had left two features with one name, everything disclosed there was refused for good, with a
   toast telling the GM to use a handle (which could not help). The old pair stays as it is: two pins of one name. */
function atlasKnowledgeCollision(s,groups,before){
  var scopes=Object.create(null),labels=Object.create(null),keys=Object.keys(s.features),i,f,k,label,resolve=function(x){return typeof locResolve==="function"?locResolve(x):x;};
  function touched(x){var o=before&&before.features&&Object.prototype.hasOwnProperty.call(before.features,x.id)?before.features[x.id]:null;return !o||o.label!==x.label||o.container!==x.container;}
  for(i=0;i<groups.length;i++)scopes[resolve(groups[i].container)]=1;
  for(i=0;i<keys.length;i++){
    f=s.features[keys[i]];k=resolve(f.container);if(!Object.prototype.hasOwnProperty.call(scopes,k))continue;
    label=JSON.stringify([k,f.label.replace(/\s+/g," ").toLowerCase()]);
    if(Object.prototype.hasOwnProperty.call(labels,label)){if(touched(f)||touched(labels[label]))return "public label already identifies "+(touched(f)?labels[label].id:f.id)+" in this resolved place; use its handle or a distinct label";continue;}
    labels[label]=f;
  }
  return "";
}
/* Each readable receipt occupies the directive's original place in the narration. A copied
   quotation elsewhere cannot suppress it or move its meaning past a subsequent arrival. */
/* #768 (owner 2026-11-15, Shattered Ridge on v1.1435: "You see subterranean rift to the southwest." twice — after #763).
   #763 fixed a cause that was reproduced but was not the one in play. The one in play: the engine's receipt is stored in
   the turn it belongs to, so the GM's own history shows "[MAP_REVEAL:…]" followed by "You see …" in every earlier reply
   of its own — and it writes the pair itself, against the standing rule. The engine then added its line beside the GM's.
   A receipt the GM has ALREADY WRITTEN at its directive is the receipt: a line of its own that is exactly the sentence,
   standing directly after the directive (only blank space, other tags and other receipt lines between, never past a
   change of place) or directly before it. A quotation inside other prose is not that line and suppresses nothing
   (the #733 rule stands). */
function atlasKnowledgeLineStart(text,i){while(i>0&&/[ \t]/.test(text.charAt(i-1)))i--;return i===0||/[\r\n\]]/.test(text.charAt(i-1));}
/* #775, independent review: once the line is CUT (not merely counted), "begins with the sentence" is not enough — it took the
   opening off real prose ("You see a ruined tower to the east... and beyond it, the sea" → ".. and beyond it, the sea"; a
   speaker's unquoted line; a sentence with a quotation mark after it). The receipt is a line of its OWN: nothing else stands on
   its line but blank space and tags, and no speaker tag stands before it. And only a line of the receipt's own SHAPE is another
   feature's receipt to step over — a paragraph that merely begins "You see" ends the search. */
var ATLAS_KNOWLEDGE_RECEIPT_LINE=/^You (?:see|hear of) [^\r\n]*?(?: to the (?:north|northeast|east|southeast|south|southwest|west|northwest)\.|; its precise position is not established\.)[ \t]*(?=\r?\n|$)/;
function atlasKnowledgeOwnLine(text,at,n){
  var ls=at>0?text.lastIndexOf("\n",at-1)+1:0,le=text.indexOf("\n",at+n),before,after,m,tag=/\[([A-Z_]+)(?::[^\[\]\r\n]*)?\]/g;
  if(le<0)le=text.length;before=text.slice(ls,at);after=text.slice(at+n,le);
  if(after.replace(/\[[A-Z_]+(?::[^\[\]\r\n]*)?\]/g,"").trim())return false;
  while((m=tag.exec(before)))if(/^SAY/.test(m[1]))return false;/* a speaker's line is dialogue, whatever it says */
  return !before.replace(/\[[A-Z_]+(?::[^\[\]\r\n]*)?\]/g,"").trim();
}
function atlasKnowledgeWrittenAt(text,start,end,quote){
  var i=end,rest,m,before;
  for(;;){
    rest=text.slice(i);m=/^\s+/.exec(rest);if(m){i+=m[0].length;continue;}
    if(rest.slice(0,quote.length)===quote&&atlasKnowledgeLineStart(text,i)&&atlasKnowledgeOwnLine(text,i,quote.length))return i;
    m=/^\[([A-Z_]+)(?::[^\[\]\r\n]*)?\]/.exec(rest);if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}
    m=ATLAS_KNOWLEDGE_RECEIPT_LINE.exec(rest);if(m&&atlasKnowledgeLineStart(text,i)){i+=m[0].length;continue;}/* another feature's receipt line */
    break;
  }
  before=text.slice(0,start).replace(/\s+$/,"");
  i=before.length-quote.length;
  return before.slice(-quote.length)===quote&&atlasKnowledgeLineStart(before,i)&&atlasKnowledgeOwnLine(text,i,quote.length)?i:-1;
}
function atlasKnowledgeWritten(text,start,end,quote){return atlasKnowledgeWrittenAt(text,start,end,quote)>=0;}
/* #775 (owner 2026-11-18: "Let's get rid of this text. These should be markers on the map"; 2026-11-20: "Let's drop this
   part of the narrative. Let's let the map fill in those details unless the player asks"). The engine no longer writes
   its receipt into the story, so the turn is stored as the reply wrote it — with ONE exception: a receipt sentence the
   reply wrote ITSELF beside its directive (the #768 habit: older turns of the GM's own history still show the pair) is
   taken out, by the #768 scanner's rule of where that line stands — and only when it is a line of its OWN (blank space and
   tags beside it, no speaker tag before it). A sentence with prose after it on its line, a quotation, a speaker's line
   stay as the reply wrote them. The line goes with it; nothing else of the reply is touched. `items` are ALL the directives
   the reply stated, filed or not (a scenery one's line is that formula too). */
function atlasKnowledgeUnsaid(raw,items){
  var text=String(raw||""),cuts=[],seen=Object.create(null),i,at,q,ls,le,pe,ne;
  for(i=0;i<items.length;i++){
    q=items[i].event.quote;at=atlasKnowledgeWrittenAt(text,items[i].start,items[i].end,q);
    if(at>=0&&!seen[at]){seen[at]=1;cuts.push({at:at,n:q.length,label:items[i].event.label});}
  }
  cuts.sort(function(a,b){return b.at-a.at;});/* from the end, so an earlier position stays true */
  for(i=0;i<cuts.length;i++){
    at=cuts[i].at;text=text.slice(0,at)+text.slice(at+cuts[i].n);
    ls=at>0?text.lastIndexOf("\n",at-1)+1:0;le=text.indexOf("\n",at);if(le<0)le=text.length;
    if(!text.slice(ls,le).trim()){/* the line held nothing else: it goes, and one of two blank lines it stood between */
      text=le<text.length?text.slice(0,ls)+text.slice(le+1):text.slice(0,ls>0?ls-1:0).replace(/\r$/,"");
      pe=ls>=2?text.lastIndexOf("\n",ls-2)+1:-1;ne=text.indexOf("\n",ls);
      if(pe>=0&&ls<=text.length&&!text.slice(pe,ls-1).trim()&&ne>=0&&!text.slice(ls,ne).trim())text=text.slice(0,ls)+text.slice(ne+1);
    }else if(at>0&&/[ \t]/.test(text.charAt(at-1))&&(at>=text.length||/[ \t\r\n]/.test(text.charAt(at))))text=text.slice(0,at-1)+text.slice(at);/* "tag␣sentence" beside other tags: the space before it goes too */
    if(typeof console!=="undefined")console.info("[map knowledge] #775 the reply wrote its own receipt for '"+cuts[i].label+"'; it is taken out of the story (the map shows it)");
  }
  return text;
}
/* #775: what the map gained is said in the Console (#772), never in the story — one line a commit, naming each feature
   that is new, or whose name, direction or standing changed (worded as atlas-directions.js words its own notice). What the player's sheet does not show (scenery, the place's own name) is
   not announced. */
var ATLAS_KNOWLEDGE_NEWS_MAX=6;/* features named in one Console line; the rest are counted (where the Console is shut the line is a pill on screen) */
function atlasKnowledgeNewsLine(f){
  var d=Object.prototype.hasOwnProperty.call(ATLAS_KNOWLEDGE_DIRECTIONS,f.bearing)?ATLAS_KNOWLEDGE_DIRECTIONS[f.bearing]:"position not established";
  if(d==="position not established")return f.label+(f.mode==="reported"?" is spoken of":"")+" (position not established)";
  return f.label+(f.mode==="reported"?" is said to lie to the ":" lies to the ")+d;
}
function atlasKnowledgeNews(before,after){
  var lines=[],ids,i,f,o;
  try{
    ids=Object.keys(after.features);
    for(i=0;i<ids.length;i++){
      f=after.features[ids[i]];o=before&&before.features&&Object.prototype.hasOwnProperty.call(before.features,ids[i])?before.features[ids[i]]:null;
      if(o&&o.label===f.label&&o.bearing===f.bearing&&o.mode===f.mode)continue;
      if(atlasKnowledgeScenery(f.label)||atlasKnowledgeSelfLabel(typeof locResolve==="function"?locResolve(f.container):f.container,f.label))continue;
      lines.push(atlasKnowledgeNewsLine(f));
    }
    if(lines.length&&typeof showToast==="function")showToast("Map: "+lines.slice(0,ATLAS_KNOWLEDGE_NEWS_MAX).join("; ")+(lines.length>ATLAS_KNOWLEDGE_NEWS_MAX?"; and "+(lines.length-ATLAS_KNOWLEDGE_NEWS_MAX)+" more":"")+".",5000);
  }catch(e){if(typeof console!=="undefined")console.warn("[map knowledge] #775 what the map gained could not be said: "+((e&&e.message)||e));}
  return lines;
}
function atlasKnowledgePublish(raw,items){
  var text=String(raw||""),out="",cursor=0,i,item,m,fields,e,said=Object.create(null),sk;
  for(i=0;i<items.length;i++){
    item=items[i];e=item.event;
    if(typeof item.start!=="number"||Math.floor(item.start)!==item.start||item.start<cursor||typeof item.end!=="number"||Math.floor(item.end)!==item.end||item.end<=item.start||item.end>text.length||text.slice(item.start,item.end)!==item.directive)throw new Error("the queued map directive no longer matches its narrated source");
    m=/^\[MAP_REVEAL:([^\[\]\r\n]*)\]$/.exec(item.directive);fields=m?m[1].split("|").map(function(x){return x.trim();}):[];
    if(JSON.stringify(typeof atlasKnowledgeDirectiveEvent==="function"?atlasKnowledgeDirectiveEvent(item.directive):atlasKnowledgeFields(fields))!==JSON.stringify(e))throw new Error("the queued map disclosure differs from its public directive");
    /* #763 (owner 2026-11-15, Petrified Mire: "You see Shattered Ridge to the north." twice, and the Track twice): a
       reply that states one disclosure twice — the same place, the same receipt — printed its receipt at each statement.
       The record already kept one; the page says it once, at the first statement. A different place or a different
       receipt is another line. */
    sk=JSON.stringify([item.container,e.quote]);
    if(!said[sk]&&atlasKnowledgeWritten(text,item.start,item.end,e.quote))said[sk]=1;/* #768: the reply's own line is the evidence here; #775 takes it out of the stored turn (atlasKnowledgeUnsaid says so) */
    out+=text.slice(cursor,item.end)+(said[sk]?"":"\n\n"+e.quote+"\n\n");said[sk]=1;cursor=item.end;
  }
  return out+text.slice(cursor);
}
function atlasKnowledgeSay(reason){
  if(typeof console!=="undefined")console.warn("[map knowledge] "+reason);
  if(typeof showToast==="function")showToast("Map: "+reason,6000);
}
/* A detached candidate is installed only when every scoped group passes. The narrated turn is stored as the reply
   wrote it (#775: no receipt line; one the reply wrote itself is taken out); cleanTxt later strips the directive. */
function atlasKnowledgeCommitResult(raw,parsed,opts){
  var result={text:raw,accepted:[],refusal:null};
  function refuse(kind,reason,suffix){result.refusal={kind:kind,reason:reason};atlasKnowledgeSay(reason+(suffix||""));return result;}
  if(!atlasKnowledgeActive())return result;
  try{
    var q=parsed||atlasKnowledgeRead(raw),s=memory&&memory.map&&memory.map.geography,s0=s,problem=MapKnowledge.problem(s),groups=[],lookup=Object.create(null),i,j,item,group,r,token,visible,out,items,accepted,shown;
    if(q.reason)return refuse("source",q.reason,"; no new map discoveries were filed");
    if(q.raw!==String(raw||""))return refuse("source","the queued map disclosure source changed","; no new map discoveries were filed");
    if(!Array.isArray(q.items))return refuse("source","the queued map disclosures are malformed","; no new map discoveries were filed");
    if(!q.items.length)return result;
    atlasKnowledgePublish(raw,q.items);/* Validate every queued source before any coalescing can hide a changed declaration. */
    if(problem)return refuse("state",problem,"; existing map data was preserved");
    token=(opts&&opts.commit)||("gm:"+worldState.turn+":"+Date.now().toString(36)+":"+Math.random().toString(36).slice(2));
    items=typeof atlasKnowledgeExitSelect==="function"?atlasKnowledgeExitSelect(q.items,s,token):q.items;
    items=items.filter(function(x){if(x.directive.indexOf("[MAP_REVEAL:")!==0||!atlasKnowledgeScenery(x.event.label))return true;if(typeof console!=="undefined")console.info("[map knowledge] #770 '"+x.event.label+"' is scenery, not a place; not filed");return false;});/* #770: skipped, never a refusal — the rest of the turn's declarations stand */
    if(!items.length)return result;
    for(i=0;i<items.length;i++){
      item=items[i];
      if(!Object.prototype.hasOwnProperty.call(lookup,item.container)){lookup[item.container]=groups.length;groups.push({container:item.container,events:[]});}
      group=groups[lookup[item.container]];group.events.push(item.event);
    }
    out=atlasKnowledgePublish(raw,items);visible=cleanTxt(out);/* #775: the receipts at their directives are the EVIDENCE the core checks (a directive inside another tag has none in public text); they are no longer the stored turn */
    for(j=0;j<groups.length;j++){
      group=groups[j];r=MapKnowledge.prepare(s,group.events,{channel:"gm",commit:token+":"+j,turn:worldState.turn,container:group.container,text:visible});
      if(!r.ok)return refuse("state",r.reason,"; these map declarations were not filed");s=r.state;
    }
    problem=atlasKnowledgeCollision(s,groups,s0);if(problem)return refuse("state",problem,"; these map declarations were not filed");
    accepted=JSON.parse(JSON.stringify(items));
    shown=atlasKnowledgeUnsaid(raw,q.items);/* #775: the story gains no line */
    if(!cleanTxt(shown).trim())shown=out;/* …unless the reply holds NOTHING else: a turn of map tags alone would show no narration, offer no buttons and leave the GM's history (the bookkeeping rule). The receipts are its narration then, as they were before #775. */
    memory.map.geography=s;/* installed last: nothing after this line can fail and report a refusal for what was filed */
    result.text=shown;result.accepted=accepted;
    atlasKnowledgeNews(s0,s);
    return result;
  }catch(e){return refuse("source","the discovery could not be recorded: "+((e&&e.message)||e));}
}
/* Compatibility callers consume narration only; the turn handoff consumes the atomic outcome. */
function atlasKnowledgeCommit(raw,parsed,opts){return atlasKnowledgeCommitResult(raw,parsed,opts).text;}

function atlasKnowledgeTurnReceipts(bare){
  var s=memory&&memory.map&&memory.map.geography,out=[],keys,i,j,r;
  var problem=MapKnowledge.problem(s);if(problem){atlasKnowledgeSay(problem+"; committed map receipts could not be read");return out;}
  keys=Object.keys(s.receipts).sort();
  for(i=0;i<keys.length;i++){r=s.receipts[keys[i]];if(r.turn!==worldState.turn)continue;for(j=0;j<r.events.length;j++){var scope=typeof locResolve==="function"?locResolve(r.container):r.container,line=(bare?"":"At "+scope.replace(/\|/g," — ")+": ")+atlasKnowledgeReceipt(r.events[j]);if(out.indexOf(line)<0)out.push(line);}}
  return out;
}
function atlasKnowledgeUnlist(text,restated){
  var rows=String(text||"").split("\n"),out=[],i,bare;
  for(i=0;i<rows.length;i++){
    bare=rows[i].trim();
    if(bare&&(restated.indexOf(bare)>=0||bare==="Retained discoveries from this turn:")){if(out.length&&!out[out.length-1].trim()&&i+1<rows.length&&!rows[i+1].trim())i++;continue;}
    out.push(rows[i]);
  }
  return out.join("\n").replace(/\s+$/,"");
}
function atlasKnowledgeRerollNote(){
  if(!atlasKnowledgeActive())return "";
  var lines=atlasKnowledgeTurnReceipts();
  return "\n\nPROSE REROLL: keep all committed geography unchanged. Do not add MAP_REVEAL or EXIT directives or introduce new locations, landmarks, names, directions, or rooms. The player's map already shows this turn's discoveries; keep the prose true to them and do not restate them as lines of their own: "+(lines.length?lines.join(" "):"none were committed in this turn.");
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
  /* #775: nothing is appended — the map holds the turn's discoveries, and the reroll changes none of them. A line of the
     reroll that ONLY restates one (the note above lists them, and a model echoes lists) is dropped. */
  return atlasKnowledgeUnlist(text,lines.concat(atlasKnowledgeTurnReceipts(true)));
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
    out+=atlasKnowledgeOwedLine(k,p.features);/* #756: the directions the map still owes */
    out+=atlasKnowledgeCrowdedLine(k,p.features);/* #769 */
  }catch(e){out+="The map knowledge could not be read; no private geography is substituted.\n";if(typeof console!=="undefined")console.warn("[map knowledge] public brief refused: "+((e&&e.message)||e));}
  return out+"Positions are schematic unless explicitly established; do not infer metres, routes, interiors, ownership, or exploration.\n\n";
}
function atlasKnowledgePrompt(){
  if(!atlasKnowledgeActive())return "";
  return atlasKnowledgePlayerBlock()+
    "PUBLIC MAP DISCLOSURES: world facts and accepted changes constrain the map; a generated layout never overrules the story.\n"+
    "On EVERY narrated turn, disclose newly introduced FIXED geographic features that help the player navigate or act: distinctive trees or stones, buildings, paths, exits, and destinations. Include features described in NPC dialogue, directions, EXIT descriptions, and SUGGEST targets, even while the party stands still. Exclude the place the party stands in and any phrase that only describes it, NPCs, creatures (including a living stone elemental), portable items, ordinary terrain texture, and absent, removed, or hypothetical structures. Suggestion-only utility calls are read-only: no new map facts or MAP_REVEAL.\n"+
    "Before finalizing, check each such feature against PLAYER-KNOWN GEOGRAPHY. For a new feature emit [MAP_REVEAL:new|public label|bearing|observed]; use reported instead of observed for testimony. For an existing feature use its f-handle only when disclosing a new name or other newly learned attribute, or to settle a direction listed under DIRECTION OWED. Do not repeat unchanged discoveries or declare an existing feature as new. Do not change its established direction.\n"+
    "Bearings: N, NE, E, SE, S, SW, W, NW, unknown. A feature the party perceives (observed) lies somewhere: give it a real bearing. You are the author; where the narration has not said, decide, and your choice becomes the fact. unknown is only for testimony (reported) whose direction was not told. A direction is not a distance. Disclose only the label actually learned. Do not classify its type; the map uses neutral labelled pins. Seeing a hut reveals neither owner nor interior; keep a generic label until its name is learned. Testimony remains reported until the party actually perceives the feature; do not narrate a reported destination as newly seen.\n"+
    "Place each directive at top level, never inside another tag. The directive puts the feature on the player's map; nothing is added to your narration for it. Narrate naturally: never write a formulaic \"You see/hear of [label] to the [direction]\" line (older turns show some; do not imitate them), and do not recite a place's features or their directions unless the player asks or the scene calls for it \u2014 the map shows them. A directive is a PUBLIC statement all the same: never use a disclosure for secrets, negation, hypotheticals, or private preparation.\n"+
    "ENCLOSED SITES: when the party goes INSIDE a site within this place \u2014 a den, a lair, a nest, a cave, a tunnel, ruins, a building, a camp \u2014 declare it that turn with [SUBLOCATION:its name], using the name the map already knows it by when one is listed, BEFORE anything disclosed inside it. What is found inside belongs to that site's own sheet, never to the place around it; [SUBLOCATION_LEAVE] when the party comes back out: it steps out ONE place, to the place the site lies in. A site inside a sub-location the party already stands in is written as a path, [SUBLOCATION:that sub-location \u2014 the site]. The floor, the ground, rubble, mist and the like are scenery, never map features.\n"+
    "Put LOCATION/SUBLOCATION before disclosures belonging there: each directive belongs to the place in force at its position. For a new room, use the full building — room path in SUBLOCATION; a bare room name cannot establish its building. Never invent a feature, owner, interior, or measurement to populate the drawing; choosing the bearing of a feature the party sees is authorship, not invention.\n"+"\n";
}
