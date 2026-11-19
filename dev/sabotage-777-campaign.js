// sabotage-777-campaign.js — retained proof for audit 2026-11-19 (TODO #777), section X: a model call that outlives its
// campaign writes nothing.
//   state.js      campaignMark / campaignStill / campaignEpochBump, and the bump at every door
//   memory.js     X1 the era compile and merge
//   game.js       X2 the story so far, X3 a companion's sheet, X4 the suggestion buttons
//   X5 the last action; X8 Begin under a running generation (char-creation.js)
//   dev/class-guards.js   the two derived rules
//   blueprint-designer.html   X6 Generate, X7 Review and Apply (Chrome: dev/cdp-browser.js — skipped out loud without it)
// Each engine clause runs ONE named case of dev/tests-777-campaign.js (the suite's own --only).
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var CAMP = ["node", ["dev/tests-777-campaign.js"]], ONLY = "FAIL #777 ";
var DESIGNER = ["node", ["dev/tests-777-designer-browser.js"]];
var failed = 0, browserClauses = 0;
function camp(file, cases) { failed += sabotage.prove({ file: file, command: CAMP, only: ONLY, cases: cases }); }
function designer(cases) { browserClauses += cases.length; failed += sabotage.prove({ file: "blueprint-designer.html", command: DESIGNER, cases: cases, skip: !chrome.path }); }

var MECH = "FAIL #777 X: a mark survives the turn's own clone-and-replace";
camp("state.js", [
  { label: "X: a mark is never ended (the epoch is ignored)",
    find: "mark.epoch===_campEpoch&&((worldState.campId||null)===mark.id)", replace: "((worldState.campId||null)===mark.id)", mustFail: MECH },
  { label: "X: a mark taken with no campaign open allows a write",
    find: "var ok=!!mark&&mark.live&&!!worldState&&", replace: "var ok=!!mark&&", mustFail: MECH },
  { label: "X: a refused write is not logged",
    find: "if(!ok&&what&&typeof console!==\"undefined\")console.warn(\"[campaign] \"", replace: "if(false)console.warn(\"[campaign] \"", mustFail: MECH },
  { label: "X: a load of the same campaign does not end the mark",
    find: "  campaignEpochBump();/* audit X: whatever loads (or fails to) from here on is another state than the one a side call started in */\n", replace: "", mustFail: MECH },
  { label: "X: a camp restore does not end the mark",
    find: "  campaignEpochBump();/* audit X: the camp is an older copy of this campaign — a side call started before the death does not belong in it */\n", replace: "", mustFail: MECH },
  { label: "X: an import that reuses the open id does not end the mark",
    find: "  campaignEpochBump();/* audit X: an import that reuses the open campaign's id is still another state */\n", replace: "", mustFail: MECH },
  { label: "X5: the last action survives a campaign load",
    find: "if(typeof lastAction!==\"undefined\"){lastAction=null;", replace: "if(false){lastAction=null;",
    mustFail: "FAIL #777 X5: the last action does not survive a campaign load" }
]);
camp("storage-adapter.js", [
  { label: "X: the cloud adopt does not end the mark",
    find: "if (typeof campaignEpochBump === \"function\") campaignEpochBump();   /* audit X: the adopted cloud copy", replace: "if (false) campaignEpochBump();   /* audit X: the adopted cloud copy",
    mustFail: "FAIL #777 X: the cloud adopt (a newer copy of the SAME campaign) ends the mark" }
]);
var X1 = "FAIL #777 X1: an era compiled for campaign A is not written into campaign B";
camp("memory.js", [
  { label: "X1: campaign A's era is written into campaign B",
    find: "      if(!campaignStill(_eraMark,\"the era compile\")){_eraBusy=false;return;}\n", replace: "", mustFail: X1 },
  { label: "X1: a dropped era leaves the era lock set for the session",
    find: "if(!campaignStill(_eraMark,\"the era compile\")){_eraBusy=false;return;}", replace: "if(!campaignStill(_eraMark,\"the era compile\")){return;}", mustFail: X1 },
  { label: "X1: the mark is taken after the call (it is the new campaign's)",
    find: "      if(!campaignStill(_eraMark,\"the era compile\")){", replace: "      _eraMark=campaignMark();if(!campaignStill(_eraMark,\"the era compile\")){", mustFail: X1 }
]);
var X2 = "FAIL #777 X2: the recap written for campaign A is not put in campaign B's journal";
var X3 = "FAIL #777 X3: a sheet generated for campaign A's Bram is not attached to campaign B's Bram";
camp("game.js", [
  { label: "X2: campaign A's recap is written into campaign B",
    find: "if(!campaignStill(_synMark,\"the story so far\")){if(tick)tick.stop();_synopsisBusy=false;return false;}", replace: "", mustFail: X2 },
  { label: "X2: a dropped recap leaves the recap lock set",
    find: "{if(tick)tick.stop();_synopsisBusy=false;return false;}", replace: "{if(tick)tick.stop();return false;}", mustFail: X2 },
  { label: "X3: campaign A's sheet and spell definitions land in campaign B",
    find: "if(!campaignStill(_shMark,\"the sheet for \"+npcName))_shLeft=true;", replace: "if(false)_shLeft=true;", mustFail: X3 },
  { label: "X3: a failed request for A gives B's companion the stub sheet",
    find: "if(!campaignStill(_shMark,\"the sheet for \"+npcName+\" (its request failed)\"))_shLeft=true;", replace: "",
    mustFail: "FAIL #777 X3: a failed request for campaign A's Bram does not give campaign B's Bram the stub sheet" },
  { label: "X3: the sheet is dropped in its own campaign too",
    find: "  if(_shLeft)return;/* not even the stub", replace: "  if(true)return;/* not even the stub",
    mustFail: "FAIL #777 X3: with no switch the sheet is attached as before" },
  { label: "X4: the buttons are judged by the turn number alone again",
    find: "if(!campaignStill(_actMark,null)||worldState.turn!==turnAt)throw new Error(\"stale\");", replace: "if(worldState.turn!==turnAt)throw new Error(\"stale\");",
    mustFail: "FAIL #777 X4: buttons suggested for campaign A are not saved into campaign B" }
]);
camp("char-creation.js", [
  { label: "X8: Begin starts a game under a running generation",
    find: "  if(typeof busy!==\"undefined\"&&busy){if(typeof showToast===\"function\")showToast(\"Something is still being generated", replace: "  if(false){if(typeof showToast===\"function\")showToast(\"Something is still being generated",
    mustFail: "FAIL #777 X8: Begin does nothing while a generation holds busy" }
]);
var GUARDS = "FAIL #777 X: the class guards";
camp("dev/class-guards.js", [
  { label: "X: the door rule leaves the class guards",
    find: ".concat(campaignDoorProblems(root))", replace: "", mustFail: GUARDS },
  { label: "X: the call-then-write rule leaves the class guards",
    find: ".concat(awaitThenWriteProblems(root))", replace: "", mustFail: GUARDS },
  { label: "X: a door that never bumps the epoch passes",
    find: "      if (/campaignEpochBump\\s*\\(/.test(fn.body)) continue;", replace: "      if (true) continue;", mustFail: GUARDS },
  { label: "X: a .push or a save after the model call does not count as a write",
    find: "\\.push\\(|\\.splice\\(|\\.unshift\\()|\\bsave(?:Core|Mem|All)\\s*\\(/;", replace: "\\.splice\\(|\\.unshift\\()/;", mustFail: GUARDS },
  { label: "X: an exemption the source no longer needs is kept without a word",
    find: "  reg.awaits.forEach(function (e) { if (!awaits.some(", replace: "  [].forEach(function (e) { if (!awaits.some(", mustFail: GUARDS }
]);

designer([
  { label: "X6: a generated draft replaces the working copy after its window was closed",
    find: "if(bpDoc!==_genDoc||!document.body.contains(wrap))throw", replace: "if(bpDoc!==_genDoc)throw",
    mustFail: "FAIL #777 designer browser X6: a draft that arrives after its window was closed replaces nothing" },
  { label: "X6: a generated draft replaces another blueprint opened under its window",
    find: "if(bpDoc!==_genDoc||!document.body.contains(wrap))throw", replace: "if(!document.body.contains(wrap))throw",
    mustFail: "FAIL #777 designer browser X6: a draft that arrives after ANOTHER blueprint was opened replaces nothing" },
  { label: "X7: a review's findings are attached to whichever blueprint is open",
    find: "    if(bpDoc!==_revDoc)throw new Error(\"another blueprint was opened", replace: "    if(false)throw new Error(\"another blueprint was opened",
    mustFail: "FAIL #777 designer browser X7: a review of one blueprint is not attached to the blueprint opened while it ran" },
  { label: "X7: a fix is applied to whichever blueprint is open",
    find: "if(bpDoc!==_fixDoc||!bp.review||!bp.review.findings[idx]){f.status=\"\";", replace: "if(false){f.status=\"\";",
    mustFail: "FAIL #777 designer browser X7: a fix written for one blueprint is not applied to the blueprint opened while it was written" },
  { label: "X6/X7: loading a blueprint is not counted as another document",
    find: "  bp=normalizeBlueprint(obj,{preserveProse:true});bpDoc++;", replace: "  bp=normalizeBlueprint(obj,{preserveProse:true});",
    mustFail: "FAIL #777 designer browser X7: a review of one blueprint is not attached to the blueprint opened while it ran" }
]);

if (!chrome.path && !failed) { verdict.reportSkip("sabotage-777-campaign.js", browserClauses, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
