// Probe: map_cleanup.html loadTnd() installs worldState/memory BEFORE migrateWorldState and before MODE is set.
// Which malformed .tnd inputs make migrateWorldState throw (leaving a prior MODE="live" pointed at the file's world)?
var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
var cases=[
  ["worldState undefined",{memory:{}}],
  ["worldState {} memory {}",{worldState:{},memory:{}}],
  ["worldState with npcs:'x'",{worldState:{turn:3,npcs:"x"},memory:{}}],
  ["memory null",{worldState:{turn:3},memory:null}],
  ["character null",{worldState:{turn:3,character:null},memory:{map:{nodes:{},edges:[]}}}]
];
cases.forEach(function(c){
  var data=c[1];
  var vi;try{vi=worldVersionIssue(data&&data.worldState);}catch(e){console.log(c[0],"worldVersionIssue THROWS",e.message);return;}
  if(vi){console.log(c[0],"refused by version gate:",vi);return;}
  worldState=data.worldState;memory=data.memory;sessionLog=data.sessionLog||[];
  try{migrateWorldState();console.log(c[0],"migrate ok; memory.map?",!!(memory&&memory.map));}
  catch(e){console.log(c[0],"migrate THROWS:",e.message);}
});
