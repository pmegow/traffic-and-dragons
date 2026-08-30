// sabotage-277-latch-census.js — mutation proof for TODO #277 item 3 / joint f31.
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/tests-latch-census.js"]];
// The scratch clone otherwise sees committed twins of every new dev-only collaborator.
var ALSO=["dev/sabotage-277-latch-census.js","dev/tests-latch-census.js","dev/run-tests.js","dev/run-standalone-suites.js"];

rc|=sabotage.prove({
  file:"dev/latch-census.js",command:CMD,also:ALSO,cases:[
    {label:"regex literals stop confusing the function-body lexer, so helpers.js remains indexed",
      mustFail:"rewardClaimQueue's helper-routed write is still invisible",
      find:'    if(ch==="/"){',replace:'    if(false){'},
    {label:"a helper call cannot disappear from the transitive NOTE_BUILDERS walk",
      mustFail:"helper-routed fakeLatch is visible",
      find:'    for(j=0;j<fc.length;j++)if(!seen[fc[j]])q.push(fc[j]);',replace:''},
    {label:"a local worldState alias cannot hide a nested latch write",
      mustFail:"alias-routed aliasLatch is visible",
      find:'  while((m=re.exec(body)))map[m[1]]=m[2];',replace:'  while((m=re.exec(body))){}'},
    {label:"an exemption applies only to its ruled writer, never the whole key",
      mustFail:"exemptions are writer-scoped",
      find:'  for(i=0;i<owners.length;i++)if(owners[i]!==ex.owner)return {ok:false,reason:"writer "+owners[i]+" is outside the exemption\'s "+ex.owner+" boundary"};',replace:''},
    {label:"questLog is narrow-restored only while the exact title-keyed pair remains",
      mustFail:"shipped NOTE_BUILDERS reachable writes are declared",
      find:'  if(writes.questLog&&questNestedRestored(api))nested.questLog="questLog[].staleNudged title-keyed snapshot/restore";',replace:''},
    {label:"clockEnsure's exemption cannot survive without the ruled rationale text",
      mustFail:"clockEnsure lazy repair exemption carries",
      find:'  clock:{owner:"clockEnsure",rationale:"invariant-repair — restoring corruption after a failed request would undo a repair, not un-burn a note"}',
      replace:'  clock:{owner:"clockEnsure",rationale:"lazy repair"}'},
    {label:"pendingRewardClaims cannot survive without the ruled rationale text",
      mustFail:"pendingRewardClaims exemption carries",
      find:'  pendingRewardClaims:{owner:"rewardClaimQueue",rationale:"f31: the player-visible shelve decision precedes the request; subject+tokens dedupe prevents a duplicate claim"}',
      replace:'  pendingRewardClaims:{owner:"rewardClaimQueue",rationale:"player decided first"}'}
  ]
});
process.exit(rc?1:0);
