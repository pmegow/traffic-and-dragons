// dev/sabotage-517-counter-tail.js — proves #517's last three closures are guarded: a counted ware name is the bundle the price
// buys (fileWare), a per-N want buys its bundle (fileWanted, the catalog, the plan, the ledger rows), and the coin a block spent
// comes back when the block's take moved nothing (the GOLD handler's spend note, the take pair's refund).
//   node dev/sabotage-517-counter-tail.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "ledger quartet"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var WARE = "#517 ③", WANT = "#517 ④", PAID = "#517 ⑤";
prove("memory.js", [
  { label: "the ware's name keeps its count (\"Arrow x20\" is a one-unit ware again — 400 arrows for 1 gp)",
    find: 'if(_wq.n>1){it=_wq.base;var _wpc=', replace: 'if(false){it=_wq.base;var _wpc=',
    mustFail: WARE },
  { label: "the count is stripped but the price is not made per the bundle (twenty arrows for 1 gp each)",
    find: 'if(_wpc&&_wpc.unit&&_wpc.per===1)pr=pr+" per "+_wq.n;', replace: '',
    mustFail: WARE },
  { label: "the want forgets its bundle (per 1 again)",
    find: 'per:(_oc&&_oc.unit)?_oc.per:1,/* #517 (c)', replace: 'per:1,/* #517 (c)',
    mustFail: WANT }
]);
prove("helpers.js", [
  { label: "the catalog drops the want's bundle",
    find: 'by:w.by||"",per:Math.max(1,w.per|0)}:null;', replace: 'by:w.by||"",per:1}:null;',
    mustFail: WANT },
  { label: "the plan's allowance is one unit regardless of the bundle",
    find: 'wantLeft[r.want.key]:WANT_BUYS*r.want.per;', replace: 'wantLeft[r.want.key]:WANT_BUYS;',
    mustFail: WANT },
  { label: "the refusal names one when the bundle is five",
    find: 'var _wb=WANT_BUYS*(overWant.per||1),nw=_wb===1?"one":String(_wb);', replace: 'var _wb=WANT_BUYS,nw=_wb===1?"one":String(_wb);',
    mustFail: WANT },
  { label: "the ledger row's maximum is one unit",
    find: 'max:r.wanted?Math.min(WANT_BUYS*((r.want&&r.want.per)||1),r.qty):r.qty,', replace: 'max:r.wanted?Math.min(WANT_BUYS,r.qty):r.qty,',
    mustFail: WANT }
]);
prove("tag_table.js", [
  { label: "the GOLD handler forgets what the block spent",
    find: 'R.spendAt[_gBlk]=(R.spendAt[_gBlk]||0)-_gm;}', replace: '}',
    mustFail: PAID },
  { label: "the take that moved nothing no longer returns the block's coin",
    find: 'if(_tpRef>0){worldState.character.coin=(Number(worldState.character.coin)||0)+_tpRef;', replace: 'if(false){worldState.character.coin=(Number(worldState.character.coin)||0)+_tpRef;',
    mustFail: PAID },
  { label: "the refund ignores the block's other item tags (a rope bought in the same block gets the coin back too)",
    find: 'if(tags.indexOf(m[1])<0||itemPairKey(body[body.length-1])!==k)return 0;', replace: 'if(false)return 0;',
    mustFail: PAID }
]);
process.exit(code);
