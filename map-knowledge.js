/* map-knowledge.js — public geographic points, independent of movement and drawing.
   Proposed kinds and original source quotations are private provenance, never public geometry.
   prepare and upgrade return detached candidates; their owning commit installs them. */
var MapKnowledge=(function(){
  "use strict";
  var VERSION=2,MAX_FEATURES=4096,MAX_RECEIPTS=8192,MAX_EVENTS=16;
  var KINDS={landmark:1,hut:1,building:1,spring:1,tree:1,arch:1,ruin:1,cave:1,road:1,bridge:1,stone:1,camp:1};
  var BEARINGS={N:1,NE:1,E:1,SE:1,S:1,SW:1,W:1,NW:1,unknown:1};
  var MODES={observed:1,reported:1};
  function own(o,k){return !!o&&Object.prototype.hasOwnProperty.call(o,k);}
  function dict(){return Object.create(null);}
  function object(o){return !!o&&typeof o==="object"&&!Array.isArray(o);}
  function integer(n){return typeof n==="number"&&isFinite(n)&&n>=0&&Math.floor(n)===n&&n<9007199254740991;}
  function str(s,max){return typeof s==="string"&&s.length>0&&s.length<=max&&s.trim()===s&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);}
  function proposal(s){return typeof s==="string"&&s.length<=120&&s.trim()===s&&!/[\u0000-\u001f\u007f]/.test(s);}
  function folded(s){return s.replace(/\s+/g," ").toLowerCase();}
  function fields(o,list){var ks=Object.keys(o),i;for(i=0;i<ks.length;i++)if(list.indexOf(ks[i])<0)return "unsupported field "+ks[i];for(i=0;i<list.length;i++)if(!own(o,list[i]))return "missing field "+list[i];return "";}
  /* Legacy validation is available only to upgrade. Ordinary readers and writers use CURRENT. */
  var PROFILES={
    1:{version:1,eventFields:["op","id","label","kind","bearing","mode","quote"],featureFields:["id","container","label","kind","bearing","mode","receipt","event"],attributes:["label","kind","bearing","mode"],eventProblem:function(e){return own(KINDS,e.kind)?"":"unknown feature kind";},featureProblem:function(f){return own(KINDS,f.kind)?"":"unknown feature kind";}},
    2:{version:2,eventFields:["op","id","label","proposalKind","bearing","mode","quote"],featureFields:["id","container","label","bearing","mode","receipt","event"],attributes:["label","bearing","mode"],eventProblem:function(e){return proposal(e.proposalKind)?"":"invalid private proposal kind";},featureProblem:function(){return "";}}
  };
  var CURRENT=PROFILES[VERSION];
  function eventProblemFor(e,profile){
    if(!object(e))return "disclosure must be an object";
    var p=fields(e,profile.eventFields);if(p)return p;
    if(e.op!=="disclose")return "unsupported geography operation";
    if(e.id!=="new"&&!(typeof e.id==="string"&&/^f[1-9][0-9]*$/.test(e.id)))return "invalid feature handle";
    if(!str(e.label,120))return "invalid public label";
    p=profile.eventProblem(e);if(p)return p;
    if(!own(BEARINGS,e.bearing))return "unknown bearing";
    if(!own(MODES,e.mode))return "unknown knowledge mode";
    if(!str(e.quote,600))return "invalid public source quote";
    if(folded(e.quote).indexOf(folded(e.label))<0)return "public label is absent from its source quote";
    return "";
  }
  function eventProblem(e){return eventProblemFor(e,CURRENT);}
  function create(){return {v:VERSION,revision:0,next:1,features:dict(),receipts:dict()};}
  function validate(s,profile){
    if(!object(s)||s.v!==profile.version)return "unsupported map knowledge version";
    var p=fields(s,["v","revision","next","features","receipts"]),ids,rs,i,j,f,r,max=0,n,sources=dict(),sourceKey,labels=dict(),labelKey,a;
    if(p)return p;
    if(!integer(s.revision)||!integer(s.next)||s.next<1)return "invalid map knowledge counters";
    if(!object(s.features)||!object(s.receipts))return "invalid feature or receipt dictionary";
    ids=Object.keys(s.features);rs=Object.keys(s.receipts);
    if(ids.length>MAX_FEATURES||rs.length>MAX_RECEIPTS)return "map knowledge capacity exceeded";
    for(i=0;i<rs.length;i++){
      r=s.receipts[rs[i]];
      if(!str(rs[i],160)||!object(r)||fields(r,["turn","container","events"])||!integer(r.turn)||!str(r.container,300)||!Array.isArray(r.events)||!r.events.length||r.events.length>MAX_EVENTS)return "invalid receipt "+rs[i];
      for(j=0;j<r.events.length;j++){p=eventProblemFor(r.events[j],profile);if(p)return "receipt "+rs[i]+": "+p;}
    }
    for(i=0;i<ids.length;i++){
      f=s.features[ids[i]];
      if(!/^f[1-9][0-9]*$/.test(ids[i])||!object(f)||fields(f,profile.featureFields)||f.id!==ids[i])return "invalid feature "+ids[i];
      n=Number(ids[i].slice(1));if(!integer(n))return "invalid feature number";max=Math.max(max,n);
      if(!str(f.container,300)||!str(f.label,120)||!own(BEARINGS,f.bearing)||!own(MODES,f.mode)||profile.featureProblem(f))return "invalid public attributes on "+f.id;
      if(!str(f.receipt,160)||!own(s.receipts,f.receipt)||!integer(f.event))return "dangling receipt on "+f.id;
      r=s.receipts[f.receipt];j=f.event;
      if(j>=r.events.length||r.container!==f.container)return "invalid source reference on "+f.id;
      sourceKey=JSON.stringify([f.receipt,j]);if(own(sources,sourceKey))return "two features claim the same source event";sources[sourceKey]=1;
      labelKey=JSON.stringify([f.container,folded(f.label)]);if(own(labels,labelKey))return "duplicate public label in "+f.container;labels[labelKey]=f.id;
      var e=r.events[j];
      for(a=0;a<profile.attributes.length;a++)if(e[profile.attributes[a]]!==f[profile.attributes[a]])return "source attributes disagree on "+f.id;
      if(e.id!=="new"&&e.id!==f.id)return "source handle disagrees on "+f.id;
    }
    if(s.next<=max)return "feature counter would reuse an identity";
    return "";
  }
  function problem(s){return validate(s,CURRENT);}
  function copyFields(o,names){var c={},i;for(i=0;i<names.length;i++)c[names[i]]=o[names[i]];return c;}
  function eventCopy(e){return copyFields(e,CURRENT.eventFields);}
  function copy(s){
    var c=create(),ks=Object.keys(s.features),i,k,f;
    c.revision=s.revision;c.next=s.next;
    for(i=0;i<ks.length;i++){k=ks[i];c.features[k]=copyFields(s.features[k],CURRENT.featureFields);}
    ks=Object.keys(s.receipts);
    for(i=0;i<ks.length;i++){k=ks[i];f=s.receipts[k];c.receipts[k]={turn:f.turn,container:f.container,events:f.events.map(eventCopy)};}
    return c;
  }
  function refuse(reason){return {ok:false,reason:reason};}
  function upgrade(s){
    try{
      if(!object(s)||!own(PROFILES,s.v))return refuse("unsupported map knowledge version");
      var p=validate(s,PROFILES[s.v]),c,backup,keys,i,k,r;
      if(p)return refuse(p);
      if(s.v===VERSION)return {ok:true,state:copy(s),backup:null,upgraded:false};
      backup=JSON.parse(JSON.stringify(s));c=create();c.revision=s.revision;c.next=s.next;
      keys=Object.keys(s.features);for(i=0;i<keys.length;i++){k=keys[i];c.features[k]=copyFields(s.features[k],CURRENT.featureFields);}
      keys=Object.keys(s.receipts);for(i=0;i<keys.length;i++){
        k=keys[i];r=s.receipts[k];c.receipts[k]={turn:r.turn,container:r.container,events:r.events.map(function(e){return {op:e.op,id:e.id,label:e.label,proposalKind:e.kind,bearing:e.bearing,mode:e.mode,quote:e.quote};})};
      }
      p=problem(c);if(p)return refuse("converted map knowledge is invalid: "+p);
      return {ok:true,state:c,backup:backup,upgraded:true};
    }catch(e){return refuse("map knowledge upgrade failed: "+((e&&e.message)||e));}
  }
  function prepare(s,events,ctx){
    var p=problem(s),i,j,e,c,f,ids,id,receipt,match,normalized=[];
    if(p)return refuse(p);
    if(!object(ctx)||ctx.channel!=="gm")return refuse("only a narrated GM commit may disclose geography");
    if(!str(ctx.commit,160)||!integer(ctx.turn)||!str(ctx.container,300)||typeof ctx.text!=="string"||ctx.text.length>100000)return refuse("invalid narrated source context");
    if(!Array.isArray(events)||events.length>MAX_EVENTS)return refuse("invalid disclosure group or event capacity exceeded");
    for(i=0;i<events.length;i++){
      e=events[i];p=eventProblem(e);if(p)return refuse("event "+(i+1)+": "+p);
      if(ctx.text.indexOf(e.quote)<0)return refuse("event "+(i+1)+": source quote absent from public narration");
      normalized.push(eventCopy(e));
    }
    if(own(s.receipts,ctx.commit)){
      receipt=s.receipts[ctx.commit];
      if(receipt.container!==ctx.container||receipt.turn!==ctx.turn||JSON.stringify(receipt.events)!==JSON.stringify(normalized))return refuse("commit token already names a different disclosure group");
      return {ok:true,state:copy(s),duplicate:true};
    }
    if(!events.length)return {ok:true,state:copy(s),duplicate:false};
    if(Object.keys(s.receipts).length>=MAX_RECEIPTS)return refuse("receipt capacity reached; existing knowledge was preserved");
    if(s.revision>=9007199254740990)return refuse("map knowledge revision exhausted");
    c=copy(s);ids=Object.keys(c.features);
    for(i=0;i<normalized.length;i++){
      e=normalized[i];id=e.id;
      if(id==="new"){
        match=null;
        for(j=0;j<ids.length;j++){f=c.features[ids[j]];if(f.container!==ctx.container||folded(f.label)!==folded(e.label))continue;if(match)return refuse("public label is ambiguous in this place");match=f;}
        /* A scoped public label is unique. Proposed classifications are private evidence and
           cannot create a second identity or conflict with established public knowledge. */
        if(match){
          if(match.bearing!==e.bearing||match.mode!==e.mode)return refuse("public label already identifies "+match.id+" with different attributes; use its handle or a distinct label");
          id=match.id;
        }else{
          if(ids.length>=MAX_FEATURES||c.next>=9007199254740990)return refuse("feature capacity reached; existing knowledge was preserved");
          id="f"+c.next++;ids.push(id);
        }
      }else{
        if(!own(c.features,id)||c.features[id].container!==ctx.container)return refuse("unknown feature handle in this place: "+id);
        f=c.features[id];
        if(f.bearing!=="unknown"&&f.bearing!==e.bearing)return refuse("disclosure cannot replace an established bearing");
        if(f.mode==="observed"&&e.mode!=="observed")return refuse("disclosure cannot downgrade observed knowledge to a report");
        for(j=0;j<ids.length;j++)if(ids[j]!==id&&c.features[ids[j]].container===ctx.container&&folded(c.features[ids[j]].label)===folded(e.label))return refuse("public label belongs to another feature");
      }
      c.features[id]={id:id,container:ctx.container,label:e.label,bearing:e.bearing,mode:e.mode,receipt:ctx.commit,event:i};
    }
    c.receipts[ctx.commit]={turn:ctx.turn,container:ctx.container,events:normalized};c.revision++;
    return {ok:true,state:c,duplicate:false};
  }
  function project(s,container,audience,resolveContainer){
    if(audience!=="player")throw new Error("MapKnowledge: unsupported audience");
    if(!str(container,300))throw new Error("MapKnowledge: invalid container");
    var p=problem(s),out,ks,i,f,r;
    if(p)throw new Error("MapKnowledge: "+p);
    out={container:container,revision:s.revision,features:[]};
    ks=Object.keys(s.features).sort(function(a,b){return Number(a.slice(1))-Number(b.slice(1));});
    for(i=0;i<ks.length;i++){
      f=s.features[ks[i]];if((resolveContainer?resolveContainer(f.container):f.container)!==container)continue;r=s.receipts[f.receipt];
      out.features.push({id:f.id,label:f.label,bearing:f.bearing,mode:f.mode,source:{commit:f.receipt,turn:r.turn}});
    }
    return out;
  }
  return {create:create,prepare:prepare,project:project,problem:problem,eventProblem:eventProblem,upgrade:upgrade,version:VERSION};
}());
