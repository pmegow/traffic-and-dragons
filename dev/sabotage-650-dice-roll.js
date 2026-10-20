// dev/sabotage-650-dice-roll.js — proves the #650 guards (the d20 roll clip): the WebKit format rule, the clip's
// place AFTER the turn is sent, the overlay's skips and its loud failure, the SW's purge-exempt dice cache and the
// headers rule must each turn the #650 section red.
//   node dev/sabotage-650-dice-roll.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#650"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "iOS browsers lose the mp4 (every iPhone roll a black box)",
    find: '  if(/iP(hone|ad|od)/.test(ua))return "mp4";\n', replace: "",
    mustFail: "an iPhone must get the mp4" },
  { label: "an iPad with a desktop UA is sent the alpha WebM",
    find: '  if(e.platform==="MacIntel"&&Number(e.maxTouchPoints)>1)return "mp4";\n', replace: "",
    mustFail: "MacIntel with touch points is an iPad" },
  { label: "Chrome's AppleWebKit token sends Chrome the mp4 (the felt tray on every desktop)",
    find: '!/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)', replace: "true",
    mustFail: "Chrome must get the webm" },
  { label: "a single-digit face loses its zero (dice/d20_7 is no file)",
    find: '"dice/d20_"+(n<10?"0":"")+n', replace: '"dice/d20_"+n',
    mustFail: "the name must be two digits" }
]);
prove("game.js", [
  { label: "the clip plays BEFORE the turn is sent",
    find: '  sendAction(r.note,{silent:true,rollTag:r.diceTag});\n  if(typeof showDiceRoll==="function")showDiceRoll(r.roll);',
    replace: '  if(typeof showDiceRoll==="function")showDiceRoll(r.roll);\n  sendAction(r.note,{silent:true,rollTag:r.diceTag});',
    mustFail: "showDiceRoll must follow sendAction" }
]);
prove("ui-dice.js", [
  { label: "the overlay plays under the Car Mode screen",
    find: '  if(typeof carMode!=="undefined"&&carMode)return false;\n', replace: "",
    mustFail: "Car Mode must skip the clip" },
  { label: "a reduced-motion player gets the tumble anyway",
    find: '  if(typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;\n', replace: "",
    mustFail: "reduced motion must skip the clip" },
  { label: "a clip that fails to load fails silently",
    find: '    if(!_diceClipReported&&typeof reportError==="function"){_diceClipReported=true;reportError("dice-clip",msg,{face:face,src:src});}\n', replace: "",
    mustFail: "a failed clip must report" }
]);
prove("sw.js", [
  { label: "the activate purge deletes the dice cache on every deploy",
    find: " && k!==DICE_CACHE", replace: "",
    mustFail: "DICE_CACHE must be purge-exempt" },
  { label: "a fetched clip is served but never kept",
    find: 'holdRuntimeIo(e,caches.open(DICE_CACHE).then(function(cache){ return cache.put(e.request,clone); }),"dice cache write for "+e.request.url);', replace: "",
    mustFail: "the clip must be written to DICE_CACHE" }
]);
prove("_headers", [
  { label: "the /dice/* rule is gone (the clips fall under the immutable default or get revalidated every roll)",
    find: "/dice/*\n  Cache-Control: public, max-age=86400", replace: "",
    mustFail: "_headers must carry the /dice/* rule" }
]);
process.exit(code);
