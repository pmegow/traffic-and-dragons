// sabotage-drift-hardening.js — prove the W4/W5 drift-boundary guards are not decorative.
// Each mutation removes one load-bearing clause; the exact hostile fixture in engine-tests must
// turn red, and sabotage.js restores byte-identical source after every case.
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({file:"game.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"commit hook removed — missing-axis observers never see real turns",
    mustFail:"W4 wiring: committed GM turns arm the observer and the shared engine-n",
   find:"  if(!o.isOpening&&typeof observeDriftAxes===\"function\")observeDriftAxes(resp,clean);",replace:""},
  {label:"reference rejection narrowed — 'toward Jorgenfist' arms location filing",
    mustFail:"W4 location filing: exact Jorgenfist entry survives eight untagged tur",
   find:"toward|towards|remembering|recalling",replace:"remembering|recalling"},
  {label:"location tag identity loosened — LOCATION_DESC falsely suppresses the filing watch",
    mustFail:"W4 location filing: exact Jorgenfist entry survives eight untagged tur",
   find:"var hasLoc=/\\[(?:LOCATION|SUBLOCATION):[^\\]]+\\]|\\[SUBLOCATION_LEAVE\\]/i.test(raw),cue;",
   replace:"var hasLoc=/\\[(?:LOCATION|SUBLOCATION)/i.test(raw),cue;"}
]});

rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"strict duration promotion disabled — five days falls back to turn ageing",
    mustFail:"W4 clock-aware future events promote strict durations, including legac",
   find:"if(strict>0&&typeof scheduleAdd===\"function\"){",replace:"if(false&&typeof scheduleAdd===\"function\"){"},
  {label:"outcome gate removed — merely discussing a future event marks it complete",
    mustFail:"W4 future-event resolve assist requires both token overlap and an outc",
   find:"FUTURE_OUTCOME_RE.test(s)&&futureResolveOverlap(s,f.what)",replace:"futureResolveOverlap(s,f.what)"}
]});

rc|=sabotage.prove({file:"identity.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"child match removed — LOCATION mints a world twin of a known sublocation",
    mustFail:"W5 world/sub-location twin is refused loudly without minting a node or",
   find:"if(locSame(k,target)||locDisplayLeaf(k).toLowerCase()===leaf)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};",
   replace:"if(false)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};"}
]});

rc|=sabotage.prove({file:"tag_table.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"duplicate acquisition receipt removed — the second satchel is silent",
    mustFail:"W5 duplicate grants warn without blocking, but repeated tags still exp",
   find:"duplicateItemGrantWarning(worldState.character.inventory,igq.base,igCounts[itemBaseName(igq.base)],null,R,text);",replace:""},
  {label:"death-retraction memory cleanup removed - the repaired NPC still injects deceased",
    mustFail:"owner ruling: NPC_DEATH_RETRACTED heals only an existing dead NPC at a",
   find:"if(drDeathAttitude)drMemory.attitude=\"\";",replace:""},
  {label:"completion node gate removed - an old receipt drags a progressed living NPC backward",
    mustFail:"owner repair completion replay requires its prior receipt and the unch",
   find:"drCompletionReplay=!drRecordedDead&&drPrior&&drAtTarget",replace:"drCompletionReplay=!drRecordedDead&&drPrior"},
  {label:"completion residue gate removed - a clean replay grows the archive forever",
    mustFail:"owner repair completion replay requires its prior receipt and the unch",
   find:"&&drAtTarget&&drNeedsCleanup",replace:"&&drAtTarget"}
]});

rc|=sabotage.prove({file:"api.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"persistent consumable record not stored — an ignored check cannot re-fire",
    mustFail:"W5 consumable checks re-fire boundedly without a fresh mention and res",
   find:"p.push(c);worldState.consumablePending=p;",replace:"p.push(c);"},
  {label:"clock shortfall replaced by the original price — partial elapsed time is double-billed",
    mustFail:"W4 travel pricing asks only for the clock shortfall; an honest two-day",
   find:"[TIME_ADVANCE:\"+q.shortfall+\"m]",replace:"[TIME_ADVANCE:\"+(q.shortfall+q.elapsed)+\"m]"}
]});

/* #187④a: the turn-addressed [RETCON:what|turn] extension. */
rc|=sabotage.prove({file:"state.js",command:["node",["dev/run-tests.js","RAG episodic"]],cases:[
  {label:"turn-addressing silently degrades to adjacency — late corrections eat the wrong turns again (#187④a)",
    mustFail:"#187④a: turn-addressed [RETCON:what|turn] marks the NAMED turn",
   find:"if(_rpTm){",replace:"if(false){"}
]});

/* #188: the bigram qualification lane (the wine-cellar confabulation fix). */
rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js","RAG episodic"]],cases:[
  {label:"the bigram qualification lane dies — directed memory questions go blind again (#188)",
    mustFail:"#188: a rare input PHRASE qualifies and serves its scene",
   find:"}else if(blex>=RAG_BIGRAM_QUALIFY){sc=blex;}",replace:"}else if(false){sc=blex;}"},
  {label:"the bigram df ceiling dies — common phrases lift unrelated scenes again (#188)",
    mustFail:"#188: a phrase carried by more than 1% of entries identifies nothing",
   find:"if(elig[i].bhits[j]&&bdf[j]<=bMaxDf)",replace:"if(elig[i].bhits[j])"}
]});

process.exit(rc?1:0);
