// sabotage-drift-hardening.js — prove the W4/W5 drift-boundary guards are not decorative.
// Each mutation removes one load-bearing clause; the exact hostile fixture in engine-tests must
// turn red, and sabotage.js restores byte-identical source after every case.
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({file:"game.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"commit hook removed — missing-axis observers never see real turns",
   find:"  if(!o.isOpening&&typeof observeDriftAxes===\"function\")observeDriftAxes(resp,clean);",replace:""},
  {label:"reference rejection narrowed — 'toward Jorgenfist' arms location filing",
   find:"toward|towards|remembering|recalling",replace:"remembering|recalling"},
  {label:"location tag identity loosened — LOCATION_DESC falsely suppresses the filing watch",
   find:"var hasLoc=/\\[(?:LOCATION|SUBLOCATION):[^\\]]+\\]|\\[SUBLOCATION_LEAVE\\]/i.test(raw),cue;",
   replace:"var hasLoc=/\\[(?:LOCATION|SUBLOCATION)/i.test(raw),cue;"}
]});

rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"strict duration promotion disabled — five days falls back to turn ageing",
   find:"if(strict>0&&typeof scheduleAdd===\"function\"){",replace:"if(false&&typeof scheduleAdd===\"function\"){"},
  {label:"outcome gate removed — merely discussing a future event marks it complete",
   find:"FUTURE_OUTCOME_RE.test(s)&&futureResolveOverlap(s,f.what)",replace:"futureResolveOverlap(s,f.what)"}
]});

rc|=sabotage.prove({file:"identity.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"child match removed — LOCATION mints a world twin of a known sublocation",
   find:"if(locSame(k,target)||locDisplayLeaf(k).toLowerCase()===leaf)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};",
   replace:"if(false)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};"}
]});

rc|=sabotage.prove({file:"tag_table.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"duplicate acquisition receipt removed — the second satchel is silent",
   find:"duplicateItemGrantWarning(worldState.character.inventory,igq.base,igCounts[itemBaseName(igq.base)],null,R,text);",replace:""},
  {label:"death-retraction memory cleanup removed - the repaired NPC still injects deceased",
   find:"if(drDeathAttitude)drMemory.attitude=\"\";",replace:""},
  {label:"completion node gate removed - an old receipt drags a progressed living NPC backward",
   find:"drCompletionReplay=!drRecordedDead&&drPrior&&drAtTarget",replace:"drCompletionReplay=!drRecordedDead&&drPrior"},
  {label:"completion residue gate removed - a clean replay grows the archive forever",
   find:"&&drAtTarget&&drNeedsCleanup",replace:"&&drAtTarget"}
]});

rc|=sabotage.prove({file:"api.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"persistent consumable record not stored — an ignored check cannot re-fire",
   find:"p.push(c);worldState.consumablePending=p;",replace:"p.push(c);"},
  {label:"clock shortfall replaced by the original price — partial elapsed time is double-billed",
   find:"[TIME_ADVANCE:\"+q.shortfall+\"m]",replace:"[TIME_ADVANCE:\"+(q.shortfall+q.elapsed)+\"m]"}
]});

process.exit(rc?1:0);
