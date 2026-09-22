// dev/sabotage-430-ledger-rows-live.js — proves the #430 guards are guarded: the ledger rows never bake the busy
// flag into their paint, the click-time gate refuses while busy (loudly), a missing opener refuses instead of
// throwing, and both call sites pass a NAME the gate can resolve. Each mutation runs in a disposable clone
// (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-430-ledger-rows-live.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, command, cases) { if (!code) code = sabotage.prove({ file: file, command: command, cases: cases }); }
prove("ui-panels.js", ["node", ["dev/tests-430-ledger-rows-live.js"]], [
  { label: "the paint bakes busy in again (the field failure: rows dead after every turn)",
    find: '  return \'<div class="ii inv-ledger" data-open="\'+escHtml(name)+\'" onclick="invLedgerOpen(this.dataset.open)"',
    replace: '  var b=(typeof busy!=="undefined"&&!!busy);\n  return \'<div class="ii inv-ledger" data-open="\'+escHtml(name)+\'"\'+(b?\'\':\' onclick="invLedgerOpen(this.dataset.open)"\')+\'',
    mustFail: "painted DURING a turn" },
  { label: "the gate no longer checks busy",
    find: '  if(typeof busy!=="undefined"&&busy){if(typeof showToast==="function")showToast("Wait for the turn to finish",3000);return false;}\n', replace: '',
    mustFail: "refuses loudly and opens nothing" },
  { label: "the busy refusal is silent",
    find: 'if(typeof busy!=="undefined"&&busy){if(typeof showToast==="function")showToast("Wait for the turn to finish",3000);return false;}', replace: 'if(typeof busy!=="undefined"&&busy){return false;}',
    mustFail: "refuses loudly and opens nothing" },
  { label: "a missing opener throws from the inline onclick",
    find: '  if(typeof fn!=="function"){if(typeof showToast==="function")showToast("⚠ "+name+" is not available",4000);return false;}\n', replace: '',
    mustFail: "missing from the page" },
  { label: "the chest call site passes a call string again",
    find: '_invLedgerRow("showStashModal","', replace: '_invLedgerRow("showStashModal()","',
    mustFail: "painted DURING a turn" },
  { label: "the counter call site passes a call string again",
    find: '_invLedgerRow("showShopModal","', replace: '_invLedgerRow("showShopModal()","',
    mustFail: "painted DURING a turn" }
]);
process.exit(code);
