// F2: does the deferred DEATH ARRIVES send get dropped when a post-commit settle awaits a macrotask?
var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
function el(){return {value:"",disabled:false,style:{},remove:function(){},appendChild:function(){},insertAdjacentHTML:function(){},querySelectorAll:function(){return [];},setAttribute:function(){},parentNode:null,focus:function(){},classList:{add:function(){},remove:function(){}}};}
global.document={hidden:false,getElementById:function(){return el();},querySelector:function(){return null;},querySelectorAll:function(){return [];},createElement:function(){return el();},body:el()};
addMsg=function(){return el();};showToast=function(){};syncUI=function(){};saveAll=function(){};saveCore=function(){};saveMem=function(){};saveLocal=function(){};
if(typeof showRollModal!=="undefined")showRollModal=function(){};
generateActions=async function(){};speakNarration=function(){};
async function run(settleMs){
  L.makeTestWorld();busy=false;
  worldState.character.hp=0;worldState.downed={turn:worldState.turn};
  takeCheckpoint("test camp");
  var sends=[];
  callGM=async function(msg){sends.push(String(msg).slice(0,40));
    if(sends.length===1)return "The blade finds you. [DOWNED_RESOLVED:dead|a blade]";
    return "Death arrives, quiet and tall.";};
  atlasDirectionsSettle=async function(){if(settleMs)await new Promise(function(r){setTimeout(r,settleMs);});return null;};
  atlasGroundSettle=async function(){return null;};itemKindsSettle=async function(){return null;};
  await sendAction("I fight on.",{silent:false,mpBypass:true});
  await new Promise(function(r){setTimeout(r,settleMs+300);});
  return {settleMs:settleMs,modelCalls:sends,stage:worldState.deathScene&&worldState.deathScene.stage,deathPending:!!worldState.deathPending,busy:busy};
}
(async function(){
  console.log("RESULT",JSON.stringify(await run(0)));
  console.log("RESULT",JSON.stringify(await run(100)));
})().catch(function(e){console.log("ERR",e&&e.stack);});
