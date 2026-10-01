// dev/sabotage-496-shop-button.js — proves the #496 guard is guarded (owner ruling 2026-09-30: in a Village shop where trade is
// possible, the fourth button is ALWAYS "Shop at <place>." and opens the counter; it replaces the village's Buy and Sell rungs).
// The opener is decided at click time against the live state (engineActionOpener), so a stale or rebuilt button behaves. Each
// mutation runs in a disposable clone.
//   node dev/sabotage-496-shop-button.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#6 the village — phase E/F"]], T = "#496 in a village shop where trade is possible";
rc |= sabotage.prove({ file: "game.js", command: CMD, cases: [
  { label: "the Shop button is gone",
    find: "if(_sk&&_sk.waresPerShop&&!worldState.combat&&typeof villageTradeContext===\"function\"){var _sv=", replace: "if(false){var _sv=",
    mustFail: T },
  { label: "the Shop button yields to a hurt hero's potion (not \"always\")",
    find: "if(_sk&&_sk.waresPerShop&&!worldState.combat&&typeof villageTradeContext===\"function\"){var _sv=", replace: "if(_sk&&_sk.waresPerShop&&!worldState.combat&&!(c.hp<c.maxHp)&&typeof villageTradeContext===\"function\"){var _sv=",
    mustFail: T },
  { label: "the Shop button shows with nobody behind the counter",
    find: "if(_sv.ok&&_sv.shop)return {kind:\"shop\",text:\"Shop at \"+_sv.shop+\".\"};}", replace: "return {kind:\"shop\",text:\"Shop at \"+(_sv.shop||\"the tavern\")+\".\"};}",
    mustFail: T },
  { label: "a tap on the Shop button sends a turn instead of opening the counter",
    find: "  var _op=engineActionOpener(action);if(_op){invLedgerOpen(_op);return;}/* #496: the Shop button opens the counter", replace: "  /* #496: the Shop button opens the counter",
    mustFail: T },
  { label: "the opener goes by the button's words, not the live state (a stale button opens an unattended counter)",
    find: "  if(!fa||!ENGINE_ACTION_OPENERS[fa.kind]||punctuateAction(fa.text)!==action)return null;\n  return ENGINE_ACTION_OPENERS[fa.kind];", replace: "  return /^Shop at /.test(String(action))?ENGINE_ACTION_OPENERS.shop:null;",
    mustFail: T },
  { label: "the village's own Buy rung comes back beside the counter",
    find: "  if(!(_tk&&_tk.tradeOnlyInShops)&&(c.gold||0)>0&&memory&&memory.map", replace: "  if((c.gold||0)>0&&memory&&memory.map",
    mustFail: T }
]});
rc |= sabotage.prove({ file: "ui-boot.js", command: CMD, cases: [
  { label: "a hold on the Shop button sends a turn",
    find: "        var _op=engineActionOpener(a);if(_op){invLedgerOpen(_op);return;}/* #496: a hold", replace: "        /* #496: a hold",
    mustFail: T }
]});
// The village rung no longer takes turns with a buy rung: outside a shop it holds the slot on every turn.
rc |= sabotage.prove({ file: "game.js", command: ["node", ["dev/run-tests.js", "#6 the village — phase C/D/G/H"]], cases: [
  { label: "the village rung shows only every other turn again",
    find: "    var _vr=villageRung();if(_vr)return _vr;", replace: "    var _vr=villageRung();if(_vr&&(worldState.turn||0)%2===0)return _vr;",
    mustFail: "#6D1 the village rung sits ABOVE buy" }
]});
process.exit(rc ? 1 : 0);
