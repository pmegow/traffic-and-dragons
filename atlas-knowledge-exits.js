/* atlas-knowledge-exits.js — current public EXIT declarations share geographic admission.
   The open-way list is a separate affordance: its capacity or an already-filed destination
   cannot erase a fresh public declaration. Notes never establish bearings or identity. */
function atlasKnowledgeExitFields(body){
  var fields=String(body||"").split("|"),label=fields[0].trim().replace(/\s+/g," ");
  if(fields.length>2||!label||(fields.length===2&&fields[1].length>1000))return null;
  var e={op:"disclose",id:"new",label:label,proposalKind:"",bearing:"unknown",mode:"reported",quote:""};
  e.quote=atlasKnowledgeReceipt(e);return e;
}
function atlasKnowledgeDirectiveEvent(directive){
  var m=/^\[(MAP_REVEAL|EXIT):([^\[\]\r\n]*)\]$/.exec(String(directive||""));if(!m)return null;
  return m[1]==="EXIT"?atlasKnowledgeExitFields(m[2]):atlasKnowledgeFields(m[2].split("|").map(function(x){return x.trim();}));
}
function atlasKnowledgeExitApply(text,R){
  var raw=String(text||""),q=R.mapReveals||(R.mapReveals=atlasKnowledgeRead(raw,R)),re=/\[EXIT:([^\[\]\r\n]*)\]/g,m,records=[],all=[],i,at,e,xr;
  if(!/\[EXIT(?::|\])/.test(raw))return;
  function refuse(reason){q.reason=reason;R.muts.push("⚠ [EXIT:] refused — "+reason);if(typeof console!=="undefined")console.warn("[map exits] "+reason);}
  if(q.reason){refuse(q.reason);return;}
  var sourceRe=/\[(?:MAP_REVEAL|EXIT)(?::[^\[\]\r\n]*)?\]/g;
  while((m=sourceRe.exec(raw)))all.push({start:m.index,end:sourceRe.lastIndex,directive:m[0]});
  var source=atlasKnowledgeRebase(R.mapSource==null?raw:R.mapSource,raw,{raw:raw,items:all,reason:""});
  if(source.reason){refuse(source.reason);return;}
  if(all.length>16){refuse("at most 16 public map disclosures are accepted per turn");return;}
  while((m=re.exec(raw))){
    e=atlasKnowledgeExitFields(m[1]);
    var problem=e?MapKnowledge.eventProblem(e):"EXIT needs a public label and at most one bounded display note";
    if(problem){refuse(problem);return;}
    at=rPlaceAt(R,m.index);
    if(!at||!at.key){refuse("the public exit has no established containing place");return;}
    records.push({container:locResolve(at.key),event:e,start:m.index,end:re.lastIndex,directive:m[0],at:at,note:m[1].indexOf("|")<0?"":m[1].slice(m[1].indexOf("|")+1).trim()});
  }
  if(records.length!==(raw.match(/\[EXIT(?::|\])/g)||[]).length){refuse("an EXIT directive is truncated or malformed");return;}
  for(i=0;i<records.length;i++){
    var item=records[i];xr=fileExit(item.event.label,item.note,R.turn,item.at);
    if(!xr.ok){
      R.muts.push("⚠ [EXIT:] refused — "+xr.reason);
      if(typeof console!=="undefined")console.warn("[tags] EXIT refused at "+(xr.key||"the source place")+": "+xr.reason);
      if(xr.code!=="capacity"&&xr.code!=="known"){q.reason=xr.reason;continue;}
    }else if(!xr.dup)R.muts.push("Exit: "+item.event.label+(item.note?" ("+item.note+")":"")+" — "+xr.open+" of "+EXIT_CAP+" open ways here");
    q.items.push({container:item.container,event:item.event,start:item.start,end:item.end,directive:item.directive});
  }
  q.items.sort(function(a,b){return a.start-b.start;});
}
/* EXIT contributes only an absent label. Explicit disclosures and already-known attributes
   remain authoritative, regardless of source order; canonical ambiguity is never a first match. */
function atlasKnowledgeExitSelect(items,s,token){
  var out=[],seen=Object.create(null),keys=Object.keys(s.features),i,j,item,key,count,f,explicit,resolve=function(x){return typeof locResolve==="function"?locResolve(x):x;};
  function identity(container,label){return JSON.stringify([resolve(container),label.replace(/\s+/g," ").toLowerCase()]);}
  for(i=0;i<items.length;i++){
    item=items[i];if(item.directive.indexOf("[EXIT:")!==0){out.push(item);continue;}
    key=identity(item.container,item.event.label);count=0;
    for(j=0;j<keys.length;j++){f=s.features[keys[j]];if(identity(f.container,f.label)===key)count++;}
    if(count>1)throw new Error("the public exit label is ambiguous in this resolved place");
    explicit=false;for(j=0;j<items.length;j++)if(items[j].directive.indexOf("[MAP_REVEAL:")===0&&identity(items[j].container,items[j].event.label)===key){explicit=true;break;}
    var receiptKeys=Object.keys(s.receipts),recorded=null,ri,rj,receipt;
    for(ri=0;ri<receiptKeys.length;ri++){
      if(receiptKeys[ri].indexOf(token+":")!==0)continue;receipt=s.receipts[receiptKeys[ri]];
      if(receipt.turn!==worldState.turn||resolve(receipt.container)!==resolve(item.container))continue;
      for(rj=0;rj<receipt.events.length;rj++)if(JSON.stringify(receipt.events[rj])===JSON.stringify(item.event)){recorded=receipt;break;}
    }
    if((count&&!recorded)||explicit||Object.prototype.hasOwnProperty.call(seen,key))continue;
    if(recorded)item={container:recorded.container,event:item.event,start:item.start,end:item.end,directive:item.directive};
    seen[key]=1;out.push(item);
  }
  return out;
}
