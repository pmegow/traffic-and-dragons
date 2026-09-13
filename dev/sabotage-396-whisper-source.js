// dev/sabotage-396-whisper-source.js — proves the whisper source rule is guarded: party members never count,
// a rejoined member does, and no source means no ask.
//   node dev/sabotage-396-whisper-source.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "a companion at the player's side counts as a source again",
      find: 'if(_wn&&!_wn.partyMember&&!_wn.dead&&_wsrc.indexOf(_wn.name)<0)_wsrc.push(_wn.name);', replace: 'if(_wn&&!_wn.dead&&_wsrc.indexOf(_wn.name)<0)_wsrc.push(_wn.name);' },
    { label: "a rejoined member is no longer a source",
      find: 'var _wre=worldState.pendingReunion;if(_wre&&_wre.names instanceof Array', replace: 'var _wre=null;if(_wre&&_wre.names instanceof Array' },
    { label: "no source still asks (the GM picks whoever is handy — the hat thief)",
      find: 'if(!_wsrc.length)return"";\n  var resFacts=[];', replace: '\n  var resFacts=[];' }/* #6 phase B moved the village pool between the source check and the latch; the mutation still deletes the no-source return */
  ]
}));
