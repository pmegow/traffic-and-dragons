var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'ambient.js',command:['node',['dev/run-tests.js','Noctina authored soundtracks']],cases:[
 {label:'saved profiles bypass owner-authored soundtracks',mustFail:'Noctina saved dusk profile selects music and crickets',find:'if (ambientAuthoredProfileMatches(s, scene)) {',replace:'if (false) {'},
 {label:'explicit silence is ignored',mustFail:'Noctina authored choices respect explicit silence',find:'v.profile.quiet === "silent" || ',replace:''},
 {label:'explicit content prohibitions are ignored',mustFail:'Noctina authored choices respect explicit silence',find:'scene.contains.every(function(c) { return p.forbid.indexOf(c) < 0; })',replace:'true'},
 {label:'authored music loses its village/location/time binding (with every seed authored, the morning bed then plays at dusk)',mustFail:'Noctina saved dusk profile selects music and crickets',find:'  if (!ambientSceneMatches(s, scene)) return false;',replace:''}/* #481 E2 re-anchor: the profilePolicy test is gone; the binding check stands alone */
]}));
