// dev/sabotage-771-ground.js — proves the #771 ground-ask guards: what a place owes, the bounded public request, the
// whole-or-refused answer, the once-only record, the sheet's order of sources (name, answer, feature), the one ask and
// its loud failure, and the two call sites. Each clause runs its own test through --only.
//   node dev/sabotage-771-ground.js
var sabotage = require("./sabotage.js");
var P = "FAIL #771 ground ", CMD = ["node", ["dev/tests-771-ground.js"]];
var T1 = P + "what is owed: the party's place when its name says no ground and none is on record; never a named ground, an answered place, drawn sheets off or no public map",
  T2 = P + "the request carries public text only, bounded, and its words are the table's: every terrain the library draws, and other",
  T3 = P + "the answer is read whole or refused: a word that is not the map's, a stray field, a cut reply, prose",
  T4 = P + "filing keeps the answer once per place in a registered store and never replaces it",
  T5 = P + "the sheet draws the answered ground; other keeps the pin sheet; the name outranks an answer; a feature speaks only while nothing was answered",
  T6 = P + "the ask runs once after a turn, files the answer, saves and tells the player; an answered place asks nothing",
  T7 = P + "a failed, unreadable or stale ask records nothing and says so; the place stays owed",
  T8 = P + "the ask runs after the commit on a story turn and on the opening, and the file is loaded where the game loads";
var ground = [
  { label: "a place whose name says its ground is asked anyway", find: "if(!place||atlasSheetNameKind(place)||(atlasGroundStored", replace: "if(!place||(atlasGroundStored", mustFail: T1 },
  { label: "an answered place is asked again", find: "atlasSheetNameKind(place)||(atlasGroundStored(A,place.container)&&!atlasGroundStale(A,place.container)))return null;", replace: "atlasSheetNameKind(place))return null;", mustFail: T1 },
  { label: "a campaign with drawn sheets off is asked", find: "if(!A||A.drawn===false||!k)return null;", replace: "if(!A||!k)return null;", mustFail: T1 },
  { label: "a campaign without the public map is read anyway", find: "function atlasGroundOwed(){\n  if(!atlasKnowledgeActive())return null;", replace: "function atlasGroundOwed(){", mustFail: T1 },
  { label: "hearsay is offered as evidence of the ground", find: 'if(shown[i].mode==="observed")seen.push(shown[i].label);', replace: "seen.push(shown[i].label);", mustFail: T1 },
  { label: "what was seen is sent uncapped", find: "i<shown.length&&seen.length<ATLAS_GROUND_SEEN_MAX;i++", replace: "i<shown.length;i++", mustFail: T1 },
  { label: "a place inside another does not say what it lies within", find: "within:parent===null?null:atlasSheetLeaf(parent)", replace: "within:null", mustFail: T1 },
  { label: "the narration is sent unbounded", find: ".slice(0,ATLAS_GROUND_NARRATION_MAX)", replace: "", mustFail: T2 },
  { label: "the player's action is sent unbounded", find: ".slice(0,ATLAS_GROUND_PLAYER_MAX)", replace: "", mustFail: T2 },
  { label: "the prompt does not say what each word means", find: 'return w.ground+" ("+w.says+")";', replace: "return w.ground;", mustFail: T2 },
  { label: "a word the map does not have is taken", find: 'if(!atlasGroundWord(obj.ground))return refuse("the ground is not one of the map\'s words: "', replace: 'if(false)return refuse("the ground is not one of the map\'s words: "', mustFail: T3 },
  { label: "an envelope with a stray field is taken", find: '!atlasExtractionFields(obj,["ground"])||', replace: "", mustFail: T3 },
  { label: "a reply cut short is read", find: 'if(finish&&(finish.cut||finish.cap))return refuse("the ground response ended early");', replace: "", mustFail: T3 },
  { label: "an unbounded reply is parsed", find: 'if(typeof reply!=="string"||reply.length>400)return refuse(', replace: 'if(typeof reply!=="string")return refuse(', mustFail: T3 },
  { label: "a second answer replaces the first", find: "if(atlasGroundStored(A,container)&&!atlasGroundStale(A,container))return refuse(\"the ground of \"", replace: "if(false)return refuse(\"the ground of \"", mustFail: T4 },
  { label: "an unknown word is recorded", find: 'if(!atlasGroundWord(ground))return refuse("the ground is not one of the map\'s words");', replace: "", mustFail: T4 },
  { label: "the record does not say whose answer it was", find: "A.grounds[atlasPublicPlaceKey(container)]={ground:ground,turn:atlasTurn(),by:\"story\",set:ATLAS_GROUND_SET};", replace: "A.grounds[atlasPublicPlaceKey(container)]={ground:ground,turn:atlasTurn(),set:ATLAS_GROUND_SET};", mustFail: T4 },
  { label: "the store is a plain object", find: "A.grounds=keyedDict();", replace: "A.grounds={};", mustFail: T4 },
  { label: "a pin-sheet place is announced as drawn", find: "return ground===ATLAS_GROUND_OTHER||!w?\"\":\"Map: \"", replace: "return !w?\"\":\"Map: \"", mustFail: T4 },
  { label: "the answer is not saved", find: "    if(typeof saveAll===\"function\")saveAll();\n    said=atlasGroundDraws(", replace: "    said=atlasGroundDraws(", mustFail: T6 },
  { label: "the player is not told", find: 'if(said&&typeof showToast==="function")showToast(said,6000);', replace: "", mustFail: T6 },
  { label: "the request carries the story's history", find: "options={noHistory:true,kind:ATLAS_GROUND_KIND,noRetry:true}", replace: "options={kind:ATLAS_GROUND_KIND,noRetry:true}", mustFail: T6 },
  { label: "the request carries the reply's tags", find: "ask=atlasGroundAsk(o,cleanTxt(resp),playerTxt);", replace: "ask=atlasGroundAsk(o,resp,playerTxt);", mustFail: T6 },
  { label: "the request is counted as a turn", find: 'var ATLAS_GROUND_KIND="map-ground";', replace: 'var ATLAS_GROUND_KIND="turn";', mustFail: T6 },
  { label: "an answer for a campaign that moved on is recorded", find: "if(!atlasDiscoveryCurrent(context)){", replace: "if(false){", mustFail: T7 },
  { label: "a failed ask says nothing", find: 'atlasKnowledgeSay("the ground of this place could not be settled: "', replace: 'String("the ground of this place could not be settled: "', mustFail: T7 }
];
var sheet = [
  { label: "the story's answer is not drawn", find: "Object.assign({},place,{ground:atlasGroundStored(A,place.container)})", replace: "Object.assign({},place,{ground:null})", mustFail: T5 },
  { label: "\"other\" is drawn as a ground", find: "if(!word||place.ground===ATLAS_GROUND_OTHER)return null;", replace: "if(!word)return null;", mustFail: T5 },
  { label: "an answer outranks the name", find: "  var named=atlasSheetNameKind(place),word,row,i,f;\n  if(named)return named;\n  if(place.ground){", replace: "  var named=atlasSheetNameKind(place),word,row,i,f;\n  if(place.ground){", mustFail: T5 },
  { label: "a feature overrides the story's \"other\"", find: "  if(place.ground){\n    word=atlasGroundWord(place.ground);", replace: "  if(place.ground&&place.ground!==ATLAS_GROUND_OTHER){\n    word=atlasGroundWord(place.ground);", mustFail: T5 },
  { label: "a word the library does not draw reaches it", find: "    if(!word||place.ground===ATLAS_GROUND_OTHER)return null;\n    return word.draws?{draws:word.draws}:{draws:\"wild\",terrain:place.ground};", replace: "    if(place.ground===ATLAS_GROUND_OTHER)return null;\n    return word&&word.draws?{draws:word.draws}:{draws:\"wild\",terrain:place.ground};", mustFail: T5 },
  { label: "a record that cannot be read counts as an answer", find: "if(r&&typeof r===\"object\"&&typeof r.ground===\"string\"&&atlasGroundWord(r.ground))return r;", replace: "if(r&&typeof r===\"object\"&&typeof r.ground===\"string\")return r;", mustFail: T1 },
  { label: "a terrain answered under an older edition is asked again", find: "return !!r&&r.ground===ATLAS_GROUND_OTHER&&!(r.set>=ATLAS_GROUND_SET);", replace: "return !!r&&!(r.set>=ATLAS_GROUND_SET);", mustFail: T1 },
  { label: "the table loses a terrain the library draws", find: '  {ground:"hills",says:"rolling high ground: hills, downs, bluffs"},\n', replace: "", mustFail: T2 }
];
var store = [{ label: "the grounds are not a registered keyed store", find: '"atlas.seen","atlas.grounds",', replace: '"atlas.seen",', mustFail: T4 }];
var game = [
  { label: "a story turn never asks", find: '      if(typeof atlasGroundSettle==="function")await atlasGroundSettle(resp,txt);', replace: "", mustFail: T8 },
  { label: "the opening never asks", find: '    if(typeof atlasGroundSettle==="function")await atlasGroundSettle(resp,"");', replace: "", mustFail: T8 }
];
var page = [{ label: "the game does not load the file", find: '<script src="atlas-ground.js"></script>', replace: "", mustFail: T8 }];
var shell = [{ label: "the offline shell lacks the file", find: '  "/atlas-ground.js",', replace: "", mustFail: T8 }];
var failed = sabotage.prove({ file: "atlas-ground.js", command: CMD, only: P, cases: ground });
if (!failed) failed = sabotage.prove({ file: "atlas-public-sheet.js", command: CMD, only: P, cases: sheet });
if (!failed) failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: store });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
if (!failed) failed = sabotage.prove({ file: "sw.js", command: CMD, only: P, cases: shell });
process.exit(failed ? 1 : 0);
