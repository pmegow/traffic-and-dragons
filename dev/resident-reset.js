// resident-reset.js — DEV TOOL (#461, owner 2026-09-25): strip ONE resident's GM-written village canon from a save so
// the GM meets them from their SHEET again. Never overwrites: writes <save>_<slug>-reset.tnd beside the input and a
// .removed.json sidecar holding everything taken out, so the reset is reversible by hand. The transcript is sacred
// (owner decree 2026-07-17) — nothing is deleted from it; the GM entries that mention the resident get the retcon
// flag (rc:1), which only de-indexes them from retrieval (memory.js ragRetrieve skips rc entries).
//
// What goes: memory.npcs[name].attitude / events / knowledge (the GM's own portrait), the roster mood + stance, the
// sentences that name them in chapter summaries, and the whispers by or about them. What stays: the sheet (trait,
// flaw, look, motivation, voices, portrait), pronouns, lastSeenAt, every bond, every transcript entry.
//
// Usage: node dev/resident-reset.js <save.tnd> "<resident name>" [--apply]
var fs=require("fs"),path=require("path");
var args=process.argv.slice(2),apply=args.indexOf("--apply")>=0;args=args.filter(function(a){return a!=="--apply";});
var save=args[0],name=args[1];
if(!save||!name){console.error("usage: node dev/resident-reset.js <save.tnd> \"<resident name>\" [--apply]");process.exit(2);}
var d=JSON.parse(fs.readFileSync(save,"utf8")),ws=d.worldState||{},m=d.memory||{};
if(!ws.npcs)ws.npcs=[];var roster=ws.npcs.filter(function(n){return n&&n.name===name;})[0];
if(!roster){console.error("no roster entry named "+JSON.stringify(name)+" — names on the roster: "+ws.npcs.map(function(n){return n.name;}).join(", "));process.exit(2);}
if(roster.partyMember){console.error(name+" is a PARTY MEMBER — this tool is for residents; a companion's record is theirs");process.exit(2);}
var esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),first=name.split(/\s+/)[0],reName=new RegExp("\\b(?:"+esc+"|"+first.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")\\b");
var removed={name:name,from:path.basename(save),turn:ws.turn,at:new Date().toISOString(),memory:{},roster:{},chapters:[],whispers:[],transcriptFlagged:[]};
var rec=m.npcs&&m.npcs[name];
console.log("== "+name+" in "+path.basename(save)+" (turn "+ws.turn+")");
if(rec){
  removed.memory.attitude=rec.attitude||"";removed.memory.events=rec.events||[];removed.memory.knowledge=rec.knowledge||[];
  console.log("memory: attitude "+JSON.stringify(rec.attitude||"")+" → \"\"; events "+(rec.events||[]).length+" → 0; knowledge "+(rec.knowledge||[]).length+" → 0");
  if(apply){rec.attitude="";rec.events=[];rec.knowledge=[];}
}else console.log("memory: no record");
removed.roster.status=roster.status||"";removed.roster.statusTurn=roster.statusTurn||0;removed.roster.rel=roster.rel||"";
console.log("roster: mood "+JSON.stringify(roster.status||"")+" → \"\"; stance "+JSON.stringify(roster.rel||"")+" → \"resident\"");
if(apply){roster.status="";roster.statusTurn=0;roster.rel="resident";}
var chN=0,sentN=0;(m.chapters||[]).forEach(function(c,i){var s=String(c.summary||"");if(!reName.test(s))return;chN++;
  var parts=s.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g)||[s];var keep=[],gone=[];parts.forEach(function(pt){if(reName.test(pt))gone.push(pt.trim());else keep.push(pt);});
  sentN+=gone.length;removed.chapters.push({index:i,removed:gone});if(apply)c.summary=keep.join("").replace(/\s{2,}/g," ").trim();});
console.log("chapters: "+chN+" of "+(m.chapters||[]).length+" mention them; "+sentN+" sentence(s) removed");
var wh=ws.whispers||[],whGone=wh.filter(function(w){return reName.test(String(w.text||""));});removed.whispers=whGone;
console.log("whispers: "+whGone.length+" of "+wh.length+" by or about them removed");
if(apply)ws.whispers=wh.filter(function(w){return !reName.test(String(w.text||""));});
var flagged=0;(ws.transcript||[]).forEach(function(e){if(e&&e.r==="gm"&&!e.rc&&reName.test(String(e.x||""))){flagged++;removed.transcriptFlagged.push(e.t);if(apply)e.rc=1;}});
console.log("transcript: "+flagged+" GM entries mentioning them get rc:1 (de-indexed from retrieval; nothing deleted)");
if(!apply){console.log("\n(list only — add --apply to write the reset save)");process.exit(0);}
var slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
var out=save.replace(/\.tnd$/i,"")+"_"+slug+"-reset.tnd",side=out.replace(/\.tnd$/,".removed.json");
if(fs.existsSync(out)){console.error("refusing to overwrite "+out);process.exit(2);}
fs.writeFileSync(out,JSON.stringify(d),"utf8");fs.writeFileSync(side,JSON.stringify(removed,null,2),"utf8");
console.log("\nwrote "+out+"\nremoved material kept in "+side);
