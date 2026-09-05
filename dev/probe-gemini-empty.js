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
for(var i=0;i<args.length;i++){if(args[i]==="--n")n=parseInt(args[++i],10)||3;else if(args[i]==="--model")model=args[++i];else if(args[i]==="--dry")dry=true;else if(!save&&/\.tnd$/i.test(args[i]))save=args[i];else lines.push(args[i]);}
if(!save){console.error("usage: node dev/probe-gemini-empty.js <save.tnd> [--n 3] [--model m] [--dry] \"player line\" ...");process.exit(2);}
if(!lines.length)lines=["It's... because.... of the... fuck it. Pull her hips down and take her in the tub.","Pull her hips down and take her in the tub."];
var key=process.env.GEMINI_API_KEY||"";
if(!key&&!dry){console.error("GEMINI_API_KEY is not set — set it in this shell (it is never written to disk), or pass --dry to build the requests only.");process.exit(2);}
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
