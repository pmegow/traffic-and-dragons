// dev/sabotage-481-d8-item-ask-queue.js — proves the #481 D8 guards are guarded: every new undefined item gets its question
// (one per turn, in arrival order, restored on a dead turn), a waiting item defined meanwhile is skipped, and a dropped
// sixth proposal is said without consuming the ask. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d8-item-ask-queue.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D8"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "the slot is last-wins again (the first item is never asked)",
    find: "  if(!cur||!cur.key){worldState.itemDefCandidate={key:key,turn:worldState.turn||0};return;}", replace: "  {worldState.itemDefCandidate={key:key,turn:worldState.turn||0};return;}",
    mustFail: "two new items in one reply" },
  { label: "the waiting item is never promoted",
    find: "  _itemDefPromote();/* #481 D8: the next waiting item is next turn's ask */", replace: "",
    mustFail: "two new items in one reply" },
  { label: "a dead turn loses the queue (not a registered latch) — the #151 latch census names it before any test runs",
    find: "\"itemDefCandidate\",\"itemDefQueue\",/* #481 D8 */", replace: "\"itemDefCandidate\",",
    mustFail: "itemDefQueue" },
  { label: "a queued item is asked however long it waited",
    find: "    if(now-(nx.turn||0)>ITEM_DEF_QUEUE_STALE_TURNS){", replace: "    if(false){",
    mustFail: "a queued item that waited past its moment" },
  { label: "an item the GM proposed meanwhile is asked anyway",
    find: "  while(cand&&cand.key&&!_itemDefOpen(cand.key)){", replace: "  while(false){",
    mustFail: "a waiting item the GM defines meanwhile is not asked again" }
]);
prove("tag_table.js", [
  { label: "a sixth proposal drops silently again",
    find: "R.muts.push(\"⚠ Item canon proposal dropped — '\"+idName+\"': five proposals already await your confirmation (accept or decline them first)\");", replace: "",
    mustFail: "a sixth proposal is refused out loud" },
  { label: "the dropped proposal consumes the item's ask",
    find: "if(worldState.itemDefAsked)delete worldState.itemDefAsked[idKey];/* #481 D8: said in the summary line, and the item's ask is not consumed */", replace: "",
    mustFail: "a sixth proposal is refused out loud" }
]);
process.exit(code);
