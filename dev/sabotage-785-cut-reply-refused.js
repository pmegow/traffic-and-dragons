// sabotage-785-cut-reply-refused.js - prove the #785 guards are not decorative.
// #785 (field 2026-11-25, owner ruling "refuse, offer Retry"): a reply cut before its story text is refused
// before the commit instead of landing as a silent bookkeeping turn. Each mutation removes one load-bearing
// clause; the named engine test must turn red, and sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-785-cut-reply-refused.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#785 a reply cut before its story text is refused"]];
var PURE="#785 replyCutBeforeProse: tags and no prose under a cut finish is a cut reply";
var THROW="#785 refuseCutReply throws before anything is applied";
var WIRED="#785 the story turn and the opening refuse a cut reply BEFORE the commit";

rc|=sabotage.prove({file:"game.js",command:CMD,cases:[
  {label:"#785 a COMPLETE tags-only reply is refused - every bookkeeping answer to an engine note becomes a failed turn",find:"if(!fin||!fin.cut||!String(resp||\"\").trim())return false;",replace:"if(!String(resp||\"\").trim())return false;",mustFail:PURE},
  {label:"#785 a reply showing a dice card is refused",find:"return !String(cleanTxt(resp)||\"\").trim()&&!String(diceTxt(resp)||\"\").trim();",replace:"return !String(cleanTxt(resp)||\"\").trim();",mustFail:PURE},
  {label:"#785 a reply cut mid-prose is refused - story text the player could have read is thrown away",find:"return !String(cleanTxt(resp)||\"\").trim()&&!String(diceTxt(resp)||\"\").trim();",replace:"return !String(diceTxt(resp)||\"\").trim();",mustFail:PURE},
  {label:"#785 the refusal no longer throws - the cut reply commits in silence again",find:"e.cutReply=true;throw e;",replace:"e.cutReply=true;",mustFail:THROW},
  {label:"#785 the story turn no longer refuses",find:"    if(!isTT)refuseCutReply(resp,_respFin);",replace:"    ",mustFail:WIRED},
  {label:"#785 an accepted retry keeps the first reply's finish",find:"resp=_rr2;_respFin=gmTurnFinish;",replace:"resp=_rr2;",mustFail:WIRED},
  {label:"#785 the opening no longer refuses",find:"    refuseCutReply(resp,gmTurnFinish);/* #785: an opening",replace:"    /* #785: an opening",mustFail:WIRED}
]});
rc|=sabotage.prove({file:"api.js",command:CMD,cases:[
  {label:"#785 every call kind overwrites the story turn's finish",find:"  if(_kind===\"turn\")gmTurnFinish=_fi;",replace:"  gmTurnFinish=_fi;",mustFail:WIRED},
  {label:"#785 a new story-turn call keeps the last one's verdict",find:"  if(_kind===\"turn\")gmTurnFinish=null;/* #785 */",replace:"  /* #785 */",mustFail:WIRED}
]});
process.exit(rc);
