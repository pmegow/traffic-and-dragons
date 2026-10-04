// dev/sabotage-quartet-ledger.js — proves the ledger quartet (#511 #517 #518 #519, Astra's verification fixtures of
// 2026-10-02) is guarded: each side of the counter rounds on its own, plural coin words keep their unit, a gift is
// bounded by its loss half, the spoken undo refuses after a hero swap, and a same-world footer after an arrival is
// no move. Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-quartet-ledger.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "the ledger quartet"]], cases: cases }); }
prove("helpers.js", [
  { label: "#511 ② prose between the tags no longer breaks the block (a ware written outside files on the shop)",
    find: "while(p<t.length){var m=t.slice(p).match(/^\\s*(\\[[^\\]]*\\])/);if(!m)break;", replace: "while(p<t.length){var m=t.slice(p).match(/^[^\\[]*(\\[[^\\]]*\\])/);if(!m)break;",
    mustFail: "#511 ② a block of tags" },
  { label: "#511 ② the coin is judged where it was written, not at its block's arrival",
    find: "_st=placeStateAt(_tl,_go>=0?tagBlockEnd(_t,_go):null),_ei;", replace: "_st=placeStateAt(_tl,_go>=0?_go:null),_ei;",
    mustFail: "#511 ② a block of tags" },
  { label: "#517 ① → #598 the net is rounded to whole gold again (the whistles are given away)",
    find: "  var netCp=buyCp-sellCp,coinAfter=cat.coin-netCp,ok=lines.length>0&&coinAfter>=0;", replace: "  var netCp=Math.round((buyCp-sellCp)/100)*100,coinAfter=cat.coin-netCp,ok=lines.length>0&&coinAfter>=0;",
    mustFail: "#517 ① → #598 a sale bundled" },
  { label: "#517 ② the plural coin word fails the boundary again ('3 coppers' reads as 3 gp)",
    find: "(gp|sp|cp|pp|gold|silver|copper|platinum)s?(?![a-z])", replace: "(gp|sp|cp|pp|gold|silver|copper|platinum)(?![a-z])",
    mustFail: "#517 ② plural coin words" }
]);
prove("tag_table.js", [
  { label: "#511 ② the trade tags read their own offset again (a ware ahead of the arrival files on the street)",
    find: "function rPlaceAtBlock(R,text,off){return rPlaceAt(R,(typeof tagBlockEnd===\"function\")?tagBlockEnd(text,off):off);}", replace: "function rPlaceAtBlock(R,text,off){return rPlaceAt(R,off);}",
    mustFail: "#511 ② a block of tags" },
  { label: "#511 ② a description joins the block rule (it describes the place being entered)",
    find: "if(ldesc)fileLocationDesc(ldesc[1],rPlaceAt(R,ldesc.index));", replace: "if(ldesc)fileLocationDesc(ldesc[1],rPlaceAtBlock(R,text,ldesc.index));",
    mustFail: "#511 ② a block of tags" },
  { label: "#518 the gift is no longer bounded by what left the pack",
    find: "if(_gHits!==null&&_gHits<cIq.n){", replace: "if(false){",
    mustFail: "#518 a gift bounded" },
  { label: "#518 ② the take pair gives the hero the full count again (Bram held one, the hero gets three)",
    find: "    if(cIlHit&&cIlHit<cIlq.n){var _tsh=cIlq.n-cIlHit,_tsb=0,_tsx;", replace: "    if(false){var _tsh=cIlq.n-cIlHit,_tsb=0,_tsx;",
    mustFail: "#518 ② the take pair" },
  { label: "#518 ② a total miss takes back one unit only (the hero keeps two)",
    find: "var _tpb=itemPairTake(R,\"igHits\",cIlm[2]),_tpn=0;while(_tpb){removeInventoryItem(worldState.character.inventory,_tpb);_tpn++;_tpb=itemPairTake(R,\"igHits\",cIlm[2]);}", replace: "var _tpb=itemPairTake(R,\"igHits\",cIlm[2]),_tpn=0;if(_tpb){removeInventoryItem(worldState.character.inventory,_tpb);_tpn++;}",
    mustFail: "#518 ② the take pair" },
  { label: "#518 ② a gift from the pack also takes from the chest again (the potion destroyed)",
    find: "    var _cAt=(_gHits!==null)?null:autoTakeLocationItem(", replace: "    var _cAt=autoTakeLocationItem(",
    mustFail: "#518 ② the take pair" },
  { label: "#518 the cut is applied but not said",
    find: "{R.muts.push(\"⚠ Gift of \"", replace: "{void(\"⚠ Gift of \"",
    mustFail: "#518 a gift bounded" },
  { label: "#511 a re-stated world still counts as the last arrival (the tavern becomes passed-through)",
    find: "&&!ev[i].twin&&!ev[i].restate)lastWorld=i;", replace: "&&!ev[i].twin)lastWorld=i;",
    mustFail: "#511 a same-world footer" }
]);
prove("identity.js", [
  { label: "#511 the timeline never marks a re-statement (the footer clears the sub-location again)",
    find: "else if(nm===world&&subSeen)ev.restate=true;", replace: "else if(false)ev.restate=true;",
    mustFail: "#511 a same-world footer" },
  { label: "#511 a lone same-world footer with no arrival before it is treated as a re-statement too (the old reading is lost)",
    find: "else if(nm===world&&subSeen)ev.restate=true;", replace: "else if(nm===world)ev.restate=true;",
    mustFail: "#511 a same-world footer" }
]);
prove("game.js", [
  { label: "#519 the undo no longer refuses when the recorded actor is neither hero nor companion",
    find: "if(e.pack&&e.by&&e.by!==hero&&!(typeof findCompanionChar===\"function\"&&findCompanionChar(e.by)))return", replace: "if(false)return",
    mustFail: "#519 the spoken undo" },
  { label: "#519 the refusal no longer names who the item belonged to",
    find: "reason:e.by+\" is no longer the hero or in the party — \"+e.name+\" stays \"+(e.action===\"placed\"?\"in \"+leaf:\"where it is\")+\" until \"+e.by+\" plays again\"",
    replace: "reason:\"the one who moved it is no longer the hero or in the party — \"+e.name+\" stays \"+(e.action===\"placed\"?\"in \"+leaf:\"where it is\")",
    mustFail: "#519 the spoken undo" }
]);
process.exit(code);
