// dump-transcript.js — DEV TOOL (the /thursday ladder, rung 2): print a save's transcript for a
// turn window as plain text — "t<N> PLAYER:" / "t<N> GM:" — so a reviewer can read the week's play
// without the app. Reads worldState.transcript (clean text; an entry is {t turn, r role, x text}
// plus the marks bk bookkeeping / rf refusal / rc retconned / den denouement, printed as flags).
// --raw prints the sessionLog instead — the raw GM text with its tags intact — for the same window
// when the entries carry a turn number, else all of it. Read-only; the save is never written.
//
// Usage: node dev/dump-transcript.js <save.tnd> [a-b] [--raw]
var fs=require("fs");
var NL=String.fromCharCode(10);
var args=process.argv.slice(2),save=null,win=null,raw=false;
for(var i=0;i<args.length;i++){if(args[i]==="--raw")raw=true;else if(!save)save=args[i];else if(!win)win=args[i];}
if(!save){console.error("usage: node dev/dump-transcript.js <save.tnd> [a-b] [--raw]");process.exit(2);}
var data=JSON.parse(fs.readFileSync(save,"utf8")),ws=data.worldState||{};
var a=0,b=Infinity;
if(win){var p=String(win).split("-");a=parseInt(p[0],10);b=parseInt(p[1],10);if(!(a>=0&&b>=a)){console.error("window wants a-b, e.g. 77-89");process.exit(2);}}
console.log("# "+(ws.campName||"?")+" — "+((ws.character&&ws.character.name)||"?")+" — turn "+(ws.turn||0)+(win?" — window "+a+"-"+b:"")+(raw?" — RAW sessionLog":""));
var n=0;
if(raw){
  (data.sessionLog||[]).forEach(function(e){
    if(!e)return;var t=typeof e.t==="number"?e.t:null;if(t!==null&&(t<a||t>b))return;n++;
    console.log(NL+"["+(t===null?"t?":"t"+t)+" "+String(e.role||"?").toUpperCase()+"]"+NL+String(e.content||""));
  });
}else{
  (ws.transcript||[]).forEach(function(e){
    if(!e||typeof e.t!=="number"||e.t<a||e.t>b)return;n++;
    var f=[];if(e.bk)f.push("bookkeeping");if(e.rf)f.push("refusal");if(e.rc)f.push("retconned");if(e.den)f.push("denouement");
    var who=e.r==="gm"?"GM":e.r==="player"?"PLAYER":String(e.r||"?").toUpperCase();
    console.log(NL+"t"+e.t+" "+who+(f.length?" ["+f.join(", ")+"]":"")+":"+NL+String(e.x||""));
  });
}
console.log(NL+"# "+n+" entries");
