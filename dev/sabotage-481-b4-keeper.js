// dev/sabotage-481-b4-keeper.js — proves the #481 B4 keeper-of-record guards are guarded (owner ruling 2026-09-29: "a shop's
// owner counts as present while the shop is open"; built 2026-09-30). The tag files only a living, rostered keeper on a real
// shop; the trade gate counts the keeper while open, refuses a closed shop with no one in the scene, and drops the stale
// sighting once a keeper is on record; no hours = open; the ask latches once and teaches the syntax; the geo block names the
// keeper; a merge carries it; the tag is stripped and engine-only. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-b4-keeper.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B4 keeper"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "the tag never files the keeper",
    find: "var prev=node.keeper;node.keeper=npc.name;R.muts.push(", replace: "var prev=node.keeper;R.muts.push(",
    mustFail: "files the keeper on the shop where it happens" },
  { label: "a name not on the roster is filed as it is",
    find: "else if(!npc)why=\"\\\"\"+raw+\"\\\" is not on the roster (name them with [NPC:] first)\";", replace: "else if(!npc)npc={name:raw};",
    mustFail: "refused out loud and files nothing" },
  { label: "a dead keeper is filed",
    find: "else if(npcIsDead(npc))why=npc.name+\" is dead\";", replace: "else if(false)why=\"\";",
    mustFail: "refused out loud and files nothing" },
  { label: "any place takes a keeper (the Hall is not a shop)",
    find: "else if(!node||typeof isShopNode!==\"function\"||!isShopNode(key,node))why=leaf+\" is not a shop\";", replace: "else if(!node)why=leaf+\" is not a shop\";",
    mustFail: "refused out loud and files nothing" },
  { label: "the tag leaks to the player (not stripped)",
    find: "\"LOCATION_HOURS\",\"SHOP_KEEPER\",\"LAYOUT\",", replace: "\"LOCATION_HOURS\",\"LAYOUT\",",
    mustFail: "the tag is stripped and engine-only" },
  { label: "the standing doc teaches the tag to every campaign (it leaves the engine-only tier)",
    find: "\"COMPANION_ITEM_KEPT\",\"SHOP_KEEPER\"];", replace: "\"COMPANION_ITEM_KEPT\"];",
    mustFail: "the tag is stripped and engine-only" }
]);
prove("helpers.js", [
  { label: "the keeper is never counted at the counter (a stale keeper cannot trade while open)",
    find: "if(_kOpen)local.unshift(", replace: "if(false)local.unshift(",
    mustFail: "trades while the shop is open, and not while it is closed" },
  { label: "the hours are ignored (a closed shop trades)",
    find: "_kOpen=_kName?shopOpenNow(node):true;", replace: "_kOpen=true;",
    mustFail: "trades while the shop is open, and not while it is closed" },
  { label: "a keeper's shop still opens to a stale sighting of someone else",
    find: "if(_kName){local=_arrived?_spk.slice():(man.local||[]).concat(_spk);", replace: "if(_kName){local=_arrived?_spk.slice():(man.seenHere||man.local||[]).concat(_spk);",
    mustFail: "a stale sighting of anyone else no longer opens it" },
  { label: "no hours on record reads as closed",
    find: "  if(!node||!node.hours||typeof clockMinuteOfDay!==\"function\")return true;", replace: "  if(!node||!node.hours||typeof clockMinuteOfDay!==\"function\")return false;",
    mustFail: "trades while the shop is open, and not while it is closed" }
]);
prove("api.js", [
  { label: "the keeper ask never latches (it repeats every turn)",
    find: "  worldState.keeperAsk={node:key,turn:worldState.turn};\n", replace: "",
    mustFail: "the keeper ask: once per shop" },
  { label: "the geo block never names the keeper",
    find: "  if(subNode&&subNode.keeper)lines.push(\"Keeper: \"+", replace: "  if(false)lines.push(\"Keeper: \"+",
    mustFail: "the geo block names a shop's keeper" }
]);
prove("memory.js", [
  { label: "a merge drops the keeper",
    find: "  {k:\"keeper\",fold:\"canon-wins\"},", replace: "",
    mustFail: "a merge keeps the keeper" }
]);
process.exit(code);
