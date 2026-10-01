// dev/sabotage-507-ability-names.js — proves the #507 guards are guarded. The #487 heal (it runs at boot and before every
// turn) read "the same ability" through capBaseName, which strips a parenthetical: a GM's "Sneak Attack (venomed blade)"
// was deleted as a duplicate of the bible's Sneak Attack, and the bible lookup returned the EARLIEST row of a family, so a
// level-9 Druid holding Wild Shape, Wild Shape (CR 1/4) and Wild Shape (CR 1) was healed down to CR 1/4. ONE name rule
// (abilityBibleRow exact, abilitySame, abilityRowFor in helpers.js) now serves the lookup, the held check, the level-up
// grant and the heal. Each mutation runs in a disposable clone.
//   node dev/sabotage-507-ability-names.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#507"]];
process.exit(sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the bible lookup goes back to base names (the reported deletion)",
    find: "    if(abilityNameKey(rn)!==k)return;", replace: "    if(capBaseName(rn)!==capBaseName(nm))return;",
    mustFail: "the repro" },
  { label: "the first row of a name wins whatever the sheet's level",
    find: "    if(!best||abilityRowFor(lvl,cand,best)===cand)best=cand;", replace: "    if(!best)best=cand;",
    mustFail: "the EXACT name" },
  { label: "the highest row wins even above the sheet's level",
    find: "  if(ao!==bo)return ao?a:b;", replace: "  return a.lv>=b.lv?a:b;",
    mustFail: "the EXACT name" },
  { label: "two rows of one bible family are no longer one ability",
    find: "  return !!(abilityBibleRow(c,a)&&abilityBibleRow(c,b));", replace: "  return false;",
    mustFail: "a level-9 Druid" },
  { label: "the heal keeps the first copy's row instead of the one the level reaches (the Druid downgrade)",
    find: "w=abilityRowFor(lvl,rk,ra),gone=", replace: "w=rk,gone=",
    mustFail: "a level-9 Druid" },
  { label: "a late level-2 row steps the level-7 one down again",
    find: "if(hr&&rr&&hr.lv>rr.lv)return false;", replace: "",
    mustFail: "never steps a held row down" },
  { label: "a level-up row renames a GM's variant into the bible's name",
    find: "    if(!abilitySame(c,held,row.nm))continue;", replace: "    if(capBaseName(held)!==capBaseName(row.nm))continue;",
    mustFail: "never steps a held row down" },
  { label: "a GM's variant counts as holding the bible's ability, so the real one is never granted",
    find: "  for(i=0;i<L.length;i++){if(abilitySame(c,abilityParts(L[i]).nm,nm))return true;}", replace: "  for(i=0;i<L.length;i++){if(capBaseName(abilityParts(L[i]).nm)===capBaseName(nm))return true;}",
    mustFail: "the repro" }
]}) ? 1 : 0);
