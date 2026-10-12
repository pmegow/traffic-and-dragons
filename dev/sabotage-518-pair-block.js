// dev/sabotage-518-pair-block.js — proves #518's rule is guarded: an item pair is two tags in ONE block. The spans, the note key,
// and the two handlers that pass their own tag's block are each mutated back toward reply-wide pairing. The conservation
// clauses (Astra's acceptance 2026-10-10, audits/acceptance-2026-10-10/ledger/report.md) mutate the per-unit pair notes back
// to its two failures: a counted gift to a missing recipient that puts back one unit, and a miss that refuses every partner in
// its block — with the gift that no longer consumes the unit it pairs, and the silent gift that has no unit left.
//   node dev/sabotage-518-pair-block.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#518 block"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var BLOCK = "#518 block";
var MISSING = "a counted gift to a MISSING recipient", ONCE = "a loss unit pairs ONCE", STOW = "the stow pair shares the rule";
prove("helpers.js", [
  { label: "every tag of a reply is one block again (prose no longer splits the spans — reply-wide pairing returns)",
    find: "if(cur&&!/\\S/.test(t.slice(cur[1],m.index)))cur[1]=m.index+m[0].length;", replace: "if(cur)cur[1]=m.index+m[0].length;",
    mustFail: BLOCK }
]);
prove("inventory.js", [
  { label: "the pair note's key drops the block (a loss anywhere in the reply is the gift's half again)",
    find: 'function _itemPairK(name,blk){return itemPairKey(name)+(blk==null?"":"\\u0000"+blk);}', replace: 'function _itemPairK(name,blk){return itemPairKey(name);}',
    mustFail: BLOCK },
  { label: "#518 conservation: a missed loss refuses every gift in its block again (the second pair's miss strands the first pair's torch)",
    find: '&&!(itemPairCount(R,"ilHits",name,blk)>0);}', replace: ';}',
    mustFail: ONCE },
  { label: "#518 conservation: the same mutation strands the stow pair's torch (the predicate is shared by both partners)",
    find: '&&!(itemPairCount(R,"ilHits",name,blk)>0);}', replace: ';}',
    mustFail: STOW }
]);
prove("tag_table.js", [
  { label: "the hero's gain is noted outside every block (the in-block take can no longer find it)",
    find: 'itemPairNote(R,"igHits",igq.base,igq.base,_igB);', replace: 'itemPairNote(R,"igHits",igq.base,igq.base,null);',
    mustFail: BLOCK },
  { label: "the take pair reads the gain without its block (the in-block protection is lost)",
    find: 'var _tpb=itemPairTake(R,"igHits",cIlm[2],_tlB),_tpn=0;', replace: 'var _tpb=itemPairTake(R,"igHits",cIlm[2],null),_tpn=0;',
    mustFail: BLOCK },
  { label: "the gift's bound reads a loss from any block",
    find: 'var _gHits=itemPairCount(R,"ilHits",cIq.base,_cgBlk);', replace: 'var _gHits=itemPairCount(R,"ilHits",cIq.base,null)!==null?itemPairCount(R,"ilHits",cIq.base,null):(function(){var k,n=null;for(k in (R.ilHits||{}))if(k.indexOf(itemPairKey(cIq.base)+"\\u0000")===0)n=(n||0)+R.ilHits[k].length;return n;})();',
    mustFail: BLOCK },
  { label: "#518 conservation: a counted gift to a missing recipient puts back one unit again (Torch x3 leaves the hero one)",
    find: 'for(_gpi=0;_gpi<_gpq.n;_gpi++){', replace: 'for(_gpi=0;_gpi<1;_gpi++){',
    mustFail: MISSING },
  { label: "#518 conservation: a gift no longer consumes the loss unit it pairs (one torch lost, two given)",
    find: 'if(_gHits!==null)itemPairTake(R,"ilHits",cIq.base,_cgBlk);/* #518: the gift consumes', replace: '/* #518: the gift consumes',
    mustFail: ONCE },
  { label: "#518 conservation: a gift whose block's loss units are all paired is silent again (nothing given, nothing said)",
    find: 'if(_gHits===0){R.muts.push(', replace: 'if(false){R.muts.push(',
    mustFail: ONCE }
]);
process.exit(code);
