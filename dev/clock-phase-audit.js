// clock-phase-audit.js — #158: READ-ONLY precision audit of the phase-mismatch detector over a
// real save's clock-stamped GM transcript. THE ENABLE GATE: the detector ships only after a
// hand review of every alert this prints (a noisy detector teaches everyone to ignore it).
// For each GM entry carrying a ck stamp (clock.min at log time), the SHIPPED recognizer runs on
// the entry's clean prose against that historical clock — exactly what commitGmTurn would have
// done live. Modifies nothing.
//
// Usage:  node dev/clock-phase-audit.js <save.tnd>

addMsg=function(){};escHtml=function(s){return s;};showToast=function(){};updateCombat=function(){};syncUI=function(){};
var eng=require("./load-engine.js");
eng.loadEngine("game.js");
var fs=require("fs");
var save=process.argv[2];
if(!save){console.log("usage: node dev/clock-phase-audit.js <save.tnd>");process.exit(2);}
var d=JSON.parse(fs.readFileSync(save,"utf8"));
worldState=d.worldState;memory=d.memory;sessionLog=[];

var tr=worldState.transcript||[],stamped=0,asserted=0,alerts=[],i;
var savedMin=worldState.clock&&worldState.clock.min;
for(i=0;i<tr.length;i++){
  var e=tr[i];
  if(e.r!=="gm"||e.ck==null)continue;
  stamped++;
  worldState.clock.min=e.ck;
  var a=clockPhaseAssertion(e.x);
  if(!a)continue;
  asserted++;
  var dist=clockPhaseBandDist(a.idx);
  if(dist>=PHASE_MISMATCH_MIN){
    var at=Math.max(0,a.at-60),ctx=String(e.x).slice(at,a.at+80).replace(/\s+/g," ");
    alerts.push({t:e.t,label:a.label,clock:(typeof clockStamp==="function"?clockStamp():e.ck),offH:Math.round(dist/60),ctx:"…"+ctx+"…"});
  }
}
if(worldState.clock)worldState.clock.min=savedMin;
console.log("PHASE-DETECTOR PRECISION AUDIT — "+save);
console.log("clock-stamped GM turns: "+stamped+" | phase assertions recognized: "+asserted+" | alerts (>= "+PHASE_MISMATCH_MIN+"m off-band): "+alerts.length);
alerts.forEach(function(al){
  console.log("\n  t"+al.t+"  asserts '"+al.label+"'  vs clock "+al.clock+"  ("+al.offH+"h off-band)");
  console.log("    "+al.ctx);
});
console.log("\n// hand-review each alert: TRUE drift (keep) vs semantic false alarm (tighten). The");
console.log("// reviewer's rough literal scan produced 10 alerts on this corpus — the shipped");
console.log("// recognizer must keep the true class and drop the figurative/planned/historical.");
