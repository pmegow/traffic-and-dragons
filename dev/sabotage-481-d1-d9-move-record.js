// dev/sabotage-481-d1-d9-move-record.js — proves the #481 D9 move record and the #481 D1 undo built on it are guarded. D9: a
// village move is recorded once (a ledger plan is ONE move), the sheet carries the mark of the moves it reflects, a refresh
// re-applies what a library copy never saw and nothing it already holds, legacy rows are counted loudly, eviction is loud.
// D1: the undo re-adds what the move took (Fable's named clause: "drop the inverse re-add"), is busy-gated, expires with the
// next applyMuts call, refuses when a half is gone, and applies through the undo source. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d1-d9-move-record.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, filter, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", filter]], cases: cases }); }
prove("memory.js", "#481 D9", [
  { label: "three GM placements of one item in one reply are three moves again (#597: a ledger plan is ONE entry by construction)",
    find: "  if(tail&&tail.grp===R.moveGrp&&tail.name===mv.name", replace: "  if(false&&tail.grp===R.moveGrp&&tail.name===mv.name",
    mustFail: "three GM placements of one item" },
  { label: "the sheet no longer carries its mark",
    find: "sh.stashMarks[stashMarkKey()]=e.at;", replace: "void 0;",
    mustFail: "the hero sheet carries the mark" },
  { label: "the village records no clock stamp",
    find: "    if(typeof kindDef===\"function\"&&kindDef().populateFromLibrary)e.at=Date.now();\n", replace: "",
    mustFail: "the move names what moved" },
  { label: "the adventure stamps the wall clock (non-deterministic replays)",
    find: "    if(typeof kindDef===\"function\"&&kindDef().populateFromLibrary)e.at=Date.now();\n", replace: "    e.at=Date.now();\n",
    mustFail: "no clock stamp and no sheet mark outside the village" },
  { label: "eviction is silent",
    find: "if(ev.at)console.warn(msg+", replace: "if(false)console.warn(msg+",
    mustFail: "the eviction names what a refresh loses" }
]);
prove("game.js", "#481 D9", [
  { label: "a refresh re-applies nothing (the duplication is back)",
    find: "    if(e.action===\"placed\"){for(j=0;j<e.pack.units;j++){if(removeInventoryItem(sheet.inventory,e.pack.name))out.applied++;", replace: "    if(false){for(j=0;j<e.pack.units;j++){if(removeInventoryItem(sheet.inventory,e.pack.name))out.applied++;",
    mustFail: "the spear stays in the chest" },
  { label: "a refresh ignores the copy's mark (the self-export loses a second charge)",
    find: "    if(!e.pack||(since!==null&&e.at<=since))continue;", replace: "    if(!e.pack)continue;",
    mustFail: "must not lose a second charge" },
  { label: "the legacy rows are not counted",
    find: "out.legacy+=(it.qty||1);", replace: "void 0;",
    mustFail: "two legacy units by the hero are counted" },
  { label: "the legacy count is silent",
    find: "    if(out.legacy&&typeof console!==\"undefined\")console.warn(", replace: "    if(false)console.warn(",
    mustFail: "the count is loud" },
  { label: "the legacy count repeats on every refresh",
    find: "  if(!worldState.stashLegacyCounted[sheet.name]){worldState.stashLegacyCounted[sheet.name]=true;", replace: "  if(true){",
    mustFail: "counted once" }
]);
prove("game.js", "#481 D1", [
  { label: "the undo drops the pack half (the Sihedron spear is destroyed again)",
    find: "    if(sh){for(j=0;j<e.pack.units;j++)addInventoryItem(sh.inventory,e.pack.name);", replace: "    if(false){for(j=0;j<e.pack.units;j++)addInventoryItem(sh.inventory,e.pack.name);",
    mustFail: "the spear is back with you" },
  { label: "the undo runs mid-turn",
    find: "  if(typeof busy!==\"undefined\"&&busy)return {ok:false,reason:\"wait for the turn to finish\"};\n  if(typeof worldState===\"undefined\"||!worldState)return {ok:false,reason:\"no campaign\"};",
    replace: "  if(typeof worldState===\"undefined\"||!worldState)return {ok:false,reason:\"no campaign\"};",
    mustFail: "a turn in flight refuses the undo" },
  { label: "the undo mints a unit the chest no longer holds",
    find: "  if(e.action===\"placed\"){if(held<e.units)return {ok:false,reason:e.name+\" is no longer in \"+leaf};}", replace: "  if(e.action===\"placed\"){}",
    mustFail: "must not mint a lantern" },
  { label: "the undone moves stay in the record (a refresh would replay them)",
    find: "  ring.splice(ring.length-grp.length,grp.length);delete worldState.stashUndoGrp;", replace: "  delete worldState.stashUndoGrp;",
    mustFail: "the undone move leaves the record" },
  { label: "the undo forgets the provenance ring (#597: it writes its own entry)",
    find: "  ledgerLog(muts,\"undo\");", replace: "",
    mustFail: "never mind after a stow" },
  { label: "a take is undone on the pack alone (the ropes never reach the chest)",
    find: "    fileLocationItem(e.name,\"placed\",worldState.turn,null,null,{key:e.key,units:e.units});muts.push(\"Left: \"", replace: "    muts.push(\"Left: \"",/* #599 (c): the count rides as an argument */
    mustFail: "all three ropes go back in ONE undo" },
  { label: "a sibling place cannot be reached from where you stand",
    find: "  if(e.key!==curKey&&(!node.parent||R2(node.parent)!==curWorld))return", replace: "  if(e.key!==curKey)return",
    mustFail: "the core comes back from the hall" },
  { label: "the undo lands half a group when the other half is gone (#597: checked whole first)",
    find: "  for(i=0;i<grp.length;i++){var chk=_stashUndoCheck(grp[i],curKey,curWorld);if(!chk.ok){", replace: "  for(i=0;i<0;i++){var chk=_stashUndoCheck(grp[i],curKey,curWorld);if(!chk.ok){",
    mustFail: "must not mint a lantern" }
]);
prove("api.js", "#481 D1", [
  { label: "the pointer outlives the next GM turn",
    find: "  if(R.moveGrp)worldState.stashUndoGrp=R.moveGrp;else delete worldState.stashUndoGrp;", replace: "  if(R.moveGrp)worldState.stashUndoGrp=R.moveGrp;",
    mustFail: "a GM turn later there is nothing to undo" }
]);
prove("tag_table.js", "#481 D9", [
  { label: "a chest take is not recorded",
    find: "if(_at&&_at.taken)stashMoveRecord(R,{name:_at.name,", replace: "if(false)stashMoveRecord(R,{name:_at.name,",
    mustFail: "a GM gain of what lies in the chest" },
  { label: "a stow records no pack half",
    find: "for(_mpi=0;_mpi<_mu;_mpi++){var _mpx=itemPairTake(", replace: "for(_mpi=0;_mpi<0;_mpi++){var _mpx=itemPairTake(",
    mustFail: "the move names what moved" }
]);
process.exit(code);
