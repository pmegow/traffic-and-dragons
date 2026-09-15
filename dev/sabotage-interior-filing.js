var sabotage=require("./sabotage.js"),rc=0;
var also=["sw.js","dev/engine-manifest.js"];
var command=["node",["dev/run-tests.js","Known interior filing repair"]];
rc|=sabotage.prove({file:"game.js",also:also,command:command,cases:[
 {label:"known interiors no longer arm an immediate reminder",mustFail:"interior filing catches the owner's",find:'else if(!armKnownInteriorFiling(raw,clean)){',replace:'else{'},
 {label:"other-world interiors are accepted",mustFail:"interior filing rejects quotations",find:'||locResolve(node.parent)!==world',replace:''},
 {label:"already filed interior asks again",mustFail:"interior filing rejects quotations",find:'hit&&locResolve(hit.nodeKey)!==current?hit:null',replace:'hit'},
 {label:"prose moves the party before the GM files a tag",mustFail:"interior filing catches the owner's",find:'delete worldState.locationFilingWatch;return true;',replace:'worldState.world.sublocation=q.place;delete worldState.locationFilingWatch;return true;'}
]});
rc|=sabotage.prove({file:"api.js",also:also,command:command,cases:[
 {label:"reload recovery is disconnected from the note registry",mustFail:"interior filing recovers an existing save",find:'if(typeof prepareInteriorLocationFiling==="function")prepareInteriorLocationFiling();',replace:''}
]});
process.exit(rc);
