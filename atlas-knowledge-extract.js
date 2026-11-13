/* atlas-knowledge-extract.js — bounded public-source extraction and detached admission.
   Model classifications are proposals. Literal citations prove provenance, not the truth
   or semantics of an assertion; the producer must distinguish observation from a report. */
function atlasExtractionScan(raw,origin){
  function refuse(reason){return {ok:false,reason:reason};}
  if(typeof raw!=="string"||raw.length>60000)return refuse("extraction source exceeds the 60000-character bound");
  var problem=atlasKnowledgeMovementProblem(raw);if(problem)return refuse(problem);
  var tl=placeTimeline(raw,origin.world,origin.sub),segments=[],open=null,i=0,start=0,total=0,error="";
  function flush(end){
    if(open!==null)return;
    var a=start,b=end;while(a<b&&/\s/.test(raw.charAt(a)))a++;while(b>a&&/\s/.test(raw.charAt(b-1)))b--;
    if(a===b)return;
    var at=placeStateAt(tl,a);if(!at||!at.key){error="public extraction text has no established place";return;}
    total+=b-a;if(total>16000||segments.length>=64){error="public extraction text or segment capacity exceeded";return;}
    segments.push({id:"s"+(segments.length+1),start:a,end:b,text:raw.slice(a,b),container:locResolve(at.key)});
  }
  function marker(token){
    var m=/^CANON_TXN_(BEGIN|END):([^\[\]\r\n]*)$/.exec(token);if(!m){error="the extraction canon envelope is malformed";return;}
    if(m[1]==="BEGIN"){var f=m[2].split("|");if(open!==null||f.length!==5||!f[0].trim()){error="the extraction canon envelope is malformed";return;}open=f[0].trim();}
    else{if(open===null||m[2].trim()!==open){error="the extraction canon envelope is unmatched";return;}open=null;}
  }
  while(i<raw.length&&!error){
    if((i===0||raw.charAt(i-1)==="\n")&&/^[ \t]*CANON_TXN_(?:BEGIN|END)(?::|\b)/.test(raw.slice(i))){
      flush(i);var lineEnd=raw.indexOf("\n",i);if(lineEnd<0)lineEnd=raw.length;var bracket=raw.indexOf("[",i);if(bracket>=0&&bracket<lineEnd)lineEnd=bracket;marker(raw.slice(i,lineEnd).trim());i=lineEnd;start=i;continue;
    }
    if(raw.charAt(i)==="["){
      flush(i);var depth=1,j=i+1;for(;j<raw.length&&depth;j++){if(raw.charAt(j)==="[")depth++;else if(raw.charAt(j)==="]")depth--;}
      if(depth)return refuse("the extraction source contains an unclosed tag subtree");
      var token=raw.slice(i+1,j-1);if(/^CANON_TXN_(?:BEGIN|END)(?::|\b)/.test(token))marker(token);
      i=j;start=i;continue;
    }
    if(raw.charAt(i)==="]")return refuse("the extraction source contains an unmatched closing bracket");
    i++;
  }
  if(error)return refuse(error);if(open!==null)return refuse("the extraction canon envelope is truncated");flush(raw.length);if(error)return refuse(error);
  return {ok:true,raw:raw,origin:{world:origin.world,sub:origin.sub},segments:segments};
}
function atlasExtractionFreeze(o){if(o&&typeof o==="object"){Object.keys(o).forEach(function(k){atlasExtractionFreeze(o[k]);});Object.freeze(o);}return o;}
function atlasExtractionSource(raw){
  try{
    var w=worldState.world||{},s=atlasExtractionScan(raw,{world:w.location||null,sub:w.sublocation||null});if(!s.ok)return s;
    var state=memory.map&&memory.map.geography,p=MapKnowledge.problem(state);if(p)return {ok:false,reason:p};
    var scopes=[],by=Object.create(null),payload={segments:[],scopes:scopes},keys=Object.keys(state.features),total=0,i,j,seg,scope,f;
    for(i=0;i<s.segments.length;i++){
      seg=s.segments[i];scope=by[seg.container];
      if(!scope){if(scopes.length>=32)return {ok:false,reason:"extraction scope capacity exceeded"};scope={id:"p"+(scopes.length+1),known:[],knownOmitted:0};by[seg.container]=scope;scopes.push(scope);
        for(j=0;j<keys.length;j++){f=state.features[keys[j]];if(locResolve(f.container)!==seg.container)continue;if(total>=128){scope.knownOmitted++;continue;}scope.known.push({id:f.id,label:f.label,bearing:f.bearing,mode:f.mode});total++;}
      }
      payload.segments.push({id:seg.id,scope:scope.id,text:seg.text});
    }
    s.payload=payload;return atlasExtractionFreeze(s);
  }catch(e){return {ok:false,reason:"extraction source failed: "+((e&&e.message)||e)};}
}
function atlasExtractionSourceProblem(source){
  if(!source||source.ok!==true||!source.origin||!Array.isArray(source.segments))return "missing extraction source";
  var fresh=atlasExtractionScan(source.raw,source.origin);if(!fresh.ok)return fresh.reason;
  if(fresh.segments.length!==source.segments.length)return "extraction source span count changed";
  for(var i=0;i<fresh.segments.length;i++){var a=fresh.segments[i],b=source.segments[i];if(!b||a.id!==b.id||a.start!==b.start||a.end!==b.end||a.text!==b.text||a.container!==locResolve(b.container))return "extraction source span or scope changed";}
  return "";
}
function atlasExtractionFields(o,names){
  if(!o||typeof o!=="object"||Array.isArray(o))return false;
  var keys=Object.keys(o),i;if(keys.length!==names.length)return false;for(i=0;i<names.length;i++)if(!Object.prototype.hasOwnProperty.call(o,names[i]))return false;return true;
}
function atlasExtractionRecords(events,source){
  function refuse(reason){return {ok:false,reason:reason};}
  var p=atlasExtractionSourceProblem(source);if(p)return refuse(p);
  if(!Array.isArray(events)||events.length>16)return refuse("extraction needs at most 16 discovery records");
  var out=[],i,j,e,seg,at,local,a,b,dirs,found,dir;
  var bearings={N:1,NE:1,E:1,SE:1,S:1,SW:1,W:1,NW:1,unknown:1};
  var words={north:"N",northeast:"NE",east:"E",southeast:"SE",south:"S",southwest:"SW",west:"W",northwest:"NW",n:"N",ne:"NE",e:"E",se:"SE",s:"S",sw:"SW",w:"W",nw:"NW"};
  for(i=0;i<events.length;i++){
    e=events[i];if(!atlasExtractionFields(e,["source","label","quote","mode","bearing","bearingQuote"]))return refuse("extraction record has missing or unsupported fields");
    if(typeof e.source!=="string"||typeof e.label!=="string"||typeof e.quote!=="string"||typeof e.bearingQuote!=="string")return refuse("extraction record fields must be strings");
    seg=null;for(j=0;j<source.segments.length;j++)if(source.segments[j].id===e.source)seg=source.segments[j];if(!seg)return refuse("extraction names an unknown public source");
    var event={op:"disclose",id:"new",label:e.label,proposalKind:"",bearing:e.bearing,mode:e.mode,quote:e.quote};p=MapKnowledge.eventProblem(event);if(p)return refuse(p);
    at=seg.text.indexOf(e.quote);if(at<0||e.quote.indexOf(e.label)<0)return refuse("extraction quote or literal public label is absent from its source");
    if(seg.text.indexOf(e.quote,at+1)>=0)return refuse("extraction quotation is ambiguous in its public source");
    if(!Object.prototype.hasOwnProperty.call(bearings,e.bearing))return refuse("extraction bearing is invalid");
    if(e.bearing==="unknown"){if(e.bearingQuote!=="")return refuse("unknown position cannot carry directional evidence");}
    else{
      if(!e.bearingQuote||e.bearingQuote.length>600||e.quote.indexOf(e.bearingQuote)<0)return refuse("extraction bearing needs an exact supporting quotation");
      dirs=e.bearingQuote.toLowerCase().replace(/\b(north|south)[ -](east|west)\b/g,"$1$2").match(/\b(?:northeast|northwest|southeast|southwest|north|east|south|west)\b/g)||[];
      var abbr=/\b(?:NE|NW|SE|SW|N|E|S|W)\b/g,am;while((am=abbr.exec(e.bearingQuote)))if(!/['’]/.test(e.bearingQuote.charAt(am.index-1))&&!/['’]/.test(e.bearingQuote.charAt(abbr.lastIndex)))dirs.push(am[0].toLowerCase());found=null;
      for(j=0;j<dirs.length;j++){dir=words[dirs[j]];if(found&&found!==dir)return refuse("directional quotation is ambiguous");found=dir;}
      if(found!==e.bearing)return refuse("directional quotation does not establish the proposed bearing");
    }
    /* These conservative local exclusions catch clear clipped absence/hypothesis claims.
       They are not semantic proof: dialogue, perspective and relevance remain model judgements. */
    a=at;while(a>0&&!/[.!?;\n]/.test(seg.text.charAt(a-1)))a--;b=at+e.quote.length;while(b<seg.text.length&&!/[.!?;\n]/.test(seg.text.charAt(b)))b++;local=seg.text.slice(a,b);
    if(/\b(?:there (?:is|are|was|were) no|does not exist|doesn't exist|denies? (?:a|an|the)|no longer (?:stands|exists)|if\b[^.!?;\n]{0,180}\b(?:existed|were|was there))\b/i.test(local))return refuse("the supporting local assertion is absent or hypothetical");
    out.push({source:e.source,label:e.label,quote:e.quote,mode:e.mode,bearing:e.bearing,bearingQuote:e.bearingQuote});
  }
  return {ok:true,events:out};
}
function atlasExtractionRead(reply,source,finish){
  try{
    if(finish&&(finish.cut||finish.cap))return {ok:false,reason:"the extraction response ended early"};
    if(typeof reply!=="string"||reply.length>20000)return {ok:false,reason:"extraction reply exceeds its bounded JSON contract"};
    var text=reply.trim(),fence=/^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(text);if(fence)text=fence[1];
    var obj=JSON.parse(text);if(!atlasExtractionFields(obj,["discoveries","overflow"])||obj.overflow!==false)return {ok:false,reason:"extraction envelope is malformed or overflowed"};
    return atlasExtractionRecords(obj.discoveries,source);
  }catch(e){return {ok:false,reason:"extraction JSON refused: "+((e&&e.message)||e)};}
}
function atlasExtractionPrepare(source,events,state,opts){
  try{
    function refuse(reason){return {ok:false,reason:reason};}
    var read=atlasExtractionRecords(events,source);if(!read.ok)return read;
    var p=MapKnowledge.problem(state);if(p)return refuse(p);opts=opts||{};
    if(typeof opts.commit!=="string"||!opts.commit||opts.commit.length>150||typeof opts.turn!=="number"||opts.turn<0||Math.floor(opts.turn)!==opts.turn)return refuse("extraction has no valid narrated commit context");
    var explicit=opts.explicit&&opts.explicit.items?opts.explicit.items:(opts.explicit||[]);if(!Array.isArray(explicit))return refuse("extraction explicit-disclosure context is malformed");
    var next=JSON.parse(JSON.stringify(state)),groups=[],by=Object.create(null),seen=Object.create(null),keys=Object.keys(state.features),added=0,skipped=0,i,j,e,seg,container,matches,f,key,ev,group,skip;
    function folded(s){return s.replace(/\s+/g," ").toLowerCase();}
    for(i=0;i<read.events.length;i++){
      e=read.events[i];for(j=0;j<source.segments.length;j++)if(source.segments[j].id===e.source)seg=source.segments[j];container=locResolve(seg.container);matches=[];
      for(j=0;j<keys.length;j++){f=state.features[keys[j]];if(locResolve(f.container)===container&&folded(f.label)===folded(e.label))matches.push(f);}
      if(matches.length>1)return refuse("extraction public label is ambiguous in its resolved place");f=matches[0]||null;skip=false;
      for(j=0;j<explicit.length;j++){var x=explicit[j];if(!x||!x.event||typeof x.directive!=="string"||x.directive.indexOf("[MAP_REVEAL:")!==0||locResolve(x.container)!==container)continue;if(folded(x.event.label)===folded(e.label)||(f&&x.event.id===f.id))skip=true;
        /* A same-turn handle rename must not recreate the source's older public spelling. */
        if(!skip&&source.payload){var ss=source.payload.segments.filter(function(z){return z.id===seg.id;})[0],sc=ss&&source.payload.scopes.filter(function(z){return z.id===ss.scope;})[0];if(sc)for(var k=0;k<sc.known.length;k++)if(sc.known[k].id===x.event.id&&folded(sc.known[k].label)===folded(e.label))skip=true;}
      }
      if(skip){skipped++;continue;}
      if(f&&f.bearing!=="unknown"&&e.bearing!=="unknown"&&f.bearing!==e.bearing)return refuse("extraction conflicts with an established bearing");
      ev={op:"disclose",id:f?f.id:"new",label:f?f.label:e.label,proposalKind:"",bearing:f&&f.bearing!=="unknown"?f.bearing:e.bearing,mode:f&&f.mode==="observed"?"observed":e.mode,quote:e.quote};
      if(f){container=f.container;if(f.receipt.indexOf(opts.commit+":")===0){var prior=state.receipts[f.receipt].events[f.event];if(prior.quote!==e.quote)return refuse("extraction retry differs from its committed source");ev=JSON.parse(JSON.stringify(prior));}else if(f.bearing===ev.bearing&&f.mode===ev.mode){skipped++;continue;}}
      key=JSON.stringify([locResolve(container),folded(ev.label)]);if(Object.prototype.hasOwnProperty.call(seen,key)){var prev=seen[key];if(prev.bearing!==ev.bearing||prev.mode!==ev.mode)return refuse("extraction repeats a public label with conflicting attributes");skipped++;continue;}seen[key]=ev;
      group=by[container];if(!group){group={container:container,events:[]};by[container]=group;groups.push(group);}group.events.push(ev);added++;
    }
    var text=source.segments.map(function(s){return s.text;}).join("\n");
    for(i=0;i<groups.length;i++){group=groups[i];var result=MapKnowledge.prepare(next,group.events,{channel:"gm",commit:opts.commit+":"+i,turn:opts.turn,container:group.container,text:text});if(!result.ok)return refuse(result.reason);next=result.state;}
    return {ok:true,state:next,added:added,skipped:skipped};
  }catch(e){return {ok:false,reason:"extraction preparation failed: "+((e&&e.message)||e)};}
}
