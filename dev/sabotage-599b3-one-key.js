// dev/sabotage-599b3-one-key.js — proves the #599 (b3) one-key convergence is guarded: the legacy readers decode through the
// stored grammar and key through itemKey, the stash key keeps provenance while the pair key projects it, a rename refuses
// two bases for one name, the want match is provenance-free and plural-blind, the counter folds by item key, and wares,
// wants and chest rows never twin by spelling. Each mutation runs in a disposable clone.
//   node dev/sabotage-599b3-one-key.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (b3)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var TABLE = "#599b3 the compatibility table", GRAMMAR = "#599b3 the stored grammar is the ONE count reader", RENAME = "#599b3 a rename resolves through the one resolver",
    WANT = "#599b3 the want match is provenance-free", KEYS = "#599b3 wares, wants and chest rows key through the one item key";
prove("inventory.js", [
  { label: "the base reader strips any x-digits suffix again (a literal 'Model x01' loses its name)",
    find: "function invStoredName(s){return invStoredParse(_invStr(s)).name;}", replace: "function invStoredName(s){return _invStr(s).replace(/\\s*x\\d+\\s*$/i,\"\").trim();}",
    mustFail: GRAMMAR },
  { label: "the count reader accepts a zero count again",
    find: "function invStoredCount(s){return invStoredParse(_invStr(s)).qty;}", replace: "function invStoredCount(s){var m=_invStr(s).match(/\\sx(\\d+)\\s*$/i);return m?parseInt(m[1],10):1;}",
    mustFail: GRAMMAR },
  { label: "the legacy key is lower case only (plural and dash variants split again)",
    find: "function invStoredKey(s){return itemKey(invStoredName(s));}", replace: "function invStoredKey(s){return invStoredName(s).toLowerCase();}",
    mustFail: TABLE },
  { label: "the stash key projects the provenance away (the chest's 'Rope (spare)' and 'Rope' become one row)",
    find: "function stashKey(name){return itemKey(", replace: "function stashKey(name){return itemBaseKey(",
    mustFail: TABLE },
  { label: "the pair key keeps the provenance (a stow of 'Signet ring (from Hemlock)' never pairs with its placement as 'Signet ring')",
    find: "function itemPairKey(name){return itemBaseKey(", replace: "function itemPairKey(name){return itemKey(",
    mustFail: TABLE },
  { label: "a rename takes the first base match again instead of refusing two",
    find: "  var hit=_invLegacyFind(inv,oldName),miss=invFind.last;",
    replace: "  var hit=invFind(inv,oldName),miss=null;if(hit<0){var _b=itemBaseKey(oldName),_j;for(_j=0;_j<inv.length;_j++){if(_invIsRow(inv[_j])&&itemBaseKey(inv[_j].name)===_b){hit=_j;break;}}}",/* #599 (c): the delegate resolves over rows — the mutation takes the first base match again */
    mustFail: RENAME },
]);
prove("memory.js", [
  { label: "the want match compares lower-cased text again (the plural never meets the singular want)",
    find: "  var live=nodeWantedLive(node),base=itemBaseKey(_qtyParse(String(item==null?\"\":item)).base),i;\n  for(i=0;i<live.length;i++){if(itemBaseKey(_qtyParse(String(live[i].item==null?\"\":live[i].item)).base)!==base)continue;",
    replace: "  var live=nodeWantedLive(node),base=String(item).toLowerCase(),i;\n  for(i=0;i<live.length;i++){if(String(live[i].item).toLowerCase()!==base)continue;",
    mustFail: WANT },
  { label: "a re-stated ware twins by spelling",
    find: "low=itemKey(it),i,row=null;/* #599 (b3): wares key through the one item key (§4.5) */\n  for(i=0;i<node.wares.length;i++)if(itemKey(node.wares[i].item)===low)",
    replace: "low=it.toLowerCase(),i,row=null;\n  for(i=0;i<node.wares.length;i++)if(String(node.wares[i].item).toLowerCase()===low)",
    mustFail: KEYS },
  { label: "a re-stated want twins by spelling",
    find: "  var low=itemKey(it),i;for(i=0;i<node.wanted.length;i++)if(itemKey(node.wanted[i].item)===low)",
    replace: "  var low=it.toLowerCase(),i;for(i=0;i<node.wanted.length;i++)if(String(node.wanted[i].item).toLowerCase()===low)",
    mustFail: KEYS },
]);
prove("helpers.js", [
  { label: "the counter keys a row by lower-cased text (the pelts split into two rows again)",
    find: "k=itemKey(base);\n    if(!hero[k]){hero[k]={name:base,qty:0,equipped:false,canonCp:null,wanted:false,sellCp:null};order.push(k);}",
    replace: "k=base.toLowerCase();\n    if(!hero[k]){hero[k]={name:base,qty:0,equipped:false,canonCp:null,wanted:false,sellCp:null};order.push(k);}",
    mustFail: WANT },
  { label: "the counter looks a want up by the row's own spelling (the plural row misses the singular want)",
    find: "    var w=wanted[itemBaseKey(r.name)]||null;", replace: "    var w=wanted[r.name.toLowerCase()]||null;",
    mustFail: WANT },
]);
prove("identity.js", [
  { label: "the chest fold on a place merge compares lower-cased text (the pelts twin, the chest is not summed)",
    find: "if(itemKey(canonNode.items[j].name)===itemKey(di[i].name)){seen=true;break;}}", replace: "if(String(canonNode.items[j].name).toLowerCase()===String(di[i].name).toLowerCase()){seen=true;break;}}",
    mustFail: KEYS },
]);
process.exit(code);
