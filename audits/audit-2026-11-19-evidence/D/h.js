// shared harness for lane D probes
var LE=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
var _warn=console.warn,_info=console.info,_dbg=console.debug,_err=console.error,_log=console.log;
global.__W=[];
console.warn=function(){__W.push(Array.prototype.join.call(arguments," "));};
console.info=function(){};console.debug=function(){};
LE.loadEngine();
global.__T=[];
addMsg=function(){return {appendChild:function(){},style:{},remove:function(){},textContent:"",innerHTML:"",className:""};};
showToast=function(m){__T.push(String(m));};
syncUI=function(){};updateAbPanel=function(){};updateSpPanel=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};
function fresh(o){var ws=LE.makeTestWorld(o||{});if(typeof migrateWorldState==="function"){try{migrateWorldState(ws);}catch(e){_log("migrate threw",e.message);}}worldState=ws;__W.length=0;__T.length=0;return ws;}
function run(t){__W.length=0;__T.length=0;var R=applyMuts(t,{});return {muts:R.muts,errors:R.errors,warns:__W.slice(),toasts:__T.slice(),clean:cleanTxt(t)};}
module.exports={fresh:fresh,run:run,log:_log};
