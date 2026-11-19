var H=require('./h.js'),log=H.log,r;
function show(lbl,o){log("=== "+lbl);log(JSON.stringify(o,null,1).slice(0,1600));}
// parseDuration
log(JSON.stringify(["1.5h","0.5h","2.5d","3 weeks","1w","10 months","half an hour","1h30","90"].map(function(s){return [s,parseDuration(s),parseStrictFutureDuration(s)];})));
H.fresh();worldState.clock.min=100;r=H.run("[TIME_ADVANCE:1.5h]");show("TA 1.5h",{muts:r.muts,min:worldState.clock.min});
H.fresh();worldState.clock.min=100;r=H.run("[TIME_ADVANCE:2 weeks]");show("TA 2 weeks",{muts:r.muts,warns:r.warns,min:worldState.clock.min});
H.fresh();worldState.clock.min=100;r=H.run("[SCHEDULE:Winter solstice|3 weeks]");show("SCHED 3 weeks",{muts:r.muts,s:worldState.clock.schedule,block:buildClockBlock()});
// two TIME tags + rest at dusk
H.fresh();worldState.clock.min=780;/* dusk */worldState.turn=5;
r=H.run("[TIME_CHECK:dusk][TIME:dusk] You make camp as the light fails. You sleep. [REST:long] [TIME:dawn] You wake to grey light.");
show("two TIME + rest",{muts:r.muts,min:worldState.clock.min,mod:worldState.clock.min%1440,phase:clockPhaseLabelAt(),worldTime:worldState.world.time,skip:worldState.reconcileSkip});
// schedule unbounded / huge duration
H.fresh();worldState.clock.min=0;var big="X".repeat(5000);r=H.run("[SCHEDULE:"+big+"|99999d]");
show("SCHED big",{muts:r.muts.map(function(m){return m.slice(0,80);}),n:worldState.clock.schedule.length,due:worldState.clock.schedule[0]&&worldState.clock.schedule[0].dueMin,blockLen:buildClockBlock().length});
var i;for(i=0;i<300;i++)H.run("[SCHEDULE:Errand number "+i+" alpha"+i+" beta"+i+" gamma"+i+"|"+(100+i)+"d]");
show("SCHED count",{n:worldState.clock.schedule.length,blockLen:buildClockBlock().length});
