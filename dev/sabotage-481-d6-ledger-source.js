// dev/sabotage-481-d6-ledger-source.js — proves the #481 D6 guards are guarded: a ledger move (the chest, the counter) is the
// player's own hand, so it never raises the duplicate-item alarm nor asks the GM to define the item, while a GM grant keeps
// both. Each clause removes one rule and the "#481 D6 ledger moves" tests must fail. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d6-ledger-source.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D6"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "the ledger policy raises the duplicate alarm again",
    find: "  ledger:{dupAlarm:false,defineAsk:false}\n", replace: "  ledger:{dupAlarm:true,defineAsk:false}\n",
    mustFail: "no duplicate grant" },
  { label: "the ledger policy asks the GM to define the item again",
    find: "  ledger:{dupAlarm:false,defineAsk:false}\n", replace: "  ledger:{dupAlarm:false,defineAsk:true}\n",
    mustFail: "asks the GM to define nothing" },
  { label: "the hero's grant ignores the policy",
    find: "if(mutPolicy(R).dupAlarm)duplicateItemGrantWarning(worldState.character.inventory,", replace: "duplicateItemGrantWarning(worldState.character.inventory,",
    mustFail: "no duplicate grant" },
  { label: "an unknown source is silent",
    find: "if(!MUT_SOURCES.hasOwnProperty(_src)){if(typeof console!==\"undefined\")console.warn(", replace: "if(!MUT_SOURCES.hasOwnProperty(_src)){if(false)console.warn(",
    mustFail: "an unknown source warns" }
]);
prove("api.js", [
  { label: "the source never reaches the table",
    find: "applyMutsTable(_w2Plan.ordinary,{deferCommit:true,source:(opts&&opts.source)||null})", replace: "applyMutsTable(_w2Plan.ordinary,{deferCommit:true})",
    mustFail: "no duplicate grant" },
  { label: "the provenance ring forgets the ledger",
    find: "    if(R.source&&R.source!==\"gm\")_tlEntry.src=R.source;", replace: "",
    mustFail: "the provenance ring names the ledger" }
]);
prove("game.js", [
  { label: "the chest applies as a GM turn",
    find: "var R=applyMuts(stashTradeTagText(plan),{deferSave:true,source:\"ledger\"}),", replace: "var R=applyMuts(stashTradeTagText(plan),{deferSave:true}),",
    mustFail: "no duplicate grant" },
  { label: "the counter applies as a GM turn",
    find: "var R=applyMuts(shopTradeTagText(plan),{deferSave:true,source:\"ledger\"}),", replace: "var R=applyMuts(shopTradeTagText(plan),{deferSave:true}),",
    mustFail: "a counter buy is no duplicate grant" }
]);
process.exit(code);
