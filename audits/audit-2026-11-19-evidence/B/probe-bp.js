var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');L.loadEngine();
showToast=function(m){console.log("TOAST",m);};saveRules=function(){};
function base(){return {format:"tnd-blueprint-v1",version:"0.01",releaseStatus:"draft",name:"T",premise:"p",acts:[{title:"A",goal:"g",arcs:[{title:"x",objective:"o"}]}]};}
function tryit(label,mut){
  L.makeTestWorld();var bp=base();mut(bp);
  var v;try{normalizeBlueprint(bp);v=validateBlueprint(bp);}catch(e){v="VALIDATE THREW: "+e.message;}
  var a="(not applied)";if(v===null){try{var n0=worldState.npcs.length;applyBlueprint(bp);a="applied; roster +"+(worldState.npcs.length-n0)+" "+JSON.stringify(worldState.npcs.slice(n0).map(function(n){return n.name;}));}catch(e){a="APPLY THREW: "+e.message;}}
  console.log("CASE",label,"| validate:",JSON.stringify(v),"|",a);
}
tryit("npc with no name",function(bp){bp.npcs=[{notes:"a nameless dossier"},{name:"",notes:"blank"}];});
tryit("npc named __proto__",function(bp){bp.npcs=[{name:"__proto__",notes:"x"}];});
tryit("duplicate npc",function(bp){bp.npcs=[{name:"Bram",notes:"one"},{name:"Bram",notes:"two"}];});
tryit("npc name with pipe",function(bp){bp.npcs=[{name:"Bram|Kitchen",notes:"x"}];});
tryit("null location",function(bp){bp.locations=[null];});
tryit("location no name",function(bp){bp.locations=[{description:"d"}];});
tryit("null act",function(bp){bp.acts=[null];});
tryit("null arc",function(bp){bp.acts=[{title:"A",goal:"g",arcs:[null]}];});
tryit("null npc",function(bp){bp.npcs=[null];});
tryit("rule object",function(bp){bp.rules=[{x:1}];});
console.log("memory.npcs proto:",Object.getPrototypeOf(memory.npcs)===null?"null-proto":"Object");
