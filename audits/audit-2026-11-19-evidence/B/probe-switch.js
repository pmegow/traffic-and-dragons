var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();L.makeTestWorld();
addMsg=function(){return {appendChild:function(){},style:{},remove:function(){},textContent:"",innerHTML:""};};
var toasts=[];showToast=function(m){toasts.push(m);};syncUI=function(){};saveAll=function(){};saveCore=function(){};saveMem=function(){};
(async function(){
  // ---- 1. refreshSynopsis across a campaign switch ----
  worldState.campId="A";worldState.campName="Campaign A";
  var A=worldState;
  var release;callGM=function(){return new Promise(function(r){release=r;});};
  var p=refreshSynopsis("spine");
  // player loads campaign B while the call is in flight (busy is false: refreshSynopsis never sets it)
  console.log("busy during synopsis call:",busy);
  L.makeTestWorld();worldState.campId="B";worldState.campName="Campaign B";var B=worldState;
  release(JSON.stringify({about:"A's story: the hero of A slew the A-dragon.",now:"In A's tower"}));
  await p;
  console.log("A.synopsis:",A.synopsis&&A.synopsis.about);
  console.log("B.synopsis:",B.synopsis&&B.synopsis.about, "| B===worldState", B===worldState);
  // ---- 2. generateCompanionSheet across a switch: spell canon lands in B ----
  L.makeTestWorld();worldState.campId="C";var C=worldState;
  C.npcs.push({name:"Bram",partyMember:true,sheetPending:true,charSheet:null,status:"ally"});
  memory.npcs=memory.npcs||{};memory.npcs.Bram={attitude:"ally",knowledge:[],events:[]};
  callGM=function(){return new Promise(function(r){release=r;});};
  var p2=generateCompanionSheet("Bram");
  L.makeTestWorld();worldState.campId="D";var D=worldState;
  D.npcs.push({name:"Bram",partyMember:true,sheetPending:true,charSheet:null,status:"ally"});
  release(JSON.stringify({name:"Bram",cls:"Wizard",level:3,gender:"M",stats:{STR:10,DEX:10,CON:10,INT:16,WIS:10,CHA:10},hp:12,maxHp:12,ac:12,spells:[{nm:"Gloomshard Lance",lvl:1,def:{tier:1,effect:"A shard from campaign C"}}],inventory:[]}));
  await p2;
  console.log("C Bram sheet:",!!(C.npcs.filter(function(n){return n.name==="Bram";})[0].charSheet));
  console.log("D Bram sheet:",!!(D.npcs.filter(function(n){return n.name==="Bram";})[0].charSheet), "| D===worldState",D===worldState);
  console.log("toasts:",JSON.stringify(toasts.slice(-3)));
})().catch(function(e){console.log("ERR",e&&e.stack);});
