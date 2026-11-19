// Probe: blueprint-designer.html applyPatches() with model-authored section names that are Object.prototype members.
var fs=require("fs"),vm=require("vm");
var src=fs.readFileSync("C:/Projects/traffic-and-dragons/blueprint-designer.html","utf8");
var a=src.indexOf("var _PATCH_PRESERVE="),b=src.indexOf("async function applyFinding(");
var code=src.slice(a,b);
var ctx={DesignerCreatures:require("C:/Projects/traffic-and-dragons/designer-creatures.js"),DesignerActs:require("C:/Projects/traffic-and-dragons/designer-acts.js"),console:console,JSON:JSON,String:String,Array:Array,Error:Error};
vm.createContext(ctx);vm.runInContext(code,ctx);
function bp(){return {name:"B",acts:[{title:"A1",arcs:[{title:"r"}]}],npcs:[],locations:[],creatures:[],rules:[]};}
[["__proto__ npc-style",[{section:"__proto__",name:"Ghost",item:{name:"Ghost"}}]],
 ["constructor",[{section:"constructor",name:"Ghost",item:{name:"Ghost"}}]],
 ["toString top-level",[{section:"toString",item:"x"}]]].forEach(function(c){
  var x=bp();
  try{var r=ctx.applyPatches(x,c[1],{});console.log(c[0],"labels:",JSON.stringify(r.labels),"| JSON out keys:",Object.keys(JSON.parse(JSON.stringify(x))).join(","),"| proto is array:",Array.isArray(Object.getPrototypeOf(x)));
    try{String(x);}catch(e){console.log("   String(bp) now throws:",e.message);}}
  catch(e){console.log(c[0],"THROWS",e.message);}
});
