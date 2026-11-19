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
    find: "if(!campaignStill(_synMark,\"the story so far\")){", replace: "if(false){", mustFail: X2 },
  { label: "X2: a dropped recap leaves the recap lock set",
    find: "{if(tick)tick.stop();_synopsisBusy=false;if(typeof opts.onDone", replace: "{if(tick)tick.stop();if(typeof opts.onDone", mustFail: X2 },
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
    find: "  bp=next;bpDoc++;editionBaseline=BlueprintEdition.baseline(bp);", replace: "  bp=next;editionBaseline=BlueprintEdition.baseline(bp);",
    mustFail: "FAIL #777 designer browser X7: a review of one blueprint is not attached to the blueprint opened while it ran" }
]);

// The independent review of this batch (commit ad48e8d6).
camp("game.js", [
  { label: "review: New game does not ask busy again at the confirm",
    find: "if(busy){if(typeof showToast===\"function\")showToast(\"Finish the current turn first.\");return;}/* #777 review of X8", replace: "if(false){if(typeof showToast===\"function\")showToast(\"Finish the current turn first.\");return;}/* #777 review of X8",
    mustFail: "FAIL #777 X8: New game asks again at the confirm" },
  { label: "review: a dropped recap never tells its caller it ended",
    find: "if(typeof opts.onDone===\"function\")opts.onDone(false);/* #777 review", replace: "/* #777 review",
    mustFail: "FAIL #777 X2: the recap written for campaign A is not put in campaign B's journal" },
  { label: "review: the expected stale race is filed as an error report",
    find: "if(e.message!==\"stale\"&&typeof reportError===\"function\")reportError(\"actions\"", replace: "if(typeof reportError===\"function\")reportError(\"actions\"",
    mustFail: "FAIL #777 X4: buttons suggested for campaign A are not saved into campaign B at the same turn number" },
  { label: "review: the sheet lock is keyed by name alone",
    find: "var _shKey=(worldState.campId||\"\")+\"|\"+npcName;", replace: "var _shKey=npcName;",
    mustFail: "FAIL #777 X3: campaign B's Bram can be given a sheet while campaign A's is still being written" }
]);
camp("ui-browsers.js", [
  { label: "review: the imported-character Begin does not ask busy again at the confirm",
    find: "if(typeof busy!==\"undefined\"&&busy){showToast(\"Finish the current turn first.\");return;}/* #777 review of X8", replace: "if(false){showToast(\"Finish the current turn first.\");return;}/* #777 review of X8",
    mustFail: "FAIL #777 X8: New game asks again at the confirm" }
]);
designer([
  { label: "review: a failed fix request stamps its error on the blueprint opened since",
    find: "if(bpDoc!==_fixDoc){setStatus(\"Another blueprint was opened while the fix was being written — nothing was applied.\",\"err\");return \"another blueprint was opened\";}", replace: "",
    mustFail: "FAIL #777 designer browser X7: a fix request that FAILS after another blueprint was opened stamps no error on that blueprint" },
  { label: "review: Apply selected does not say it stopped",
    find: "if(bpDoc!==_allDoc){setStatus(\"Another blueprint was opened while the selected fixes", replace: "if(false){setStatus(\"Another blueprint was opened while the selected fixes",
    mustFail: "FAIL #777 designer browser X7: Apply selected stops when another blueprint is opened" },
  { label: "review: a queued group is started against the blueprint opened mid-run",
    find: "      if(bpDoc!==_allDoc)return;/* the queued indices belong to a blueprint that is no longer open */\n", replace: "",
    mustFail: "FAIL #777 designer browser X7: Apply selected stops when another blueprint is opened" },
  { label: "review: a finished fix is recorded on the blueprint opened mid-run",
    find: "      if(bpDoc!==_allDoc)return;\n      var bf=bp.review.findings[idx];", replace: "      var bf=bp.review.findings[idx];",
    mustFail: "FAIL #777 designer browser X7: Apply selected ends cleanly when the blueprint opened mid-run has no review" }
]);

if (!chrome.path && !failed) { verdict.reportSkip("sabotage-777-campaign.js", browserClauses, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
