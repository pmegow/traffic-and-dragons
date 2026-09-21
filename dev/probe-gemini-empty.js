// probe-gemini-empty.js — DEV TOOL (#335, the t189 tub, 2026-09-04): replay a save's exact GM request
// against gemini and print the RAW response shape — promptFeedback, finishReason, safetyRatings, and
// every part's keys — for a player line that came back empty and for the one that worked. The game
// adapter now names these reasons on the error line; this tool reads them straight off the wire.
//
// Usage (the key stays in the owner's hands — set it in the shell, never on disk):
//   set GEMINI_API_KEY=...            (PowerShell: $env:GEMINI_API_KEY="...")
//   node dev/probe-gemini-empty.js <save.tnd> [--n 3] [--model gemini-3.7-flash] [--dry] "player line" ["another line" ...]
// --dry builds the requests and prints their sizes without calling anything.
var fs=require("fs"),path=require("path");
var engine=require("./load-engine.js");engine.loadEngine("game.js");
var args=process.argv.slice(2),n=3,model="gemini-3.7-flash",dry=false,save=null,lines=[];
var extract=false;/* B38: replay the CHAPTER EXTRACTOR's exact payload from the save's session log, in both shapes */
for(var i=0;i<args.length;i++){if(args[i]==="--n")n=parseInt(args[++i],10)||3;else if(args[i]==="--model")model=args[++i];else if(args[i]==="--dry")dry=true;else if(args[i]==="--extract")extract=true;else if(!save&&/\.tnd$/i.test(args[i]))save=args[i];else lines.push(args[i]);}
if(!save){console.error("usage: node dev/probe-gemini-empty.js <save.tnd> [--n 3] [--model m] [--dry] [--extract] \"player line\" ...\n  --extract: replay the chapter extractor's payload built from the save's session log (B38) — the normal shape and the reframed, shortened shape, n tries each; prints promptFeedback/finishReason per try");process.exit(2);}
if(!lines.length)lines=["It's... because.... of the... fuck it. Pull her hips down and take her in the tub.","Pull her hips down and take her in the tub."];
var key=process.env.GEMINI_API_KEY||"";
if(!key&&!dry){console.error("GEMINI_API_KEY is not set — set it in this shell (it is never written to disk), or pass --dry to build the requests only.");process.exit(2);}
/* 2026-09-21: a pasted placeholder ("…", quotes, a space) reached the header and died deep inside undici as a
   ByteString error. Say what happened instead. A real key is plain ASCII with no spaces. */
if(key&&!dry&&/[^\x21-\x7e]/.test(key)){console.error("GEMINI_API_KEY holds a character that cannot go in an HTTP header ("+JSON.stringify(key.slice(0,12))+"…) — a pasted placeholder? Set the real key, e.g. PowerShell: $env:GEMINI_API_KEY=\"PASTE-YOUR-KEY-HERE\"");process.exit(2);}
var raw=JSON.parse(fs.readFileSync(save,"utf8"));
worldState=inflateWorldStateSnapshot(raw.worldState);memory=raw.memory||memory;sessionLog=raw.sessionLog||[];
activeProvider="gemini";providerModels.gemini=model;
var prov=PROVIDERS.gemini,sys=buildSysPrompt();
function shape(data){
  var c=data.candidates&&data.candidates[0],pf=data.promptFeedback,parts=(c&&c.content&&c.content.parts)||[];
  var out={promptBlock:pf&&pf.blockReason||null,finish:c?c.finishReason||null:"(no candidates)",parts:parts.map(function(p){var k=Object.keys(p);return k.join("+")+(typeof p.text==="string"?"("+p.text.length+"ch"+(p.thought?",thought":"")+")":"");}),
    blocked:[].concat((c&&c.safetyRatings)||[],(pf&&pf.safetyRatings)||[]).filter(function(r){return r&&(r.blocked||/HIGH|MEDIUM/.test(r.probability||""));}).map(function(r){return r.category.replace("HARM_CATEGORY_","")+":"+r.probability+(r.blocked?"!":"");}),
    usage:data.usageMetadata?{in:data.usageMetadata.promptTokenCount,out:data.usageMetadata.candidatesTokenCount,thought:data.usageMetadata.thoughtsTokenCount}:null};
  if(data.error)out.error=data.error.message||data.error;
  return out;
}
(async function(){
  if(extract){
    /* B38: the extractor's two shapes, exactly as summarize() builds them — normal caps vs the reframed, shortened shape.
       The system instruction is the extractor's own (EXTRACT_SYS); the payload is one user part, like the game sends. */
    var shapes=[{name:"normal",caps:EXTRACT_WINDOW_CAPS,pre:""},{name:"reframed",caps:EXTRACT_REFRAME_CAPS,pre:extractRefusalFraming()}],si;
    for(si=0;si<shapes.length;si++){
      var sh=shapes[si],win=buildExtractWindow(sh.caps),it=typeof summaryIdentityTable==="function"?summaryIdentityTable(win.raw):null;
      var ep=sh.pre+buildExtractPrompt("5-8 sentence narrative summary; third person, past tense, the hero by name",[],win.raw,win.txt,it);
      var ebody=prov.buildBody([{role:"user",content:ep}],EXTRACT_SYS,2000*prov.tokScale,model),epay=JSON.stringify(ebody);
      console.log("\n=== extractor shape: "+sh.name+"  ("+epay.length+" chars, window "+(sessionLog.length-sessKeptStart())+" msgs from t"+worldState.turn+", model "+model+")");
      if(dry)continue;
      for(var ek=0;ek<n;ek++){
        var eres=await fetch(prov.endpoint(model),{method:"POST",headers:prov.headers(key),body:epay}),etxt=await eres.text(),edata;
        try{edata=JSON.parse(etxt);}catch(e){console.log("  try "+(ek+1)+": HTTP "+eres.status+" non-JSON: "+etxt.slice(0,200));continue;}
        console.log("  try "+(ek+1)+": HTTP "+eres.status+" "+JSON.stringify(shape(edata)));
        try{var got=prov.parseResponse(edata);console.log("           adapter says: text, "+got.length+" chars, JSON head: "+got.slice(0,80).replace(/\s+/g," "));}catch(e){console.log("           adapter says: "+e.message+" (modelRefusal="+!!e.modelRefusal+")");}
      }
    }
    return;
  }
  for(var li=0;li<lines.length;li++){
    var msgs=sessionLog.filter(function(h){return h&&!h.bk;}).concat([{role:"user",content:lines[li]}]);
    var body=prov.buildBody(msgs,sys,1500*prov.tokScale,model),payload=JSON.stringify(body);
    console.log("\n=== line "+(li+1)+": "+JSON.stringify(lines[li])+"  ("+payload.length+" chars, "+msgs.length+" messages, model "+model+")");
    if(dry)continue;
    for(var k=0;k<n;k++){
      var res=await fetch(prov.endpoint(model),{method:"POST",headers:prov.headers(key),body:payload}),txt=await res.text(),data;
      try{data=JSON.parse(txt);}catch(e){console.log("  try "+(k+1)+": HTTP "+res.status+" non-JSON: "+txt.slice(0,200));continue;}
      var s=shape(data),first=((data.candidates||[])[0]||{}).content;first=first&&first.parts?first.parts.filter(function(p){return typeof p.text==="string"&&!p.thought;}).map(function(p){return p.text;}).join("").slice(0,140).replace(/\n/g," / "):"";
      console.log("  try "+(k+1)+": HTTP "+res.status+" "+JSON.stringify(s)+(first?"\n           text: "+JSON.stringify(first):""));
      try{prov.parseResponse(data);}catch(e){console.log("           adapter says: "+e.message);}
    }
  }
})().catch(function(e){console.error("probe failed:",e&&e.stack||e);process.exit(1);});
