// dev/sabotage-620-chest-button.js — proves the #620 guards are guarded (owner 2026-10-12: "add a 'storage chest' button to the
// players' cottage in the village, it should function like the shop button, opening the chest interface"). The rule is ONE pure
// function (chestOpportunity: the stash gate — a kind with a stash, the hero in their OWN house); the button is the second row
// of FRAME_BUTTONS, painted by the same syncFrameButtons as Shop; both doors (the narration's button and the inventory panel's
// Stow-and-take row) read the rule. The browser clauses drive the real index.html through dev/cdp-browser.js; with no Chrome
// they are SKIPPED out loud (exit 78 + one SABOTAGE SKIPPED line) — never passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-620-chest-button.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var NODE = ["node", ["dev/run-tests.js", "#6 the village — phase E/F"]], BROWSER = ["node", ["dev/tests-501-shop-button-browser.js"]], failed = 0;
var T = "#620 the chest is reached";
var CHEST_ROW = '  {cls:"frame-chest",label:"Chest",rule:"chestOpportunity",opener:"showStashModal",title:function(op){return "Stow things in your house or take them with you \\u2014 "+op.house;}}';
// The rule.
failed += sabotage.prove({ file: "helpers.js", command: NODE, cases: [
  { label: "any answer from the stash gate counts, a refusal included (another resident's house gets a chest)",
    find: "  return (c&&c.ok)?{house:c.house}:null;", replace: "  return c?{house:c.house}:null;",
    mustFail: T },
  { label: "the rule stops asking the stash gate (a chest everywhere)",
    find: '  var c=(typeof stashTradeCatalog==="function")?stashTradeCatalog():null;', replace: '  var c={ok:true,house:"anywhere"};',
    mustFail: T }
]});
// One rule, two doors.
failed += sabotage.prove({ file: "ui-panels.js", command: NODE, cases: [
  { label: "the inventory panel's Stow-and-take row decides on its own again",
    find: 'var _co=(typeof chestOpportunity==="function"&&typeof showStashModal==="function")?chestOpportunity():null;', replace: 'var _co=(typeof stashTradeCatalog==="function"&&stashTradeCatalog().ok)?{house:1}:null;',
    mustFail: T }
]});
failed += sabotage.prove({ file: "ui-shell.js", command: NODE, cases: [
  { label: "the Chest row leaves the table (the node pin)",
    find: ",\n" + CHEST_ROW + "\n", replace: "\n",
    mustFail: T },
  { label: "a second painter comes back beside the table",
    find: "function syncFrameButtons(){", replace: "function syncShopButton(){}\nfunction syncFrameButtons(){",
    mustFail: T }
]});
// The button itself, in a real browser.
failed += sabotage.prove({ file: "ui-shell.js", skip: !chrome.path, command: BROWSER, cases: [
  { label: "the Chest row leaves the table (no button in the hero's own house)",
    find: ",\n" + CHEST_ROW + "\n", replace: "\n",
    mustFail: "own house: exactly one Chest button" },
  { label: "the Chest door reads the raw stash gate, a refusal included (another resident's house draws it)",
    find: 'rule:"chestOpportunity",', replace: 'rule:"stashTradeCatalog",',
    mustFail: "Daeris's house" }
]});
/* The click-time gate is pinned by the #501 node clause on the table's one onclick line (showStashModal carries its own busy
   guard, so a browser clause bypassing invLedgerOpen would change nothing the eye can see). */
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-620-chest-button.js", 2, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
