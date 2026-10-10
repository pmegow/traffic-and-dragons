// dev/sabotage-518-pair-block.js — proves #518's rule is guarded: an item pair is two tags in ONE block. The spans, the note key,
// and the two handlers that pass their own tag's block are each mutated back toward reply-wide pairing.
//   node dev/sabotage-518-pair-block.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#518 block"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var BLOCK = "#518 block";
prove("helpers.js", [
  { label: "every tag of a reply is one block again (prose no longer splits the spans — reply-wide pairing returns)",
    find: "if(cur&&!/\\S/.test(t.slice(cur[1],m.index)))cur[1]=m.index+m[0].length;", replace: "if(cur)cur[1]=m.index+m[0].length;",
    mustFail: BLOCK }
]);
prove("inventory.js", [
  { label: "the pair note's key drops the block (a loss anywhere in the reply is the gift's half again)",
    find: 'function _itemPairK(name,blk){return itemPairKey(name)+(blk==null?"":"\\u0000"+blk);}', replace: 'function _itemPairK(name,blk){return itemPairKey(name);}',
    mustFail: BLOCK }
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
    mustFail: BLOCK }
]);
process.exit(code);
