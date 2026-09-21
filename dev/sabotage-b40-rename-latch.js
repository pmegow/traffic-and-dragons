// dev/sabotage-b40-rename-latch.js — proves the B40 guard is guarded: the rename input's single-fire latch (a second
// blur/Enter must no-op), Escape cancelling instead of saving, no listener calling campSaveRename directly, the
// missing-input guard, and the modal shell staying free of a pre-removal blur (which would append a second overlay).
// Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-b40-rename-latch.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "B40 rename"]], cases: cases }); }
prove("ui-campaigns.js", [
  { label: "the latch is removed — the second event fires the save again",
    find: 'function commit(save){if(done)return;done=true;if(save)campSaveRename(id);else showCampaignPicker();}', replace: 'function commit(save){if(save)campSaveRename(id);else showCampaignPicker();}',
    mustFail: "B40 campStartRename" },
  { label: "Escape saves again instead of cancelling",
    find: 'if(e.key==="Escape")commit(false);', replace: 'if(e.key==="Escape")commit(true);',
    mustFail: "B40 campStartRename" },
  { label: "blur bypasses the latch",
    find: 'inp.addEventListener("blur",function(){commit(true);});', replace: 'inp.addEventListener("blur",function(){campSaveRename(id);});',
    mustFail: "B40 campStartRename" },
  { label: "Enter bypasses the latch",
    find: 'if(e.key==="Enter")commit(true);', replace: 'if(e.key==="Enter")campSaveRename(id);',
    mustFail: "B40 campStartRename" },
  { label: "campSaveRename loses its missing-input guard",
    find: 'var inp=document.getElementById("camp-rename-"+id);if(!inp)return;', replace: 'var inp=document.getElementById("camp-rename-"+id);',
    mustFail: "B40 campStartRename" }
]);
prove("ui-shell.js", [
  { label: "modalShell blurs before removing (a re-rendering blur handler would append a second overlay)",
    find: 'var ex=document.getElementById(id);if(ex)ex.remove();', replace: 'var ex=document.getElementById(id);if(ex){if(ex.contains(document.activeElement))document.activeElement.blur();ex.remove();}',
    mustFail: "B40 campStartRename" }
]);
process.exit(code);
