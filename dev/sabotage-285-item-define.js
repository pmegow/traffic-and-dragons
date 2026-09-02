// sabotage-285-item-define.js — mutation proof for the #285 Define-eligibility gate (joint
// review f18). The guard: itemDefEligible (helpers.js) is the ONE predicate the sheet button and
// buildItemDefinePrompt share — canon-less items and classification-only curated BASE entries are
// Define-eligible (organize-only entries never inject, so the GM re-derives the item's nature
// from its name each turn — the Cleaver drift class); overlay entries (write-once is REAL there),
// alias-resolved entries, and effect-bearing entries refuse. itemDefShadowNote is the
// no-silent-failures line in the #81 confirm modal when accepting replaces a curated entry.
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-285-item-define.js
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({
  file:"helpers.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#285: the classification-only widening dies — organize-only base entries are un-Definable again (the f18 hole reopens)",
      mustFail:"#285 (f18): a classification-only BASE entry is Define-eligible",
      find:"  return hit.effect===\"N/A\"&&hit.category!==\"mundane\"&&hit.category!==\"treasure\";",
      replace:"  return false;" },

    { label:"#285/#294B: the effect-bearing overlay refusal dies — a paid review call can be burned on a def that write-once (per real canon) will never let land",
      mustFail:"#285 (f18): effect-bearing base and effect-bearing overlay entries stay Define-ineligible",
      find:"    if(ov.effect&&ov.effect!==\"N/A\")return false;\n    if(base)return false;",
      replace:"    if(false)return false;\n    if(base)return false;" },

    { label:"#285: the alias guard dies — a def could land under the alias's own key and split resolution from the curated canon key",
      mustFail:"#285 (f18): effect-bearing base and effect-bearing overlay entries stay Define-ineligible",
      find:"  if(!base||base!==hit)return false;/* alias-resolved */",
      replace:"  if(!base)return false;" },

    { label:"#285: the shadow note goes silent — replacing a curated entry becomes invisible to the player (no-silent-failures)",
      mustFail:"#285 (f18): itemDefShadowNote",
      find:"  if(typeof ITEM_BIBLE===\"undefined\"||!key||!ITEM_BIBLE[key])return\"\";",
      replace:"  return\"\";if(typeof ITEM_BIBLE===\"undefined\"||!key||!ITEM_BIBLE[key])return\"\";" }
  ]
});

rc|=sabotage.prove({
  file:"game.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#285: buildItemDefinePrompt regresses to the old any-hit gate — the builder and the button disagree",
      mustFail:"#285 (f18): a classification-only BASE entry is Define-eligible",
      find:"  if(typeof itemDefEligible===\"function\"){if(!itemDefEligible(rawItem))return null;}\n  else if(typeof itemLookup===\"function\"&&itemLookup(rawItem))return null;/* satellite fallback: old gate */",
      replace:"  if(typeof itemLookup===\"function\"&&itemLookup(rawItem))return null;" }
  ]
});

process.exit(rc?1:0);
