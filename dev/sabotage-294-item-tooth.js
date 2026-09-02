// sabotage-294-item-tooth.js — mutation proof for #294 Part B (owner ruling 2026-08-31: "ALL items
// need a description"). Two teeth: ① every canon-less [ITEM_GAINED:] asks ONCE per item per campaign
// (no mundane skip-list; an inline "—" description exempts itself; the itemDefAsked latch is stamped
// at delivery so a dead turn restores it); ② write-once is write-once-per-REAL-canon —
// itemDefOverlayReplaceable is the ONE predicate the [ITEM_DEF:] handler and itemDefAccept share, so
// a classification-only overlay with no base (the t2412 crown) has an exit and an effect-bearing
// overlay stays sealed. Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is
// a hard failure. Usage: node dev/sabotage-294-item-tooth.js
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#294B ①: the inline-description exemption dies — a self-described item is nagged about anyway",
      mustFail:"the old mundane skip-list is gone",
      find:"  if(/\\s[—–-]\\s/.test(String(rawName||\"\")))return;",
      replace:"" },
    { label:"#294B ①: the asked latch dies — every change of hands re-asks (the bedroll nag the skip-list used to hide)",
      mustFail:"asked ONCE per item per campaign",
      find:"  if(worldState.itemDefAsked&&worldState.itemDefAsked[key]!=null)return;",
      replace:"" },
    { label:"#294B ①: the latch is ALSO stamped at arming — a dead provider turn restores an already-asked item and the note is never delivered",
      mustFail:"asked ONCE per item per campaign",
      find:"  worldState.itemDefCandidate={key:key,turn:worldState.turn||0};\n}",
      replace:"  worldState.itemDefCandidate={key:key,turn:worldState.turn||0};_itemDefMarkAsked(key,worldState.turn||0);\n}" },
    { label:"#294B ①: the asked map loses its bound (monotonic-resources rule)",
      mustFail:"asked ONCE per item per campaign",
      find:"  while(ks.length>ITEM_DEF_ASKED_CAP){",
      replace:"  while(false){" },
    { label:"#294B ① (the owner's ALL-items ruling): a mundane skip returns — plain gear stops asking",
      mustFail:"plain gear asks too",
      find:"  if(!key)return;\n  /* #294 Part B",
      replace:"  if(!key||/bedroll|torch|ration/i.test(key))return;\n  /* #294 Part B" }
  ]
});

rc|=sabotage.prove({
  file:"helpers.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#294B ②: itemDefOverlayReplaceable seals EVERY overlay again — the crown is a dead end once more",
      mustFail:"a classification-only overlay with NO base canon is Define-eligible and REPLACEABLE",
      find:"  if(!ov)return true;\n  return !(ov.effect&&ov.effect!==\"N/A\");",
      replace:"  if(!ov)return true;\n  return false;" },
    { label:"#294B ②: itemDefOverlayReplaceable opens EVERY overlay — real overlay canon can be silently rewritten by the next proposal",
      mustFail:"a classification-only overlay with NO base canon is Define-eligible and REPLACEABLE",
      find:"  if(!ov)return true;\n  return !(ov.effect&&ov.effect!==\"N/A\");",
      replace:"  return true;" },
    { label:"#294B ②: eligibility over a base-less classification-only overlay dies — Define stays greyed for the crown",
      mustFail:"a classification-only overlay with NO base canon is Define-eligible and REPLACEABLE",
      find:"    if(base)return false;\n    return ov.category!==\"mundane\"&&ov.category!==\"treasure\";",
      replace:"    return false;" },
    { label:"#294B ②: the replacement drops the stub's #157 display classification",
      mustFail:"a classification-only overlay with NO base canon is Define-eligible and REPLACEABLE",
      find:"    if(prior.inventoryCategories&&!p.entry.inventoryCategories)p.entry.inventoryCategories=prior.inventoryCategories;",
      replace:"" }
  ]
});

rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#294B ②: the [ITEM_DEF:] handler keeps the old any-overlay refusal — the GM's proposal for the crown is dropped before the player ever sees it",
      mustFail:"a classification-only overlay with NO base canon is Define-eligible and REPLACEABLE",
      find:"if(typeof itemDefOverlayReplaceable===\"function\"?!itemDefOverlayReplaceable(idKey):(worldState.itemBible&&worldState.itemBible[idKey])){",
      replace:"if(worldState.itemBible&&worldState.itemBible[idKey]){" }
  ]
});

process.exit(rc?1:0);
