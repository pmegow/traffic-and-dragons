// dev/sabotage-557-named-place.js — proves the #557 guard is guarded (owner ruling 2026-10-02: every named place the party
// stands in is a map node, outdoors included, in every kind). Disposable clones.
//   node dev/sabotage-557-named-place.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#207 hour-shapes-the-world rul"]];
rc |= sabotage.prove({ file: "data.js", command: CMD, cases: [
  { label: "the venue wording returns (open ground is the settlement again)",
    find: "entering ANY named place within the current location, indoors or out (a tavern, tower, warehouse, temple, shop, camp, colony, and just as much a yard, a square, a riverbank, a clearing, a bridge, a graveyard), REQUIRES [SUBLOCATION:name] in that same response",
    replace: "entering any named venue (a tavern, tower, warehouse, temple, shop, camp, colony) REQUIRES [SUBLOCATION:name] in that same response",
    mustFail: "the rule still limits [SUBLOCATION:] to venues" },
  { label: "the principle and its reason drop out of the rule",
    find: ": the party's place on the map is wherever they stand, whatever the description, so that place can be returned to later; only unnamed transit",
    replace: "; only unnamed transit",
    mustFail: "the rule must carry the owner's principle and its reason" }
]});
process.exit(rc ? 1 : 0);
