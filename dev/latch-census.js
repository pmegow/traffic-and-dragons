// latch-census.js — transitive NOTE_BUILDERS state-write census (joint f31 / TODO #277-3).
// This is verification policy, not runtime behavior. Exemptions are owner-scoped: a later
// writer of the same key is undeclared unless it earns its own reviewed rationale.
var NOTE_LATCH_REQUIRED_RATIONALES={
  clock:"invariant-repair — restoring corruption after a failed request would undo a repair, not un-burn a note",
  pendingRewardClaims:"f31: the player-visible shelve decision precedes the request; subject+tokens dedupe prevents a duplicate claim"
};
// These are the builder host and the three helper surfaces the shipped NOTE_BUILDERS call into.
// Keeping the input explicit prevents persistence/migration internals reached through saveAll()
// from being misclassified as request-composition latches.
var NOTE_LATCH_CENSUS_FILES=["api.js","helpers.js","identity.js","clock.js"];
var NOTE_LATCH_EXEMPT={
  clock:{owner:"clockEnsure",rationale:"invariant-repair — restoring corruption after a failed request would undo a repair, not un-burn a note"},
  pendingRewardClaims:{owner:"rewardClaimQueue",rationale:"f31: the player-visible shelve decision precedes the request; subject+tokens dedupe prevents a duplicate claim"}
};

function matchingBrace(src,open){
  var depth=1,i=open+1,quote="",esc=false,line=false,block=false,regex=false,charClass=false,ch,nx,j,prev,word;
  for(;i<src.length;i++){
    ch=src.charAt(i);nx=src.charAt(i+1);
    if(line){if(ch==="\n")line=false;continue;}
    if(block){if(ch==="*"&&nx==="/"){block=false;i++;}continue;}
    if(regex){
      if(esc)esc=false;
      else if(ch==="\\")esc=true;
      else if(ch==="[")charClass=true;
      else if(ch==="]")charClass=false;
      else if(ch==="/"&&!charClass)regex=false;
      continue;
    }
    if(quote){if(esc)esc=false;else if(ch==="\\")esc=true;else if(ch===quote)quote="";continue;}
    if(ch==="/"&&nx==="/"){line=true;i++;continue;}
    if(ch==="/"&&nx==="*"){block=true;i++;continue;}
    if(ch==="/"){
      j=i-1;while(j>=0&&/\s/.test(src.charAt(j)))j--;prev=src.charAt(j);
      word="";while(j>=0&&/[A-Za-z_$]/.test(src.charAt(j))){word=src.charAt(j)+word;j--;}
      if(!prev||/[({[,:;=!?&|+\-*%^~<>]/.test(prev)||/^(return|case|delete|typeof|void|new|in|of|yield|await)$/.test(word)){
        regex=true;charClass=false;esc=false;continue;
      }
    }
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==="{")depth++;else if(ch==="}"&&!--depth)return i;
  }
  return -1;
}
function functionsFrom(file,src,out){
  var re=/\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{/g,m,open,end;
  while((m=re.exec(src))){open=re.lastIndex-1;end=matchingBrace(src,open);if(end<0)break;
    out[m[1]]={file:file,body:src.slice(open+1,end)};re.lastIndex=end+1;
  }
}
function aliases(body){
  var map={},changed=true,m,re;
  re=/(?:\bvar\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*worldState\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while((m=re.exec(body)))map[m[1]]=m[2];
  while(changed){changed=false;
    re=/(?:\bvar\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*(?:\[[^\]]+\]|\.[A-Za-z_$][A-Za-z0-9_$]*))?/g;
    while((m=re.exec(body)))if(map[m[2]]&&!map[m[1]]){map[m[1]]=map[m[2]];changed=true;}
  }
  return map;
}
function writesIn(body){
  var out={},m,re,a=aliases(body),name;
  re=/(?:delete\s+)?worldState\.([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*(?:\[[^\]]+\]|\.[A-Za-z_$][A-Za-z0-9_$]*))*\s*(?:=(?!=)|\+=|-=|\*=|\/=|\+\+|--)/g;
  while((m=re.exec(body)))out[m[1]]=1;
  re=/delete\s+worldState\.([A-Za-z_$][A-Za-z0-9_$]*)/g;while((m=re.exec(body)))out[m[1]]=1;
  re=/worldState\.([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*(?:\[[^\]]+\]|\.[A-Za-z_$][A-Za-z0-9_$]*))*\.(?:push|pop|shift|unshift|splice|sort|reverse)\s*\(/g;
  while((m=re.exec(body)))out[m[1]]=1;
  for(name in a)if(Object.prototype.hasOwnProperty.call(a,name)){
    var esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    re=new RegExp("(?:delete\\s+)?"+esc+"(?:\\s*(?:\\[[^\\]]+\\]|\\.[A-Za-z_$][A-Za-z0-9_$]*))+\\s*(?:=(?!=)|\\+=|-=|\\*=|\\/=|\\+\\+|--)","g");
    if(re.test(body))out[a[name]]=1;
    re=new RegExp("delete\\s+"+esc+"(?:\\s*(?:\\[[^\\]]+\\]|\\.[A-Za-z_$][A-Za-z0-9_$]*))+","g");
    if(re.test(body))out[a[name]]=1;
    re=new RegExp(esc+"(?:\\s*(?:\\[[^\\]]+\\]|\\.[A-Za-z_$][A-Za-z0-9_$]*))*\\.(?:push|pop|shift|unshift|splice|sort|reverse)\\s*\\(","g");
    if(re.test(body))out[a[name]]=1;
  }
  return Object.keys(out);
}
function callsIn(body,known){
  var out=[],seen={},re=/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,m;
  while((m=re.exec(body)))if(known[m[1]]&&!seen[m[1]]){seen[m[1]]=1;out.push(m[1]);}
  return out;
}
function listLiteral(src,name){
  var m=String(src||"").match(new RegExp("var\\s+"+name+"=\\[([^\\]]*)\\]"));
  return m?(m[1].match(/[A-Za-z_$][A-Za-z0-9_$]*/g)||[]):[];
}
function questNestedRestored(api){
  return api.indexOf("snap.quests.push({title:ql[i].title,staleNudged:ql[i].staleNudged})")>=0&&
    api.indexOf("if(qr.staleNudged===undefined)delete ql2[j].staleNudged;else ql2[j].staleNudged=qr.staleNudged;")>=0;
}
function exemptionStatus(key,owners){
  var ex=NOTE_LATCH_EXEMPT[key],required=NOTE_LATCH_REQUIRED_RATIONALES[key],i;
  if(!ex)return {ok:false,reason:"no exemption"};
  if(!required||ex.rationale!==required)return {ok:false,reason:"required rationale text is missing or changed"};
  if(!owners.length)return {ok:false,reason:"the exemption has no observed writer"};
  for(i=0;i<owners.length;i++)if(owners[i]!==ex.owner)return {ok:false,reason:"writer "+owners[i]+" is outside the exemption's "+ex.owner+" boundary"};
  return {ok:true,reason:ex.rationale};
}
function censusSources(sources){
  var funcs={},file,api=String(sources["api.js"]||""),i,n,q=[],seen={},writes={},writeOwners={};
  for(file in sources)if(Object.prototype.hasOwnProperty.call(sources,file))functionsFrom(file,String(sources[file]||""),funcs);
  var builders=listLiteral(api,"NOTE_BUILDERS"),declared=listLiteral(api,"NOTE_LATCH_FIELDS");
  for(i=0;i<builders.length;i++)q.push(builders[i]);
  while(q.length){n=q.shift();if(seen[n]||!funcs[n])continue;seen[n]=1;
    var fw=writesIn(funcs[n].body),fc=callsIn(funcs[n].body,funcs),j;
    for(j=0;j<fw.length;j++){
      writes[fw[j]]=1;
      if(!writeOwners[fw[j]])writeOwners[fw[j]]=[];
      if(writeOwners[fw[j]].indexOf(n)<0)writeOwners[fw[j]].push(n);
    }
    for(j=0;j<fc.length;j++)if(!seen[fc[j]])q.push(fc[j]);
  }
  var all=Object.keys(writes).sort(),decl={},nested={},exempt={},missing=[],rationaleFailures=[];
  for(i=0;i<declared.length;i++)decl[declared[i]]=1;
  if(writes.questLog&&questNestedRestored(api))nested.questLog="questLog[].staleNudged title-keyed snapshot/restore";
  for(i=0;i<all.length;i++){
    var key=all[i],xs;
    if(decl[key]||nested[key])continue;
    xs=exemptionStatus(key,writeOwners[key]||[]);
    if(xs.ok)exempt[key]=xs.reason;
    else{missing.push(key);if(NOTE_LATCH_EXEMPT[key])rationaleFailures.push(key+": "+xs.reason);}
  }
  return {builders:builders,reachable:Object.keys(seen).sort(),declared:declared,writes:all,writeOwners:writeOwners,nested:nested,exempt:exempt,missing:missing,rationaleFailures:rationaleFailures};
}
module.exports={censusSources:censusSources,NOTE_LATCH_CENSUS_FILES:NOTE_LATCH_CENSUS_FILES,NOTE_LATCH_EXEMPT:NOTE_LATCH_EXEMPT,NOTE_LATCH_REQUIRED_RATIONALES:NOTE_LATCH_REQUIRED_RATIONALES};
