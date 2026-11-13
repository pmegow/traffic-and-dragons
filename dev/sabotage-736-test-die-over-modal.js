// dev/sabotage-736-test-die-over-modal.js — proves the #736 guards: "Roll a test d20" throws the die ABOVE the Dice
// appearance modal, which stays open and takes every click, and closing the modal sends the die away. Each clause plants
// one regression; the named check of dev/tests-669-live-dice-browser.js must fail. Needs Chrome (skipped, said, without it).
//   node dev/sabotage-736-test-die-over-modal.js      (browser driver: dev/cdp-browser.js)
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js"), chrome = require("./cdp-browser.js").locateChrome();
var OVER = "FAIL Roll a test d20 rolls over the Dice appearance modal";
var CMD = ["node", ["dev/tests-669-live-dice-browser.js"]];
var dice = [
  { label: "the test roll closes the modal again (the player is returned to the game)",
    find: "    showDiceRoll(1+Math.floor(Math.random()*20),{over:true});",
    replace: "    modal.remove();showDiceRoll(1+Math.floor(Math.random()*20),{over:true});", mustFail: OVER },
  { label: "the test die is thrown under the modal, on the story behind the backdrop",
    find: "    showDiceRoll(1+Math.floor(Math.random()*20),{over:true});",
    replace: "    showDiceRoll(1+Math.floor(Math.random()*20));", mustFail: OVER },
  { label: "closing the modal leaves the test die on screen, where no click can dismiss it",
    find: "onClose:function(){modal.remove();diceLiveOverEnd();}});",
    replace: "onClose:function(){modal.remove();}});", mustFail: OVER }
];
var page = [
  { label: "the layer above the modal takes the clicks: the looks cannot be browsed",
    find: "#dice-layer.over{z-index:310;pointer-events:none;cursor:default}",
    replace: "#dice-layer.over{z-index:310;cursor:default}", mustFail: OVER },
  { label: "the layer is not lifted above the modal",
    find: "#dice-layer.over{z-index:310;pointer-events:none;cursor:default}",
    replace: "#dice-layer.over{pointer-events:none;cursor:default}", mustFail: OVER }
];
var failed = sabotage.prove({ file: "ui-dice.js", skip: !chrome.path, command: CMD, cases: dice });
if (!failed) failed = sabotage.prove({ file: "index.html", skip: !chrome.path, command: CMD, cases: page });
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-736-test-die-over-modal.js", dice.length + page.length, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
