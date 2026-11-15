// dev/sabotage-766-directions.js — proves the #766 guards: what the map is owed, the bounded public request, the
// whole-or-refused answer, the all-or-nothing filing, the backstop's one ask and its loud failure, the GM's author rule,
// and the two call sites. Each clause runs its own test through --only.
//   node dev/sabotage-766-directions.js
var sabotage = require("./sabotage.js");
var P = "FAIL #766 ", CMD = ["node", ["dev/tests-766-directions.js"]];
var T1 = P + "what is owed: the seen features of this place with no bearing; never hearsay, a placed one, the place itself or another place",
  T2 = P + "the request carries public text only, bounded: the place, what is known, what is owed, the action, the narration",
  T3 = P + "the answer is read whole or refused: an unasked id, an id twice, a non-bearing, a stray field, a cut reply",
  T4 = P + "filing places the feature through the core's door, all or nothing, and marks whose decision it was",
  T5 = P + "the backstop asks once, files the answer, saves and tells the player; with nothing owed it asks nothing",
  T6 = P + "a failed, unreadable or stale ask files nothing and says so; the features stay owed",
  T7 = P + "the GM is told it is the author: a seen feature gets a bearing the turn it is declared; hearsay may wait",
  T8 = P + "the backstop runs after the commit on a story turn and on the opening, and the file is loaded where the game loads";
var directions = [
  { label: "hearsay is asked for a direction", find: 'else if(f.mode==="observed"&&owed.length<ATLAS_KNOWLEDGE_OWED_CAP)owed.push(', replace: "else if(owed.length<ATLAS_KNOWLEDGE_OWED_CAP)owed.push(", mustFail: T1 },
  { label: "the ask is not capped", find: 'else if(f.mode==="observed"&&owed.length<ATLAS_KNOWLEDGE_OWED_CAP)owed.push(', replace: 'else if(f.mode==="observed")owed.push(', mustFail: T1 },
  { label: "the place itself is asked for", find: "var shown=atlasKnowledgeShown(k,atlasKnowledgeProjection(k).features),owed=[]", replace: "var shown=atlasKnowledgeProjection(k).features,owed=[]", mustFail: T1 },
  { label: "a campaign without the public map is read anyway", find: "  if(!atlasKnowledgeActive())return null;\n  var k=atlasKnowledgeContext();if(!k)return null;", replace: "  var k=atlasKnowledgeContext();if(!k)return null;", mustFail: T1 },
  { label: "the narration is sent unbounded", find: ".slice(0,ATLAS_DIRECTIONS_NARRATION_MAX)", replace: "", mustFail: T2 },
  { label: "the player's action is sent unbounded", find: ".slice(0,ATLAS_DIRECTIONS_PLAYER_MAX)", replace: "", mustFail: T2 },
  { label: "a direction for a feature nobody asked about is taken", find: "if(!Object.prototype.hasOwnProperty.call(asked,r.id))return refuse(", replace: "if(false)return refuse(", mustFail: T3 },
  { label: "one feature takes two directions", find: "if(Object.prototype.hasOwnProperty.call(seen,r.id))return refuse(", replace: "if(false)return refuse(", mustFail: T3 },
  { label: "\"unknown\" is taken as an answer", find: "if(!Object.prototype.hasOwnProperty.call(ATLAS_KNOWLEDGE_DIRECTIONS,r.bearing))return refuse(", replace: "if(false)return refuse(", mustFail: T3 },
  { label: "a record with a stray field is taken", find: 'if(!atlasExtractionFields(r,["id","bearing"])||typeof r.id!=="string"', replace: 'if(typeof r.id!=="string"', mustFail: T3 },
  { label: "an envelope with a stray field is taken", find: '!atlasExtractionFields(obj,["directions"])||', replace: "", mustFail: T3 },
  { label: "a reply cut short is read", find: 'if(finish&&(finish.cut||finish.cap))return refuse("the directions response ended early");', replace: "", mustFail: T3 },
  { label: "more answers than questions are read", find: 'if(obj.directions.length>owed.length)return refuse("more directions were returned than were asked");', replace: "", mustFail: T3 },
  { label: "hearsay is placed by the map", find: 'if(f.mode!=="observed")return refuse(', replace: "if(false)return refuse(", mustFail: T4 },
  { label: "the receipt does not say whose decision it was", find: "proposalKind:ATLAS_DIRECTIONS_PROVENANCE,", replace: 'proposalKind:"",', mustFail: T4 },
  { label: "the answer is prepared and never installed", find: "    memory.map.geography=s;\n    return {ok:true,placed:placed};", replace: "    return {ok:true,placed:placed};", mustFail: T4 },
  { label: "the placed directions are not saved", find: 'if(typeof saveAll==="function")saveAll();', replace: "", mustFail: T5 },
  { label: "the player is not told", find: 'if(typeof showToast==="function")showToast(atlasDirectionsSaid(filed.placed),6000);', replace: "", mustFail: T5 },
  { label: "the request carries the story's history", find: 'options={noHistory:true,kind:ATLAS_DIRECTIONS_KIND,noRetry:true}', replace: 'options={kind:ATLAS_DIRECTIONS_KIND,noRetry:true}', mustFail: T5 },
  { label: "the request carries the reply's tags", find: "ask=atlasDirectionsAsk(o,cleanTxt(resp),playerTxt);", replace: "ask=atlasDirectionsAsk(o,resp,playerTxt);", mustFail: T5 },
  { label: "a request is made with nothing owed", find: "o=atlasDirectionsOwed();if(!o||!o.owed.length)return null;", replace: "o=atlasDirectionsOwed();if(!o)return null;", mustFail: T5 },
  { label: "an answer for a campaign that moved on is filed", find: "if(!atlasDiscoveryCurrent(context)){", replace: "if(false){", mustFail: T6 },
  { label: "a failed ask says nothing", find: 'atlasKnowledgeSay("directions could not be settled: "', replace: 'String("directions could not be settled: "', mustFail: T6 }
];
var rule = [
  { label: "a seen feature may still be declared without a bearing", find: "A feature the party perceives (observed) lies somewhere: give it a real bearing. ", replace: "", mustFail: T7 },
  { label: "unknown is offered for anything", find: "unknown is only for testimony (reported) whose direction was not told.", replace: "Use unknown when no bearing is established.", mustFail: T7 },
  { label: "a chosen bearing is still called invention", find: "; choosing the bearing of a feature the party sees is authorship, not invention", replace: "", mustFail: T7 },
  { label: "the owed line sets no time", find: "settle it THIS turn, once,", replace: "settle it once,", mustFail: T7 },
  { label: "the owed line makes hearsay due too", find: "; a reported one waits until its direction is told", replace: "", mustFail: T7 }
];
var game = [
  { label: "a story turn never asks", find: '      if(typeof atlasDirectionsSettle==="function")await atlasDirectionsSettle(resp,txt);', replace: "", mustFail: T8 },
  { label: "the opening never asks", find: '    if(typeof atlasDirectionsSettle==="function")await atlasDirectionsSettle(resp,"");', replace: "", mustFail: T8 }
];
var page = [{ label: "the game does not load the file", find: '<script src="atlas-directions.js"></script>', replace: "", mustFail: T8 }];
var shell = [{ label: "the offline shell lacks the file", find: '  "/atlas-directions.js",', replace: "", mustFail: T8 }];
var failed = sabotage.prove({ file: "atlas-directions.js", command: CMD, only: P, cases: directions });
if (!failed) failed = sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: rule });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
if (!failed) failed = sabotage.prove({ file: "sw.js", command: CMD, only: P, cases: shell });
process.exit(failed ? 1 : 0);
