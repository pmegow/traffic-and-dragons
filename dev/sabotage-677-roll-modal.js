// dev/sabotage-677-roll-modal.js — proves the roll modal's guards (#677): the modal in place of the buttons, no Escape,
// Car Mode skipped, a refused take keeps the modal, the rebuild door, the escaped label, exactly two ways out, the Car Mode exit.
//   node dev/sabotage-677-roll-modal.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "class bible"]];   /* the SECTION the #677 test sits in (after #391); a filter names sections, not tests */
var rc = 0;
rc |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the check's label (model text) lands in the modal unescaped", mustFail: "#677",
    find: "margin-bottom:6px;'>\"+escHtml(chk.label)+\"</div>", replace: "margin-bottom:6px;'>\"+chk.label+\"</div>" },
  { label: "a third way out appears on the modal", mustFail: "#677",
    find: "<button class='qa' id='roll-modal-hold'", replace: "<button class='qa' id='roll-modal-later'>Later</button><button class='qa' id='roll-modal-hold'" }
]});
rc |= sabotage.prove({ file: "game.js", command: CMD, cases: [
  { label: "the buttons branch no longer opens the modal (the die is back to a line in the story)", mustFail: "#677",
    find: 'worldState.lastActions=null;if(typeof showRollModal==="function")showRollModal();return;}', replace: 'worldState.lastActions=null;return;}' }
]});
rc |= sabotage.prove({ file: "ui-modals.js", command: CMD, cases: [
  { label: "Escape closes the roll modal — typing is open again", mustFail: "#677",
    find: 'modalShell("roll-modal",rollModalHtml(chk),{wireClose:false,noEscape:true', replace: 'modalShell("roll-modal",rollModalHtml(chk),{wireClose:false,noEscape:false' },
  { label: "Car Mode gets the modal over its own screen", mustFail: "#677",
    find: '  if(typeof carMode!=="undefined"&&carMode)return false;\n  modalShell("roll-modal"', replace: '  modalShell("roll-modal"' },
  { label: "a refused take (busy) closes the modal and strands the check", mustFail: "#677",
    find: 'if(busy){showToast("One moment — the turn is still landing.");return;}', replace: '' }
]});
rc |= sabotage.prove({ file: "ui-boot.js", command: CMD, cases: [
  { label: "a reload becomes the way out — the rebuild no longer reopens the modal", mustFail: "#677",
    find: 'if(worldState.pendingCheck&&typeof showRollModal==="function")showRollModal();', replace: '' }
]});
rc |= sabotage.prove({ file: "ui-carmode.js", command: CMD, cases: [
  { label: "leaving Car Mode leaves a waiting roll with no door", mustFail: "#677",
    find: 'function hideCarMode() { carSessionStop(); if (typeof showRollModal === "function") showRollModal(); }', replace: 'function hideCarMode() { carSessionStop(); }' }
]});
process.exit(rc);
