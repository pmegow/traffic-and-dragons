// dev/sabotage-518-pair-block.js — proves #518's rule is guarded: an item pair is two tags in ONE block. The spans, the note key,
// and the two handlers that pass their own tag's block are each mutated back toward reply-wide pairing. The conservation
// clauses (Astra's acceptance 2026-10-10, audits/acceptance-2026-10-10/ledger/report.md) mutate the per-unit pair notes back
// to its two failures: a counted gift to a missing recipient that puts back one unit, and a miss that refuses every partner in
// its block — with the gift that no longer consumes the unit it pairs, and the silent gift that has no unit left. #613: the take
// that no longer consumes the gain unit it pairs, and the shortfall that reaches the units the companion handed over. The
// acceptance of 2026-10-12 adds its own runner (ACC_CMD) for the fixes it forced: ⑮ ⑯ the stow, ⑰ the take beside a chest, ⑭ the
// short take with fields, ⑫ the sibilant plural in the item key.
//   node dev/sabotage-518-pair-block.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#518 block"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var BLOCK = "#518 block";
var MISSING = "a counted gift to a MISSING recipient", ONCE = "a loss unit pairs ONCE", STOW = "the stow pair shares the rule", TAKE613 = "#613 a take pair consumes the gain units it pairs";
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
    find: 'for(_gpi=0;;_gpi++){', replace: 'for(_gpi=0;_gpi<1;_gpi++){',
    mustFail: MISSING },
  { label: "#518 conservation: a gift no longer consumes the loss unit it pairs (one torch lost, two given)",
    find: 'if(_gHits!==null)itemPairTake(R,"ilHits",cIq.base,_cgBlk);/* #518: the gift consumes', replace: '/* #518: the gift consumes',
    mustFail: ONCE },
  { label: "#518 conservation: a gift whose block's loss units are all paired is silent again (nothing given, nothing said)",
    find: 'if(_gHits===0){R.muts.push(', replace: 'if(false){R.muts.push(',
    mustFail: ONCE },
  { label: "#613: a take no longer consumes the gain unit it pairs (two take pairs, Bram holding one — the second take's miss takes back the first pair's torch)",
    find: 'for(_tlN=0;_tlN<_tlP;_tlN++)itemPairTake(R,"igHits",cIlq.base,_tlB);', replace: '',
    mustFail: TAKE613 },
  { label: "#613: the short take's shortfall reaches the units the companion handed over again (a gain of one beside a take of x3 from Bram's one takes back Bram's torch)",
    find: 'Math.min(cIlq.n-cIlHit,_tlG-_tlP)', replace: 'Math.min(cIlq.n-cIlHit,_tlG)',
    mustFail: TAKE613 }
]);
/* The acceptance of 2026-10-12 (the "acceptance 2026-10-12 — #518 item pairs" section, 20 probes): each fix it forced is mutated
   back to the defect its probe named — the stow that pairs a loss unit twice (⑮) and files the tag's count (⑯), the gain that
   auto-takes from the floor beside a same-block take (⑰), the short take of a row with fields that mints plain units (⑭), and the
   item key that splits a sibilant "-es" plural from its singular (⑫). */
var ACC_CMD = ["node", ["dev/run-tests.js", "acceptance 2026-10-12"]];
function proveAcc(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ACC_CMD, cases: cases }); }
proveAcc("tag_table.js", [
  { label: "#518 ⑮: a stow whose block's loss units are all paired places anyway (one torch lost, two placements, two on the floor)",
    find: 'if(_lHits===0){R.muts.push("⚠ Nothing placed — \'"+_lq.base+"\'', replace: 'if(false){R.muts.push("⚠ Nothing placed — \'"+_lq.base+"\'',
    mustFail: "#518 acceptance ⑮" },
  { label: "#518 ⑯: a counted stow files the tag's count again (x3 placed from one torch lost — three on the floor)",
    find: 'if(_lHits!==null&&_lHits<_lq.n){', replace: 'if(false){',
    mustFail: "#518 acceptance ⑯" },
  { label: "#518 ⑰: a gain beside a same-block take auto-takes from the chest again (Bram's potion in, the chest's potion gone too)",
    find: 'var _igC=0;while(_igC<_igL&&itemPairTake(R,"tlCover",igq.base,_igB))_igC++;', replace: 'var _igC=0;',
    mustFail: "#518 acceptance ⑰" },
  { label: "#518 ⑭: a short take of a row with fields skips the shortfall before the I5 carry (the carry refuses, the hero keeps plain torches from nowhere)",
    find: '_tsh=(cIlHit&&cIlHit<cIlq.n)?', replace: '_tsh=(cIlHit&&cIlHit<cIlq.n&&!invFragsHaveFields(_tlF))?',
    mustFail: "#518 acceptance ⑭" }
]);
proveAcc("inventory.js", [
  { label: "#518 ⑫: the item key strips only a final s again ('Torches' keys as 'torche' and never pairs with 'Torch')",
    find: '.replace(/(ch|sh|ss)es?$/,"$1")', replace: '',
    mustFail: "#518 acceptance ⑫" }
]);
process.exit(code);
