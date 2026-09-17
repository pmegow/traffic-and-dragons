// sabotage-415-exit.js — mutation proof for the #415 narrated door ([EXIT:] tag).
//
// The guard (review audits/REVIEW_415_exit_tag.md): a door files write-once on the current node and is refused loud
// where a floor plan is on record, where the name is already a sibling place, and past the owner's cap of five;
// the resolver removes a door on a sibling name match or when the PLAYER's own action named the door and a new
// sibling place was minted this parse — a new place the player did not walk through leaves the door listed.
// Each clause must make dev/run-tests.js FAIL on the #415 section; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-415-exit.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js", "#415"]],
  cases: [
    { label: "the cap of five is lifted — a chatty GM grows a node forever (the monotonic-resources class)",
      mustFail: "sixth",
      find: 'var EXIT_CAP=5;',
      replace: 'var EXIT_CAP=50;' },
    { label: "a floor plan no longer refuses a door — the plan and the exit list contradict each other",
      mustFail: "planned place accepted",
      find: '  if(node.layout)return {ok:false,reason:"this place has a floor plan on record; the plan is its door record",key:key};\n',
      replace: '' },
    { label: "a known sibling place is accepted as a door — it files, the name resolver removes it in the same parse, the log records a filing and a resolution that never happened and the GM is never told",
      mustFail: "sibling refusal must be loud",
      find: '  for(i=0;i<sibs.length;i++)if(exitNameKey(sibs[i])===nk)return {ok:false,reason:"\'"+sibs[i]+"\' is already a place on record here — it is a way already",key:key};\n',
      replace: '' },
    { label: "the resolver stops requiring the player's own action — any new room resolves every door on the node",
      mustFail: "did not walk through",
      find: 'if(!hit&&created.length&&said.indexOf(" "+nk+" ")>=0){',
      replace: 'if(!hit&&created.length){' }
  ]
});

process.exit(rc);
