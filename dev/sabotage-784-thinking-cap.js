// sabotage-784-thinking-cap.js - prove the #784 guards are not decorative.
// #784 (field 2026-11-25): thought tokens are spent from maxOutputTokens. At thinking level high a story
// turn spent its 6,000-token cap on thinking and was cut after its tags; the story text never came. A turn
// sent at medium or high now gets a larger cap. Each mutation removes one load-bearing clause; the named
// engine test must turn red, and sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-784-thinking-cap.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","prompt caching split"]];
var MUST="#784 gemini thinking: a turn at medium or high gets a larger output cap";

rc|=sabotage.prove({file:"globals.js",command:CMD,cases:[
  {label:"#784 high gets no more room than low",find:"thinkingTokScale:{medium:2,high:4},",replace:"thinkingTokScale:{medium:2,high:1},",mustFail:MUST},
  {label:"#784 medium gets no more room than low",find:"thinkingTokScale:{medium:2,high:4},",replace:"thinkingTokScale:{medium:1,high:4},",mustFail:MUST},
  {label:"#784 the high cap passes the model's output limit",find:"thinkingTokScale:{medium:2,high:4},",replace:"thinkingTokScale:{medium:2,high:12},",mustFail:MUST},
  {label:"#784 the scale ignores the call kind - every small ask gets the large cap",find:"function thinkingTokScaleFor(prov,kind){var l=thinkingLevelFor(prov,kind),",replace:"function thinkingTokScaleFor(prov,kind){var l=thinkingLevelFor(prov,\"turn\"),",mustFail:MUST}
]});
rc|=sabotage.prove({file:"api.js",command:CMD,cases:[
  {label:"#784 callGM never scales the cap",find:"  if(_tok!=null)_tok=Math.round(_tok*thinkingTokScaleFor(prov,_kind));",replace:"  ",mustFail:MUST}
]});
process.exit(rc);
