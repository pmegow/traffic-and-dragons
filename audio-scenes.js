// These authored pilot bindings preserve existing saves while general places acquire profiles.
var AUDIO_EXTERIORS = {village:["the square","the animal handler's yard"]};
var AUDIO_SCENES = [
  {id:"smithy",bind:{kind:"village",common:"the smithy"}},
  {id:"alchemist",bind:{kind:"village",common:"the alchemist's"},accents:["alchemist-glass"],entry:"alchemist-entry-bell"},
  {id:"village-morning",bind:{kind:"village",exterior:true,from:300,to:600}},
  {id:"village-day",bind:{kind:"village",exterior:true,from:600,to:1080}},
  {id:"village-dusk-noctina",bind:{kind:"village",exterior:true,from:1080,to:1260}},
  {id:"village-night",bind:{kind:"village",exterior:true,from:1260,to:300}},
  {id:"tavern",bind:{kind:"village",common:"the tavern"},accents:["footsteps-wood"]}   /* people are about: footsteps may cross the floor */
].map(function(seed){
  var asset=AUDIO_CATALOG.assets.filter(function(a){return a.id===seed.id;})[0];
  if(!asset)throw new Error("Missing pilot audio asset: "+seed.id);
  (seed.accents||[]).forEach(function(id){var a=AUDIO_CATALOG.assets.filter(function(x){return x.id===id;})[0];if(!a||a.role!=="accent")throw new Error("Missing pilot accent set: "+id);});
  if(seed.entry){var cue=AUDIO_CATALOG.assets.filter(function(x){return x.id===seed.entry;})[0];if(!cue||cue.role!=="accent"||cue.trigger!=="cued")throw new Error("Missing entry cue: "+seed.entry);}
  return Object.assign({},asset,{bind:seed.bind,accents:seed.accents||[],entry:seed.entry||null});/* #481 E2: every seed is authored — no profilePolicy */
});
