var LE=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();LE.makeTestWorld();
global.showToast=function(m){};global.addMsg=function(){return {appendChild:function(){},style:{},remove:function(){}}};
global.syncUI=function(){};global.saveAll=function(){};global.saveCore=function(){};global.saveMem=function(){};
worldState.turn=2000;worldState.world.location="Sandpoint";
memory.map=memory.map||{nodes:{},edges:[]};memory.map.nodes["Sandpoint"]={items:[],firstVisit:1};memory.map.nodes["Magnimar"]={items:[],firstVisit:1};
var base=buildGeoBlock().length;
for(var i=0;i<300;i++){var nm="Villager Number"+i;memory.npcs[nm]={lastSeenAt:"Magnimar",lastSeenTurn:i+1};worldState.npcs.push({name:nm,status:"alive",rel:"neutral"});}
var g=buildGeoBlock();
console.log("geo block chars, 0 NPCs elsewhere:",base,"  300 long-unseen NPCs elsewhere:",g.length);
var sp=buildSysPrompt();
console.log("NPCs roster line folds them:",/\+300 others on record/.test(sp.volatile));
console.log("Elsewhere line names Villager Number5 (seen t6, 1994 turns ago):",/Elsewhere[^\n]*Villager Number5\b/.test(sp.volatile));
// legacy age
worldState.pendingLegacy={name:"Daeris",cls:"Cleric",level:9,age:"67 years",gender:"F",ancestry:"Human",inventory:[],relationships:[]};
var v=buildSysPrompt().volatile,ix=v.indexOf("A figure from another story");
console.log("legacy block line:",JSON.stringify(v.slice(ix,ix+140)));
