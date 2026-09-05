// sabotage-deep-time.js — prove the #227 age-ladder guards are not decorative.
// #227: the antiquity ratchet (field 2026-08-23) — the GM signalled that each new scene mattered
// by making it OLDER than the last, forever, in narration AND in dialogue. Age is the one dial in
// the fiction with no stop on it. The remedy has two halves, and BOTH are load-bearing: a closed
// enum of named world ages (the ladder, cached stable half) and an ungated prose clause in STYLE
// (which is what catches the reported failure, since a dialogue boast claims no rung at all).
// Each mutation below removes exactly one clause; the matching #227 engine test must turn red.
var sabotage=require("./sabotage.js"),rc=0;
var ALSO=["api.js","helpers.js","game.js","globals.js","campaign_generator.js","blueprint-designer.html"];/* the designer is NOT an engine-manifest file, so its working copy must be named explicitly or the clone runs the BLUEPRINT DESIGNER CONTRACT against the committed page and every clause misattributes on that red */
var CMD=["node",["dev/run-tests.js","#227"]];

rc|=sabotage.prove({file:"api.js",command:CMD,also:ALSO,cases:[
  {label:"ladder moved out of the CACHED stable half — every turn re-pays for campaign-constant text",
    mustFail:"deep-time ladder rides the STABLE half",
   find:"    +buildDeepTimeBlock()/* #227:",
   replace:"    +\"\";/* #227 sabotaged: */ /*"},
  {label:"the ceiling sentence deleted — the ladder becomes a list with no stated top",
    mustFail:"deep-time ladder rides the STABLE half",
   find:"  lines.push(\"NOTHING IN THIS WORLD PREDATES \"+ceiling+\".",
   replace:"  if(0)lines.push(\"NOTHING IN THIS WORLD PREDATES \"+ceiling+\"."},
  {label:"the replacement escalation dial removed — the free dial is taken away with nothing offered",
    mustFail:"deep-time ladder rides the STABLE half",
   find:"Escalate with proximity and consequence instead:",
   replace:"Escalate however you like:"},
  {label:"block no longer \"\"-clean — every legacy save's cached prompt changes",
    mustFail:"buildDeepTimeBlock: ",
   find:"  if(!d.length)return \"\";",
   replace:"  if(!d.length)d=[{name:\"the Elder Dark\",when:\"\",note:\"\"}];"},
  {label:"STYLE anti-comparative clause deleted — the reported dialogue failure goes uncaught",
    mustFail:"STYLE carries the anti-comparative-age clause UNGATED",
   find:"NEVER use comparative age as a flourish:",
   replace:"Mind the register:"},
  {label:"STYLE clause stops binding dialogue — only narration is covered",
    mustFail:"STYLE carries the anti-comparative-age clause UNGATED",
   find:"no character boasting of having waited",
   replace:"no scene opening with a claim of having waited"}
]});

rc|=sabotage.prove({file:"helpers.js",command:CMD,also:ALSO,cases:[
  {label:"rung cap dropped — a 20-rung ladder bloats the cached half and stops being a ladder",
    mustFail:"normalizeDeepTime: coerces, trims",
   find:"  for(i=0;i<raw.length&&out.length<DEEP_TIME_RUNGS_CAP;i++){",
   replace:"  for(i=0;i<raw.length;i++){"},
  {label:"nameless rungs admitted — a rung nothing can be placed on",
    mustFail:"normalizeDeepTime: coerces, trims",
   find:"    if(!nm)continue; // a nameless rung cannot be pointed at, so it cannot be a rung",
   replace:"    if(!nm)nm=\"an age\";"},
  {label:"field-length caps dropped — semi-trusted blueprint text lands unbounded in the cached prompt",
    mustFail:"normalizeDeepTime: coerces, trims",
   find:"    out.push({name:nm.slice(0,DEEP_TIME_NAME_MAX),",
   replace:"    out.push({name:nm,"}
]});

rc|=sabotage.prove({file:"game.js",command:CMD,also:ALSO,cases:[
  {label:"empty ladder kept as a husk — every saved blueprint grows a meaningless deepTime:[]",
    mustFail:"normalizeBlueprint: a deepTime ladder survives import",
   find:"    if(_dtn.length)bp.deepTime=_dtn;else delete bp.deepTime;",
   replace:"    bp.deepTime=_dtn;"},
  {label:"blueprint ladder never reaches worldState — the authored ceiling is silently inert",
    mustFail:"applyBlueprint: an authored ladder actually REACHES worldState",
   find:"  if(bp.deepTime&&bp.deepTime.length)worldState.deepTime=normalizeDeepTime(bp.deepTime);",
   replace:""}
]});

rc|=sabotage.prove({file:"campaign_generator.js",command:CMD,also:ALSO,cases:[
  {label:"auto-applied reviewer no longer knows deepTime is legal — it files a fix that strips the ladder",
    mustFail:"generator: BOTH consumers ask for a deepTime ladder",
   find:", plus an optional deepTime age ladder (name/when/note rungs, oldest first). ",
   replace:" "},
  {label:"generator stops forbidding unfalsifiable rungs — 'the time before time' becomes a legal age",
    mustFail:"generator: BOTH consumers ask for a deepTime ladder",
   find:"the time before time",
   replace:"for instance"}
]});

process.exit(rc);
