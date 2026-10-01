// dev/sabotage-481-a2-item-pairs.js — proves the #481 A2 guards are guarded: a move written as two tags must land
// together or not at all. Each clause removes one rule of the pairing and the matching "#481 A2 two-tag item moves" test
// must fail: the resolver's unique base name and its loud ambiguity; the stow pair (withhold on a missed loss, put back
// on a refused placement — the Village t216 destroyed core); the give pair (withhold, put back when there is no party
// member); the take pair (take back a copy from nowhere); the village sale pair (withhold the coin) and the adventure's
// kept coin with its note. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-a2-item-pairs.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 A2"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "the resolver loses its unique base-name step",
    find: "  if(hits.length===1)return hits[0];\n", replace: "",
    mustFail: "the resolver: a short name reaches" }
]);
prove("tag_table.js", [
  { label: "an ambiguous loss is no longer said",
    find: 'if(_invLastMiss&&_invLastMiss.why==="ambiguous")R.muts.push(', replace: 'if(false)R.muts.push(',
    mustFail: "two candidates refuse loudly" },
  { label: "a refused placement no longer puts the unit back (t216)",
    find: 'if(_lact==="placed"){var _lpb=null,', replace: 'if(false){var _lpb=null,',
    mustFail: "a stow whose placement is refused" },
  { label: "a placement whose loss missed is placed anyway",
    find: 'if(_lact==="placed"&&itemPairMissed(R,_lnm)){', replace: 'if(false){',
    mustFail: "a loss that matched nothing places nothing" },
  { label: "a refused trade rider is no longer a miss",
    find: 'ilTags.forEach(function(t0){var m0=t0.match(/\\[ITEM_LOST:([^\\]]+)\\]/);if(m0){if(!R.ilMiss)R.ilMiss={};R.ilMiss[itemPairKey(m0[1])]=m0[1].trim();}});return;}',
    replace: 'return;}',
    mustFail: "a loss that matched nothing places nothing" },
  { label: "a gift the hero never held reaches the companion",
    find: 'if(itemPairMissed(R,cIgm[2])){', replace: 'if(false){',
    mustFail: "a loss that matched nothing places nothing" },
  { label: "a gift to a non-member vanishes again",
    find: 'var _gpb=itemPairTake(R,"ilHits",cIgm[2]);if(_gpb){', replace: 'var _gpb=null;if(_gpb){',
    mustFail: "a gift to someone who is not a party member" },
  { label: "a take the companion never held reaches the hero",
    find: 'var _tpb=itemPairTake(R,"igHits",cIlm[2]);if(_tpb){', replace: 'var _tpb=null;if(_tpb){',
    mustFail: "a take from a companion whose loss misses" },
  { label: "the village mints coin for a sale of nothing",
    find: 'if(R.goldIn>0&&typeof kindDef==="function"&&kindDef().tradeOnlyInShops){var _sSim=',
    replace: 'if(false){var _sSim=',
    mustFail: "the village sale pair" },
  { label: "the adventure's missed sale is silent again",
    find: 'if(R.goldIn>0){R.muts.push("⚠ \'"+ilq.base+"\' is not on the sheet — coin kept");worldState.itemNotHeldPing={turn:R.turn,item:ilq.base};}',
    replace: 'if(R.goldIn>0){}',
    mustFail: "the adventure never withholds a reward" }
]);
process.exit(code);
