// dev/sabotage-388-attire.js — proves attire is guarded: the not-carried refusal, the duplicate guard,
// the prompt line, the ITEM_LOST prune, and the extractor belt.
//   node dev/sabotage-388-attire.js
var sabotage = require("./sabotage.js");
var rc0 = sabotage.prove({/* #599 (b): the attire line stayed in api.js; the worn helpers moved to inventory.js */
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the Wearing line is dropped from the player block",
      find: '+(attireLine(c)?attireLine(c)+"\\n":"")/* #388: what is ON — "" when never set (byte-identical) */', replace: '' }
  ]
});
var rc1 = sabotage.prove({
  file: "inventory.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "an uncarried item can be worn (the refusal is dropped)",
      /* #599 (c) re-anchor: wornSet is a delegate over rows — the refusal is the same line, the mutation mints the uncarried item and wears it */
      find: '  if(ii<0){if(on&&typeof console!=="undefined")console.warn("[attire] WORN: \'"+item+"\' is not in "+(who||cs.name||"?")+"\'s inventory — nothing is worn that is not carried; emit [ITEM_GAINED:] first (#388)");return {ok:false,reason:on?"not carried":"not worn"};}',
      replace: '  if(ii<0){if(on){invAdd(inv,invStoredParse(item).name,1);ii=_invLegacyFind(inv,item);}else return {ok:false,reason:"not worn"};}' },
    { label: "re-donning duplicates the worn entry",
      /* #599 (c) re-anchor: the flag is on the row (invEquip refuses a re-don); the mutation sets it blindly and says ok twice */
      find: '  var r=invEquip(inv,inv[ii].name,on);if(r.ok)return {ok:true,item:r.row.name};return {ok:false,reason:on?"already worn":"not worn",item:inv[ii].name};}', replace: '  inv[ii].equipped=!!on;return {ok:true,item:inv[ii].name};}' }
  ]
});
var rc2 = sabotage.prove({
  file: "inventory.js",/* #599 (c): the lost-item invariant lives in the row remover now */
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    /* #599 (c) re-anchor: the invariant holds by construction (a row leaves with its flag) — the mutation keeps the emptied row, so the lost shield stays worn */
    { label: "ITEM_LOST no longer prunes worn (a lost shield stays 'worn')",
      find: 'row.qty-=take;if(row.qty<=0)rows.splice(i,1);', replace: 'row.qty-=take;if(row.qty<=0){row.qty=0;}' }
  ]
});
var rc3 = sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the extractor belt is cut (attire never files from a summarize)",
      find: 'if(Array.isArray(extracted.attire)&&typeof attireSheet==="function"){', replace: 'if(false){' }
  ]
});
process.exit(rc0 || rc1 || rc2 || rc3);
