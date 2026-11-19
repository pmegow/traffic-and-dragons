var LE=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();LE.makeTestWorld();
global.showToast=function(m){};global.addMsg=function(){return {appendChild:function(){},style:{},remove:function(){}}};
global.syncUI=function(){};global.saveAll=function(){};global.saveCore=function(){};global.saveMem=function(){};
function tryIt(label,f){try{var r=f();console.log(label,"OK",typeof r==="string"?r.length+" chars":typeof r);}catch(e){console.log(label,"THROWS:",e.message);}}
// A save whose condition list carries one null entry (hand-edited file, or a writer bug).
worldState.character.conditions=[{name:"Poisoned",turn:1},null];
// Does the load door heal it?
tryIt("migrateWorldState",function(){return migrateWorldState();});
console.log("after load, conditions =",JSON.stringify(worldState.character.conditions));
tryIt("buildSysPrompt",function(){return buildSysPrompt().volatile;});
tryIt("buildEngineNotes",function(){worldState.turn=200;return buildEngineNotes();});
tryIt("snapshotNoteLatches",function(){return JSON.stringify(snapshotNoteLatches());});
// A string entry (another malformed shape):
worldState.character.conditions=["Poisoned"];
tryIt("buildSysPrompt (string entry)",function(){var v=buildSysPrompt().volatile;var i=v.indexOf("Conditions:");return v.slice(i,i+60);});
tryIt("buildEngineNotes (string entry)",function(){return buildEngineNotes();});
