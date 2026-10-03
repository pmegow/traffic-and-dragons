// dev/sabotage-597-ledger-direct.js — proves the #597 guards: the counter and the chest land through ledgerApply (never the
// parser), a stale plan is refused WHOLE before anything moves, a sale still retires the keeper's want and prunes the worn
// list, a trade ends the chance to undo, and the undo's sentence is the engine's (a row-only placement is never "back
// with you"). Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-597-ledger-direct.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#597 the counter writes state directly"]], cases: cases }); }
prove("game.js", [
  { label: "the counter reaches the parser again",
    find: "  var R=ledgerApply(plan,{key:cat.key}),muts=R.muts;/* #597 */", replace: "  var R=ledgerApply(plan,{key:cat.key}),muts=R.muts;applyMuts(\"\",{deferSave:true});",
    mustFail: "#597 ① the counter, the chest and the undo never reach applyMuts" },
  { label: "the pack is no longer checked before a removal (a stale plan lands half)",
    find: "for(j=0;j<l.qty;j++)if(!removeInventoryItem(sim,l.name))return {ok:false,reason:(j?\"only \"+j+\" of \"+l.name+\" x\"+l.qty+\" is in the pack\":l.name+\" is no longer in the pack\")+\" — nothing moved\",muts:[]};",
    replace: "for(j=0;j<0;j++)if(!removeInventoryItem(sim,l.name))return {ok:false,reason:(j?\"only \"+j+\" of \"+l.name+\" x\"+l.qty+\" is in the pack\":l.name+\" is no longer in the pack\")+\" — nothing moved\",muts:[]};",
    mustFail: "#597 ② a stale plan is refused WHOLE" },
  { label: "the chest row is no longer checked before a take",
    find: "if(have<l.qty)return {ok:false,reason:(have?\"only \"+have+\" of \"+l.name+\" x\"+l.qty+\" is in the chest\":l.name+\" is no longer in the chest\")+\" — nothing moved\",muts:[]};",
    replace: "if(false)return {ok:false,reason:(have?\"only \"+have+\" of \"+l.name+\" x\"+l.qty+\" is in the chest\":l.name+\" is no longer in the chest\")+\" — nothing moved\",muts:[]};",
    mustFail: "#597 ② a stale plan is refused WHOLE" },
  { label: "the purse is no longer checked (a short purse goes negative)",
    find: "  if(net>0&&(Number(c.coin)||0)<net)return {ok:false,reason:\"short \"+fmtCoin(net-(Number(c.coin)||0))+\" — nothing moved\",muts:[]};/* #598: copper */", replace: "",
    mustFail: "#597 ② a stale plan is refused WHOLE" },
  { label: "a sale no longer retires the keeper's want",
    find: "var w=(typeof retireWantedAt===\"function\")?retireWantedAt({key:key},ln.name):null;", replace: "var w=null;",
    mustFail: "#597 ③ what the tag path did for a sale is kept" },
  { label: "a sold item stays on the worn list",
    find: "  if(typeof wornPrune===\"function\")wornPrune(c);\n  if(moved&&R.moveGrp)", replace: "  if(moved&&R.moveGrp)",
    mustFail: "#597 ③ what the tag path did for a sale is kept" },
  { label: "a trade no longer ends the chance to undo the stow before it",
    find: "if(moved&&R.moveGrp)worldState.stashUndoGrp=R.moveGrp;else delete worldState.stashUndoGrp;", replace: "if(moved&&R.moveGrp)worldState.stashUndoGrp=R.moveGrp;",
    mustFail: "#597 ③ what the tag path did for a sale is kept" },
  { label: "the ledger forgets the provenance ring",
    find: "  ledgerLog(muts,\"ledger\");", replace: "",
    mustFail: "#597 ① the counter, the chest and the undo never reach applyMuts" },
  { label: "a row-only undo says the item is back with you again",
    find: "  if(!e.pack)return nm+\" is off the record here — the story placed it; nobody's pack held it.\";", replace: "",
    mustFail: "#597 ④ the undo's sentence is the engine's" },
  { label: "a companion's pack half returns to the hero",
    find: "  var hero=worldState.character&&worldState.character.name,sh=e.pack?stashActorSheet(e.by||hero):null,j,qs=e.units>1?\" x\"+e.units:\"\";",
    replace: "  var hero=worldState.character&&worldState.character.name,sh=e.pack?stashActorSheet(hero):null,j,qs=e.units>1?\" x\"+e.units:\"\";",
    mustFail: "#597 ④ the undo's sentence is the engine's" }
]);
prove("ui-carmode.js", [
  { label: "Car Mode words the undo itself again",
    find: "carNotify(_u.ok ? \"info\" : \"warn\", _u.ok ? \"Never mind — \" + _u.said : \"Nothing to undo — \" + _u.reason + \".\");",
    replace: "carNotify(_u.ok ? \"info\" : \"warn\", _u.ok ? \"Never mind — \" + _u.name + \" is back with you.\" : \"Nothing to undo — \" + _u.reason + \".\");",
    mustFail: "#597 ⑤ Car Mode speaks the engine's sentence" }
]);
process.exit(code);
