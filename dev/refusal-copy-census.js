// refusal-copy-census.js — source census for player-facing W2 refusal reasons.
// Refusal vocabulary is found by syntax role (reason assignment / refusal call argument), never
// by a fixed English prefix: a new phrase must remain visible even when its first word is novel.
function literalStrings(src){
  var out=[],re=/"((?:[^"\\]|\\.)*)"/g,m;
  while((m=re.exec(String(src||"")))){
    try{out.push(JSON.parse(m[0]));}catch(e){out.push(m[1]);}
  }
  return out;
}
function addLong(out,seen,src){
  var vals=literalStrings(src),i,v;
  for(i=0;i<vals.length;i++){v=String(vals[i]);if(v.length>=18&&!/^\s/.test(v)&&!seen[v]){seen[v]=1;out.push(v);}}
}
function reasonAssignments(src,out,seen){
  var re=/\breason\s*(=(?!=)|:)\s*/g,m,start,end,delim;
  while((m=re.exec(src))){
    start=re.lastIndex;delim=m[1]==="="?";":"}";end=src.indexOf(delim,start);
    if(end<0)end=src.indexOf("\n",start);
    if(end<0)end=src.length;
    addLong(out,seen,src.slice(start,end));
  }
}
function callArguments(src,name){
  var out=[],needle=name+"(",at=0,start,i,depth,quote,esc,args,argStart;
  while((at=src.indexOf(needle,at))>=0){
    start=at+needle.length;i=start;depth=1;quote="";esc=false;
    for(;i<src.length&&depth;i++){
      var ch=src.charAt(i);
      if(quote){if(esc)esc=false;else if(ch==="\\")esc=true;else if(ch===quote)quote="";continue;}
      if(ch==='"'||ch==="'"){quote=ch;continue;}
      if(ch==="(")depth++;else if(ch===")")depth--;
    }
    if(depth){at+=needle.length;continue;}
    args=[];argStart=start;depth=0;quote="";esc=false;
    var end=i-1,j;
    for(j=start;j<=end;j++){
      var c=src.charAt(j);
      if(quote){if(esc)esc=false;else if(c==="\\")esc=true;else if(c===quote)quote="";continue;}
      if(c==='"'||c==="'"){quote=c;continue;}
      if(c==="("||c==="["||c==="{")depth++;
      else if(c===")"||c==="]"||c==="}")depth--;
      else if(c===","&&depth===0){args.push(src.slice(argStart,j));argStart=j+1;}
    }
    args.push(src.slice(argStart,end));out.push(args);at=i;
  }
  return out;
}
function callReasons(src,name,index,out,seen){
  var calls=callArguments(src,name),i;
  for(i=0;i<calls.length;i++)if(calls[i].length>index)addLong(out,seen,calls[i][index]);
}
function registry(identitySrc){
  var m=String(identitySrc||"").match(/var W2_REFUSAL_REASONS=\[([\s\S]*?)\n\];/);
  return m?literalStrings(m[1]):[];
}
function reasons(identitySrc,apiSrc){
  var out=[],seen={};identitySrc=String(identitySrc||"");apiSrc=String(apiSrc||"");
  reasonAssignments(identitySrc,out,seen);
  callReasons(identitySrc,"_w2Conflict",2,out,seen);
  callReasons(identitySrc,"w2TxnQuarantine",1,out,seen);
  callReasons(apiSrc,"w2TxnQuarantine",1,out,seen);
  return out;
}
function census(identitySrc,apiSrc){
  var listed=registry(identitySrc),found=reasons(identitySrc,apiSrc);
  var missing=found.filter(function(r){return !listed.some(function(k){return r.indexOf(k)===0||k.indexOf(r)===0;});});
  return {registry:listed,reasons:found,missing:missing};
}
module.exports={census:census,reasons:reasons,registry:registry};
