var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();L.makeTestWorld();
showToast=function(){};addMsg=function(){return {};};
// a world with 40 world nodes and 30 sub-locations of the current place
var here=worldState.world.location;memory.map=memory.map||{nodes:{},edges:[]};
for(var i=0;i<40;i++)memory.map.nodes["Town Number "+i]=newMapNode(0,null,{visits:1});
for(i=0;i<30;i++)memory.map.nodes[here+"|Hall Of Room "+i]=newMapNode(0,here,{visits:1});
worldState.world.sublocation="Hall Of Room 3";
worldState.character.inventory=["Potion of Healing x3","Blasting charge x4","Flask of oil x2","Torch x5"];
function make(n,unit){var s="";while(s.length<n)s+=unit;return s.slice(0,n);}
var units={
  prose:"You step through the arch into the Hall Of Room 7, and we enter the gloom. \"Hold fast,\" she says. The courier will arrive before dawn with the gold. ",
  noPunct:"you walk on and on through the long grey corridor of stone and dust and silence ",
  caps:"Ash Bright Cold Iron Stone Wind Rain Fog Night Day ",
  quotes:"\"\"\"\" \"a \" b \" "
};
function t(label,fn){var t0=Date.now();var r;try{r=fn();}catch(e){r="THROW "+e.message;}console.log(label,(Date.now()-t0)+"ms",String(JSON.stringify(r)).slice(0,80));}
Object.keys(units).forEach(function(k){
  var clean=make(50000,units[k]),raw="[SAY:Mira]"+clean;
  t(k+" detectLocationFilingCue",function(){return detectLocationFilingCue(clean);});
  t(k+" detectSubLeaveCue",function(){return detectSubLeaveCue(clean);});
  t(k+" detectKnownInteriorArrival",function(){return detectKnownInteriorArrival(clean);});
  t(k+" detectTravelPrice",function(){return detectTravelPrice(clean);});
  t(k+" detectDatedCommitment",function(){return detectDatedCommitment(clean);});
  t(k+" detectGhostConsumables",function(){return detectGhostConsumables("I drink",raw);});
  t(k+" observeDriftAxes",function(){return observeDriftAxes(raw,clean);});
  t(k+" isBookkeepingResponse",function(){return isBookkeepingResponse(raw,"","");});
  if(typeof TTS!=="undefined"&&TTS._textPrep){t(k+" deriveSpeakerMapFromTags",function(){var r=deriveSpeakerMapFromTags(raw,clean);return r&&r.n;});t(k+" sayTagCoverage",function(){return sayTagCoverage(raw,clean);});}
});
console.log("TTS loaded:",typeof TTS!=="undefined"&&!!TTS._textPrep);
