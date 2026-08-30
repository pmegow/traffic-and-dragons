// sabotage-277-golden-text.js — mutation proof for TODO #277 item 5 / Fable f78.
var sabotage=require("./sabotage.js"),rc=0,CMD=["node",["dev/tests-frozen-golden.js"]];
var ALSO=["dev/sabotage-277-golden-text.js","dev/tests-frozen-golden.js","dev/frozen-golden.js","dev/run-tests.js","dev/run-standalone-suites.js","dev/golden/tag-table-strip.golden","dev/golden/tag-table-doc.golden"];

rc|=sabotage.prove({file:"dev/frozen-golden.js",command:CMD,also:ALSO,cases:[
  {label:"the diagnostic stops naming the committed side of the diff",mustFail:"a mismatch prints a named committed-vs-generated line diff",find:'  --- committed "+rel+',replace:'  --- reference "+rel+'},
  {label:"the diff reports a zero-based line and sends the author to the wrong place",mustFail:"a mismatch prints a named committed-vs-generated line diff",find:'\\n  @@ line "+(line+1)+", char "+(ch+1)+" @@',replace:'\\n  @@ line "+line+", char "+(ch+1)+" @@'},
  {label:"a missing committed golden becomes silent",mustFail:"a missing golden fails loudly with its committed path",find:'FROZEN GOLDEN DIFF UNAVAILABLE',replace:'golden unavailable'}
]});
rc|=sabotage.prove({file:"dev/run-tests.js",command:CMD,also:ALSO,cases:[
  {label:"failed frozen assertions stop invoking the diagnostic",mustFail:"run-tests attaches each frozen failure",find:'else fails.push(label+" — "+r+_frozenFailureDetail(name));',replace:'else fails.push(label+" — "+r);'},
  {label:"the strip hash failure loses its committed golden",mustFail:"run-tests attaches each frozen failure",find:'dev/golden/tag-table-strip.golden',replace:'dev/golden/missing-strip.golden'},
  {label:"the doc hash failure loses its committed golden",mustFail:"run-tests attaches each frozen failure",find:'dev/golden/tag-table-doc.golden',replace:'dev/golden/missing-doc.golden'}
]});
rc|=sabotage.prove({file:"dev/golden/tag-table-strip.golden",command:CMD,also:ALSO,cases:[
  {label:"the committed strip golden cannot drift from the frozen generated text",mustFail:"strip golden matches the text behind the unchanged frozen hash",find:"SCENE_REF|SCENE_NOT",replace:"SCENE_REFX|SCENE_NOT"}
]});
rc|=sabotage.prove({file:"dev/golden/tag-table-doc.golden",command:CMD,also:ALSO,cases:[
  {label:"the committed STATE TAGS golden cannot drift from the frozen generated text",mustFail:"STATE TAGS golden matches the text behind the unchanged frozen hash",find:"STATE TAGS (use in responses",replace:"STATE TUGS (use in responses"}
]});
process.exit(rc?1:0);
