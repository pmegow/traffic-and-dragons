// dev/sabotage-510-withheld-sale.js — proves the #510 guards are guarded. Where trade is gated (the Village) a sale whose item
// is not on the sheet is withheld, but the miss surfaced mid-loop: earlier [ITEM_LOST:] tags had already taken their items (a
// short count took every unit it found and kept the coin), so the sold items vanished while the GM was told the pack was
// unchanged. The sale is now checked whole against a COPY of the pack before anything leaves it. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-510-withheld-sale.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#510"]];
process.exit(sabotage.prove({ file: "tag_table.js", command: CMD, cases: [
  { label: "the whole-sale check is skipped (the reported loss)",
    find: 'if(R.goldIn>0&&typeof kindDef==="function"&&kindDef().tradeOnlyInShops){var _sSim=', replace: 'if(false){var _sSim=',
    mustFail: "the repro" },
  { label: "the check runs on the real pack, not a copy",
    find: "var _sSim=worldState.character.inventory.slice(),", replace: "var _sSim=worldState.character.inventory,",
    mustFail: "the repro" },
  { label: "the check counts one unit per tag, so a short count slips through",
    find: "for(_sj=0;_sj<_sq.n;_sj++){if(!removeInventoryItem(_sSim,_sq.base))", replace: "for(_sj=0;_sj<1;_sj++){if(!removeInventoryItem(_sSim,_sq.base))",
    mustFail: "a count the pack cannot cover" },
  { label: "a short count is said as a missing item",
    find: '_sWhy=_sj?"\'"+_sm[1].trim()+"\' is more than the sheet holds":', replace: '_sWhy=false?"":',
    mustFail: "a count the pack cannot cover" },
  { label: "an ambiguous name in a refused sale is no longer said",
    find: 'if(_invLastMiss&&_invLastMiss.why==="ambiguous"){R.muts.push(', replace: 'if(false){R.muts.push(',
    mustFail: "an ambiguous name in a village sale" },
  { label: "the refused sale's items stay hits for pairing, so a gift riding with it mints the item",
    find: "if(!R.ilMiss)R.ilMiss={};ilTags.forEach(function(t0){var m0=t0.match(/\\[ITEM_LOST:([^\\]]+)\\]/);if(m0)R.ilMiss[itemPairKey(m0[1])]=m0[1].trim();});", replace: "",
    mustFail: "misses for pairing" }
]}) ? 1 : 0);
