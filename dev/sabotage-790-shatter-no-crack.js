// sabotage-790-shatter-no-crack.js - prove the #790 guard is not decorative.
// #790 (owner 2026-11-27): in the game the Shatter exit breaks at once, without the cracks that run first.
//   node dev/sabotage-790-shatter-no-crack.js
var sabotage=require("./sabotage.js");
var T="#790 the game asks the dice for Shatter without its cracks";
process.exit(sabotage.prove({file:"ui-dice.js",command:["node",["dev/run-tests.js","#790 Shatter without its cracks in the game"]],cases:[
  {label:"#790 the game asks for the cracks again",find:"var DICE_EXIT_OPTIONS={shatter:{crack:false}};",replace:"var DICE_EXIT_OPTIONS={shatter:{crack:true}};",mustFail:T},
  {label:"#790 the overlay is made without the game's options",find:"createDiceOverlay({exitOptions:DICE_EXIT_OPTIONS,container:",replace:"createDiceOverlay({container:",mustFail:T}
]}));
