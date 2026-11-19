var LE=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();LE.makeTestWorld();
var toasts=[];global.showToast=function(m){toasts.push(m);};global.addMsg=function(){return {appendChild:function(){},style:{},remove:function(){}}};
global.syncUI=function(){};global.saveAll=function(){};global.saveCore=function(){};global.saveMem=function(){};
// Simulate a handler that writes half its effect and then throws (stand-in for any latent bug in a handler).
for(var i=0;i<TAG_TABLE.length;i++)if(TAG_TABLE[i].t==="GOLD"){var orig=TAG_TABLE[i].apply;TAG_TABLE[i].apply=function(text,R){orig(text,R);throw new Error("simulated handler bug after write");};}
var R=applyMuts("You are paid. [GOLD:+5] [HP:-2]");
console.log("R.errors:",JSON.stringify(R.errors));
console.log("muts shown to player:",JSON.stringify(R.muts));
console.log("any muts line with the warning glyph:",R.muts.some(function(m){return mutLineWarns(m);}));
console.log("toasts:",JSON.stringify(toasts));
console.log("tagLog last entry:",JSON.stringify(worldState.tagLog[worldState.tagLog.length-1]));
