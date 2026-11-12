/* atlas-knowledge-source.js — preserve the original public source across parser preprocessing.
   Only offsets are rebased. Changed geographic tokens, private nesting, and canon scopes refuse. */
function atlasKnowledgeRebase(original,ordinary,queued){
  var raw=String(original||""),text=String(ordinary||""),q=queued||{raw:text,items:[],reason:""};
  function refuse(reason){return {raw:raw,items:[],reason:reason};}
  if(q.reason)return refuse(q.reason);
  if(q.raw!==text)return refuse("the queued ordinary map source changed before rebasing");
  if(!Array.isArray(q.items))return refuse("the queued map source has no valid item list");
  /* Bare markers are normalized only for scope validation, never for source offsets. */
  var scoped=typeof tagRestoreBareMarkers==="function"?tagRestoreBareMarkers(raw,true):raw;
  var scopeRe=/\[(CANON_TXN_BEGIN|CANON_TXN_END|MAP_REVEAL)(?::([^\[\]\r\n]*))?\]/g,m,open=null,scopeError="",remainder=scoped;
  while((m=scopeRe.exec(scoped))){
    if(m[1]==="MAP_REVEAL"){if(open!==null){scopeError="a map disclosure inside a canon envelope is not public authority";break;}continue;}
    remainder=remainder.replace(m[0],"");
    if(m[1]==="CANON_TXN_BEGIN"){
      var fields=String(m[2]||"").split("|");
      if(open!==null||fields.length!==5||!fields[0].trim()){scopeError="the canon envelope scope is malformed";break;}
      open=fields[0].trim();
    }else{
      if(open===null||String(m[2]||"").trim()!==open){scopeError="the canon envelope scope is unmatched";break;}
      open=null;
    }
  }
  if(scopeError)return refuse(scopeError);
  if(open!==null||/(?:\[CANON_TXN_(?:BEGIN|END)(?::|\])|^[ \t]*CANON_TXN_(?:BEGIN|END):)/m.test(remainder))return refuse("the canon envelope scope is truncated or malformed");
  function tokens(s){var re=/\[(?:MAP_REVEAL(?::[^\[\]\r\n]*)?|LOCATION:[^\]]+|SUBLOCATION:[^\]]+|SUBLOCATION_LEAVE)\]/g,a=[],hit;while((hit=re.exec(s)))a.push({text:hit[0],start:hit.index,end:re.lastIndex,map:hit[0].indexOf("[MAP_REVEAL")===0});return a;}
  var source=tokens(raw),parsed=tokens(text),i,j,depth=0,cursor=0,maps=[],out={raw:raw,items:[],reason:""};
  if(source.length!==parsed.length)return refuse("the geographic token sequence changed during preprocessing");
  for(i=0;i<source.length;i++){
    if(source[i].text!==parsed[i].text)return refuse("the geographic token sequence changed during preprocessing");
    if(!source[i].map)continue;
    for(;cursor<source[i].start;cursor++){if(raw.charAt(cursor)==="[")depth++;else if(raw.charAt(cursor)==="]")depth=Math.max(0,depth-1);}
    if(depth)return refuse("a nested private map directive is not public authority");
    maps.push(i);
  }
  if(maps.length!==q.items.length)return refuse("the queued map source has a different disclosure count");
  for(j=0;j<maps.length;j++){
    i=maps[j];var item=q.items[j];
    if(!item||item.start!==parsed[i].start||item.end!==parsed[i].end||item.directive!==parsed[i].text)return refuse("the queued map source offsets changed before rebasing");
    out.items.push({container:item.container,event:item.event,start:source[i].start,end:source[i].end,directive:source[i].text});
  }
  return out;
}
