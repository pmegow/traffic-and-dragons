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
    find: 'if(busy){showToast("One moment — the turn is still landing.");return;}', replace: '' },
  { label: "the die is no longer laid out ready when the modal opens (dice-sim 0.80.0)", mustFail: "#677",
    find: '  if(typeof diceLivePresent==="function")diceLivePresent([{type:"d20"}],chk.label);', replace: '' },
  { label: "a Roll clears the ready die before throwing it — it rolls in from the edge, never from where it lay", mustFail: "#677",
    find: "closeRollModal(true);fn();", replace: "closeRollModal();fn();" },
  { label: "Hold back leaves the ready die lying on the story", mustFail: "#677",
    find: '    if(typeof diceLiveUnpresent==="function")diceLiveUnpresent();/* a die still lying ready', replace: '    /* a die still lying ready' },
  { label: "the car screen's close keeps the die lying under it", mustFail: "#677",
    find: 'if(!keepDie&&typeof diceLiveUnpresent==="function")diceLiveUnpresent();}', replace: '}' }
]});
rc |= sabotage.prove({ file: "ui-dice.js", command: CMD, cases: [
  { label: "a roll leaves the layer lifted and click-proof — the thrown die can never be dismissed", mustFail: "#677",
    find: 'layer.classList.remove("leaving");layer.classList.remove("ready");layer.classList.add("on");', replace: 'layer.classList.remove("leaving");layer.classList.add("on");' },
  { label: "the ready die is laid out without lifting the layer — it lies under the modal's backdrop", mustFail: "#677",
    find: 'layer.classList.add("on");layer.classList.add("ready");', replace: 'layer.classList.add("on");' }
]});
rc |= sabotage.prove({ file: "index.html", command: CMD, cases: [
  { label: "the lifted layer takes the clicks — the modal's buttons cannot be pressed", mustFail: "#677",
    find: "#dice-layer.ready{z-index:310;pointer-events:none;cursor:default}", replace: "#dice-layer.ready{z-index:310;cursor:default}" },
  { label: "the lifted layer paints under the modal's backdrop", mustFail: "#677",
    find: "#dice-layer.ready{z-index:310;", replace: "#dice-layer.ready{z-index:40;" }
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
