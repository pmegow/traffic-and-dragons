// dev/sabotage-669-live-dice.js — proves the #669 guards (the live dice): the doors hand the engine's faces to dice-sim,
// Car Mode skips, one overlay for the session, a failure reported once, the import map, the worker keeping /roller/, the
// Bone default and the Settings row, the mutes — each must turn the #669 section red.
//   node dev/sabotage-669-live-dice.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#669"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ui-dice.js", [
  { label: "the d20 lands on any face", find: 'return diceLiveRoll([{type:"d20",value:face}],"d20:"+face,opts);', replace: 'return diceLiveRoll([{type:"d20"}],"d20:"+face,opts);', mustFail: "throw the engine's face" },
  { label: "the damage dice land anywhere", find: 'dice.push({type:"d"+sides,value:list[i]});', replace: 'dice.push({type:"d"+sides});', mustFail: "throw each engine face" },
  { label: "Car Mode shows the dice", find: 'if(typeof carMode!=="undefined"&&carMode)return false;', replace: "", mustFail: "Car Mode must skip" },
  { label: "an overlay per roll", find: "if(_diceLive.overlay)return _diceLive.overlay;", replace: "", mustFail: "one overlay" },
  { label: "every failure reported", find: 'if(!_diceLive.reported&&typeof reportError==="function"){_diceLive.reported=true;', replace: 'if(typeof reportError==="function"){', mustFail: "reportError once" },
  { label: "the dice start as another look", find: 'var DICE_LOOK_DEFAULT="Bone";', replace: 'var DICE_LOOK_DEFAULT="Violet glass";', mustFail: "start as Bone" },
  { label: "the dice ignore the UI-sounds switch", find: '||(typeof Sound!=="undefined"&&typeof Sound.enabled==="function"&&!Sound.enabled());', replace: ";", mustFail: "the UI-sounds switch" }
]);
prove("index.html", [
  { label: "three unmapped", find: '"three": "/roller/vendor/three/three.module.js",', replace: "", mustFail: "point three at roller/" }
]);
prove("sw.js", [
  { label: "the purge drops the dice cache", find: "&& k!==ROLLER_CACHE;", replace: ";", mustFail: "survive the activate purge" }
]);
prove("ui-boot.js", [
  { label: "no Settings row", find: 'btn(p+"dice-look","&#127922; Dice appearance&hellip;",0)', replace: '""', mustFail: "the Settings row" }
]);
process.exit(code);
