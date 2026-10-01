// dev/sabotage-492-buy-button.js — proves the #492 guard is guarded (playtest v1.1078, 2 of 2 runs: the Buy button offered the
// item the hero had just bought). The buy rung names the first ware the hero does not hold, through ONE picker
// (firstWareNotHeld, helpers.js), and steps aside when every ware is held. Since #496 the village has no buy rung (its Shop button
// opens the counter), so the rule is the adventure's. Each mutation runs in a disposable clone.
//   node dev/sabotage-492-buy-button.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#6 the village — phase E/F"]], T = "#492 the Buy button";
rc |= sabotage.prove({ file: "game.js", command: CMD, cases: [
  { label: "the adventure button names the first ware again, held or not",
    find: "var _ab=firstWareNotHeld(live,c.inventory);", replace: "var _ab=live[0];",
    mustFail: T }
]});
rc |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the pack is compared raw (a count, a provenance note or letter case hides the item)",
    find: "held[itemBaseName(inventory[i])]=true;", replace: "held[String(inventory[i])]=true;",
    mustFail: T },
  { label: "an item that merely starts with the ware's name counts as holding it",
    find: "if(wares[i]&&!held[itemBaseName(wares[i].item)])return wares[i];", replace: "if(wares[i]&&!Object.keys(held).some(function(h){return h.indexOf(itemBaseName(wares[i].item))===0;}))return wares[i];",
    mustFail: T },
  { label: "the rung never steps aside (every ware held still offers the first)",
    find: "  return null;\n}\n// ── #157: the inventory category registry", replace: "  return (wares&&wares[0])||null;\n}\n// ── #157: the inventory category registry",
    mustFail: T }
]});
process.exit(rc ? 1 : 0);
