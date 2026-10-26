// dev/sabotage-670-dice-exits.js — proves the #670 guards (the dice leave by an exit): Smoke puff until the player picks,
// the overlay told the exit at its start and at a change, an unknown saved exit replaced, a dismiss through dice-sim's
// dismiss, the damage dice rolling as the d20 leaves, the story clickable while the dice go, the layer kept for a newer
// roll, the choice in Dice appearance — each must turn the #670 section red.
//   node dev/sabotage-670-dice-exits.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#670"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ui-dice.js", [
  { label: "the dice leave at once by default", find: 'var DICE_EXIT_DEFAULT="smoke";', replace: 'var DICE_EXIT_DEFAULT="none";', mustFail: "Smoke puff until the player picks" },
  { label: "the overlay never told the exit", find: "look:diceLookStyle(),context:ctx||null,exit:diceExitName()});", replace: "look:diceLookStyle(),context:ctx||null});", mustFail: "the overlay is told the player's exit" },
  { label: "an unknown saved exit used", find: 'console.warn("live dice: the saved exit \\""+saved+"\\" is not one the dice have; using "+DICE_EXIT_DEFAULT);return DICE_EXIT_DEFAULT;', replace: "return saved;", mustFail: "an unknown saved exit is said and replaced" },
  { label: "the dismiss skips the exit", find: "overlay.dismiss().then(function(){", replace: "Promise.resolve().then(function(){", mustFail: "a dismiss plays the exit" },
  { label: "the damage dice wait", find: 'if(opts&&typeof opts.onClose==="function"){var rollDamage=opts.onClose;rollDamage();}/* the damage dice roll as the d20 leaves (owner 2026-10-26) */', replace: "", mustFail: "the damage dice roll as the d20 leaves" },
  { label: "a newer roll's layer hidden", find: "if(mine!==_diceLive.token)return;", replace: "", mustFail: "unless a newer roll took it" },
  { label: "no choice kept", find: 'sel.addEventListener("change",function(){diceExitChoose(sel.value);});', replace: "", mustFail: "a choice is kept" },
  { label: "the overlay keeps the old exit", find: "try{_diceLive.overlay.setExit(name);}", replace: "try{}", mustFail: "the overlay wears the new exit" }
]);
prove("index.html", [
  { label: "the story blocked while the dice go", find: "#dice-layer.leaving{pointer-events:none;cursor:default}", replace: "#dice-layer.leaving{cursor:default}", mustFail: "the story stays clickable" }
]);
process.exit(code);
