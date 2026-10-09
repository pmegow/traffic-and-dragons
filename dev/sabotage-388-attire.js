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
      find: 'if(ii<0){if(typeof console!=="undefined")console.warn("[attire] WORN: \'"+item+"\' is not in "+(who||cs.name||"?")+"\'s inventory — nothing is worn that is not carried; emit [ITEM_GAINED:] first (#388)");return {ok:false,reason:"not carried"};}',
      replace: 'if(ii<0){if(typeof console!=="undefined")console.warn("[attire] WORN: \'"+item+"\' is not in "+(who||cs.name||"?")+"\'s inventory — nothing is worn that is not carried; emit [ITEM_GAINED:] first (#388)");cs.worn.push(_invBase(item));return {ok:true,item:_invBase(item)};}' },
    { label: "re-donning duplicates the worn entry",
      find: 'if(wi>=0)return {ok:false,reason:"already worn",item:stored};cs.worn.push(stored);', replace: 'cs.worn.push(stored);' }
  ]
});
var rc2 = sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "ITEM_LOST no longer prunes worn (a lost shield stays 'worn')",
      find: 'if(typeof wornPrune==="function")wornPrune(worldState.character);/* #388: nothing is worn that is not carried */', replace: '' }
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
