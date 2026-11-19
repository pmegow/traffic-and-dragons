var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');L.loadEngine();L.makeTestWorld();showToast=function(){};
var cases=["You step through the doorway into the great hall.","You walk through the old keep and into the long hall beyond.","We pass through the narrow tunnel, torches guttering.","Inside the chamber you find nothing but dust."];
cases.forEach(function(c){console.log(JSON.stringify(c)," -> ",JSON.stringify(detectLocationFilingCue(c)));});
worldState.turn=5;var place=null;for(var k=0;k<8;k++){worldState.turn++;observeDriftAxes("You step through the doorway into the great hall. The fire crackles.","You step through the doorway into the great hall. The fire crackles.");}
console.log("ping:",JSON.stringify(worldState.locationFilingPing),"watch:",JSON.stringify(worldState.locationFilingWatch));
