// dev/sabotage-752-field-fixes.js — proves the #752 guards (a plural foe name finds its bestiary entry) and the #753
// guards (the fallback suggestion knows a fight is open). Each clause runs its own test through --only.
//   node dev/sabotage-752-field-fixes.js
var sabotage = require("./sabotage.js");
var P = "FAIL #752 ", CMD = ["node", ["dev/tests-752-field-fixes.js"]];
var T1 = P + "a foe named by the plural of an entry is that entry, and an exact name still wins",
  T2 = P + "two entries one plural could stand for is none, said on the console",
  T3 = P + "the enemy card of a group shows its entry's portrait",
  T4 = P + "in a fight the fallback suggestion is the fight's own, never a quiet-scene line",
  T5 = P + "outside a fight, and once every foe is down, the quiet list still serves";
var helpers = [
  { label: "the plural pass is gone: a group has no entry", find: "var sing=bestiarySingulars(key),s,hits=[];", replace: "var sing=[],s,hits=[];", mustFail: T3 },
  { label: "two entries behind one plural: the first is taken", find: 'if(hits.length>1){console.warn("[bestiary] ambiguous plural name: "+name);return null;}', replace: "", mustFail: T2 },
  { label: "the plural of a public name finds nothing", find: '||(typeof e.displayName==="string"&&e.displayName.trim().toLowerCase()===sing[s])){if(hits.indexOf(e)<0)', replace: "){if(hits.indexOf(e)<0)", mustFail: T1 },
  { label: "\"-ies\" is not turned to \"-y\"", find: 'if(/ies$/.test(k))add(k.replace(/ies$/,"y"));', replace: "", mustFail: T1 },
  { label: "\"-men\" is not turned to \"-man\"", find: 'if(/men$/.test(k))add(k.replace(/men$/,"man"));', replace: "", mustFail: T1 },
  { label: "\"-ves\" is not turned to \"-f\"", find: 'add(k.replace(/ves$/,"f"));', replace: "", mustFail: T1 },
  { label: "\"-ches\" keeps its e", find: 'if(/(?:ch|sh|s|x|z)es$/.test(k))add(k.replace(/es$/,""));', replace: "", mustFail: T1 },
  { label: "a word ending \"ss\" is read as a plural", find: 'if(/s$/.test(k)&&!/ss$/.test(k))', replace: "if(/s$/.test(k))", mustFail: T1 }
];
var game = [
  { label: "a fight is ignored: the quiet list is offered beside living foes", find: "var _fight=suggestionCombatCands();if(_fight.length)cands=_fight;", replace: "var _fight=[];", mustFail: T4 },
  { label: "a fallen foe is offered as a target", find: "if(!f[i]||f[i].down||!(f[i].hp>0))continue;var nm=", replace: "if(!f[i])continue;var nm=", mustFail: T4 },
  { label: "a foe is named by its row, not as the player is shown it", find: 'var nm=(typeof foePublicName==="function")?foePublicName(f[i]):f[i].name;', replace: "var nm=f[i].name;", mustFail: T4 },
  { label: "a fight with no living foe still offers the fight's moves", find: "if(!out.length)return out;/* no living foe", replace: "/* no living foe", mustFail: T5 }
];
var failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: helpers });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
process.exit(failed ? 1 : 0);
