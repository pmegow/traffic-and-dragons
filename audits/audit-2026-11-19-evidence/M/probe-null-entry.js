// Probe: a .blueprint whose acts/npcs array holds null — what do normalize/validate/baseline/textFields do?
var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
function tryit(label,f){try{console.log(label,"->",JSON.stringify(f()));}catch(e){console.log(label,"THROWS",e.message);}}
[["acts:[null]",{format:"tnd-blueprint-v1",name:"x",premise:"p",acts:[null]}],
 ["npcs:[null]",{format:"tnd-blueprint-v1",name:"x",premise:"p",acts:[{title:"a",goal:"g",arcs:[{title:"t",objective:"o"}]}],npcs:[null]}],
 ["review.findings:[null]",{format:"tnd-blueprint-v1",name:"x",premise:"p",acts:[{title:"a",goal:"g",arcs:[{title:"t",objective:"o"}]}],review:{findings:[null]}}]
].forEach(function(c){
  var bp;
  tryit(c[0]+" normalize",function(){bp=normalizeBlueprint(JSON.parse(JSON.stringify(c[1])),{preserveProse:true});return "ok";});
  if(!bp)return;
  tryit(c[0]+" baseline",function(){return !!BlueprintEdition.baseline(bp);});
  tryit(c[0]+" validate",function(){return validateBlueprint(bp);});
  tryit(c[0]+" textFields",function(){return blueprintTextFields(bp).length;});
});
