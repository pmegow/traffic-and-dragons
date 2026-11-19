// dev/sabotage-776-item-kinds.js — proves the #776 guards: what is owed, the bounded names-only request, the
// whole-or-refused answer, the once-only record that never overrides canon, the grouping's one read, the wall between a
// filing and canon, the one ask and its loud failure, the load door and the call sites. Each clause runs its own test.
//   node dev/sabotage-776-item-kinds.js
var sabotage = require("./sabotage.js");
var P = "FAIL #776 item kinds ", CMD = ["node", ["dev/tests-776-item-kinds.js"]];
var T1 = P + "what is owed: every carried item without canon that was never asked, once, on any sheet; never one with canon or with an answer",
  T2 = P + "the request carries the names alone, and its words are the registry's: every section with what it holds, and unclear",
  T3 = P + "the answer is read whole or refused: a wrong count, a word that is no section, a stray field, a cut reply, prose",
  T4 = P + "filing keeps one answer per item in a registered store and never replaces it or overrides canon",
  T5 = P + "the inventory files an answered item under its section; unclear and unasked stay Unclassified; canon decides first",
  T6 = P + "a filing is not canon: the item bible, the canon block, the Define gate and the GM prompt do not see it",
  T7 = P + "the ask runs once after a turn, files every answer, saves and tells the player; a sorted pack asks nothing",
  T8 = P + "a failed, unreadable or stale ask files nothing and says so; the items stay owed",
  T9 = P + "the load door drops a store or a record that cannot be read, and says so",
  T10 = P + "the ask runs after the commit on a story turn and on the opening, and the file is loaded where the game loads";
var kinds = [
  { label: "an item with canon is asked anyway", find: "if(itemLookup(es[j].name)||itemKindStored(ws,key))continue;", replace: "if(itemKindStored(ws,key))continue;", mustFail: T1 },
  { label: "an answered item is asked again", find: "if(itemLookup(es[j].name)||itemKindStored(ws,key))continue;", replace: "if(itemLookup(es[j].name))continue;", mustFail: T1 },
  { label: "an item two sheets hold is asked twice", find: "if(!key||seen[key])continue;seen[key]=1;", replace: "if(!key)continue;", mustFail: T1 },
  { label: "the ask is uncapped", find: "for(j=0;j<es.length&&out.length<ITEM_KIND_ASK_MAX;j++){", replace: "for(j=0;j<es.length;j++){", mustFail: T1 },
  { label: "a name is sent unbounded", find: "name:String(es[j].name).slice(0,ITEM_KIND_NAME_MAX)", replace: "name:String(es[j].name)", mustFail: T1 },
  { label: "only the hero's pack is read", find: "var out=[],seen=keyedDict(),sheets=worldSheetsOf(ws),i,j,es,key;", replace: "var out=[],seen=keyedDict(),sheets=worldSheetsOf(ws).slice(0,1),i,j,es,key;", mustFail: T1 },
  { label: "a record that cannot be read counts as an answer", find: 'return r&&typeof r==="object"&&itemKindWord(r.kind)?r:null;', replace: 'return r&&typeof r==="object"?r:null;', mustFail: T1 },
  { label: "the request carries more than the names", find: "user:JSON.stringify({items:owed.map(function(o){return o.name;})})", replace: "user:JSON.stringify({items:owed.map(function(o){return o.name;}),keys:owed.map(function(o){return o.key;})})", mustFail: T2 },
  { label: "the prompt does not say what a section holds", find: 'return id+" ("+ITEM_KIND_SAYS[id]+")";', replace: "return id;", mustFail: T2 },
  { label: "a section loses its row", find: '  treasure:"kept for its worth: gems, art, precious objects",\n', replace: "", mustFail: T2 },
  { label: "unclear is no longer a word", find: "function itemKindWords(){return invCategoryIds().concat([ITEM_KIND_UNCLEAR]);}", replace: "function itemKindWords(){return invCategoryIds();}", mustFail: T2 },
  { label: "a short answer is taken", find: "    if(obj.kinds.length!==count)return refuse(", replace: "    if(false)return refuse(", mustFail: T3 },
  { label: "a word that is no section is taken", find: "for(i=0;i<obj.kinds.length;i++)if(!itemKindWord(obj.kinds[i]))return refuse(", replace: "for(i=0;i<obj.kinds.length;i++)if(false)return refuse(", mustFail: T3 },
  { label: "an envelope with a stray field is taken", find: 'if(keys.length!==1||keys[0]!=="kinds"||!Array.isArray(obj.kinds))', replace: "if(!Array.isArray(obj.kinds))", mustFail: T3 },
  { label: "a reply cut short is read", find: 'if(finish&&(finish.cut||finish.cap))return refuse("the item-section response ended early");', replace: "", mustFail: T3 },
  { label: "an unbounded reply is parsed", find: 'if(typeof reply!=="string"||reply.length>ITEM_KIND_REPLY_MAX)return refuse(', replace: 'if(typeof reply!=="string")return refuse(', mustFail: T3 },
  { label: "a second answer replaces the first", find: 'if(itemKindStored(ws,key))return refuse(key+" was already asked");', replace: "", mustFail: T4 },
  { label: "an answer is filed over canon", find: 'if(itemLookup(name))return refuse(key+" has canon, which decides its section");', replace: "", mustFail: T4 },
  { label: "a word that is no section is filed", find: 'if(!itemKindWord(kind))return refuse("not one of the inventory\'s sections");', replace: "", mustFail: T4 },
  { label: "the store is a plain object", find: "Array.isArray(ws.itemKinds))ws.itemKinds=keyedDict();", replace: "Array.isArray(ws.itemKinds))ws.itemKinds={};", mustFail: T4 },
  { label: "an unclear item is filed under a section named unclear", find: "return r&&r.kind!==ITEM_KIND_UNCLEAR?r.kind:null;", replace: "return r?r.kind:null;", mustFail: T5 },
  { label: "the request is counted as a turn", find: 'var ITEM_KIND_USAGE="item-kind";', replace: 'var ITEM_KIND_USAGE="turn";', mustFail: T7 },
  { label: "the request carries the history", find: "options={noHistory:true,kind:ITEM_KIND_USAGE,noRetry:true}", replace: "options={kind:ITEM_KIND_USAGE,noRetry:true}", mustFail: T7 },
  { label: "the answers are not saved", find: '    if(typeof saveAll==="function")saveAll();\n    var _line=itemKindsSaidFiled(_said);', replace: '    var _line=itemKindsSaidFiled(_said);', mustFail: T7 },/* #777 C4: the lines as they read now */
  { label: "the player is told nothing", find: 'if(_line&&typeof showToast==="function")showToast(_line,8000);', replace: "", mustFail: T7 },
  { label: "what stays unclassified is not said", find: '(left.length?"Left unclassified (the name does not say): "+left.join(", ")+".":"")', replace: '""', mustFail: T7 },
  { label: "a failed ask is silent", find: '    itemKindsSay("the pack could not be sorted: "+((e&&e.message)||e)+". Nothing was filed; it is asked again next turn.");\n', replace: "", mustFail: T8 },
  { label: "an answer lands in another campaign", find: 'if(worldState!==ws){itemKindsSay("the campaign changed while the pack was being sorted; nothing was recorded");return null;}', replace: "", mustFail: T8 },
  { label: "the load door keeps a record it cannot read", find: "if(!itemKindStored(ws,keys[i])){delete ws.itemKinds[keys[i]];dropped++;}", replace: "if(false){dropped++;}", mustFail: T9 },
  { label: "the load door keeps a store that is a list", find: "Array.isArray(ws.itemKinds)){delete ws.itemKinds;dropped=1;}", replace: "Array.isArray(ws.itemKinds)){dropped=0;}", mustFail: T9 }
];
var group = [
  { label: "the inventory never reads the answer", find: 'if(!e&&typeof itemKindSection==="function"){var _ik=itemKindSection(itemBaseName(text));if(_ik)cats=[_ik];}', replace: "", mustFail: T5 },
  { label: "an answer moves an item that has canon", find: 'if(!e&&typeof itemKindSection==="function"){var _ik=itemKindSection(itemBaseName(text));if(_ik)cats=[_ik];}', replace: 'if(typeof itemKindSection==="function"){var _ik=itemKindSection(itemBaseName(text));if(_ik)cats=[_ik];}', mustFail: T5 }
];
var canon = [{ label: "the item bible serves a filing as canon", find: "function itemLookup(nm){\n  var key=itemBaseName(nm);\n  if(!key)return null;", replace: "function itemLookup(nm){\n  var key=itemBaseName(nm);\n  if(!key)return null;\n  if(typeof itemKindSection===\"function\"&&itemKindSection(key))return {category:itemKindSection(key),effect:\"N/A\",uses:\"N/A\",value:\"N/A\"};", mustFail: T6 }];
var store = [{ label: "the answers are not a registered keyed store", find: '"itemDefAsked","itemKinds",', replace: '"itemDefAsked",', mustFail: T4 }];
var load = [{ label: "the load door never checks the answers", find: '  if(typeof itemKindsHeal==="function"&&itemKindsHeal(worldState))_mig=true;', replace: "  ", mustFail: T9 }];
var game = [
  { label: "a story turn never asks", find: '      if(typeof itemKindsSettle==="function")await itemKindsSettle();', replace: "", mustFail: T10 },
  { label: "the opening never asks", find: '    if(typeof itemKindsSettle==="function")await itemKindsSettle();/* #776: the starting gear too */', replace: "", mustFail: T10 }
];
var page = [{ label: "the game does not load the file", find: '<script src="item-kinds.js"></script>', replace: "", mustFail: T10 }];
var shell = [{ label: "the offline shell lacks the file", find: '  "/item-kinds.js",', replace: "", mustFail: T10 }];
var failed = sabotage.prove({ file: "item-kinds.js", command: CMD, only: P, cases: kinds });
if (!failed) failed = sabotage.prove({ file: "inventory.js", command: CMD, only: P, cases: group });
if (!failed) failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: canon.concat(store) });
if (!failed) failed = sabotage.prove({ file: "state.js", command: CMD, only: P, cases: load });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
if (!failed) failed = sabotage.prove({ file: "sw.js", command: CMD, only: P, cases: shell });
process.exit(failed ? 1 : 0);
