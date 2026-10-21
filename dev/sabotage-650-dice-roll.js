// dev/sabotage-650-dice-roll.js — proves the #650 guards (the d20 roll clip): the WebKit format rule, the clip's
// place AFTER the turn is sent, the overlay's skips and its loud failure, the stacked-alpha recombination, the SW's
// purge-exempt dice cache and the headers rule must each turn the #650 section red.
//   node dev/sabotage-650-dice-roll.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#650"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "iOS browsers lose the stacked clip (every iPhone roll a black box)",
    find: '  if(/iP(hone|ad|od)/.test(ua))return "stacked";\n', replace: "",
    mustFail: "an iPhone must get the stacked clip" },
  { label: "an iPad with a desktop UA is sent the alpha WebM",
    find: '  if(e.platform==="MacIntel"&&Number(e.maxTouchPoints)>1)return "stacked";\n', replace: "",
    mustFail: "MacIntel with touch points is an iPad" },
  { label: "Chrome's AppleWebKit token sends Chrome the stacked clip (the canvas on every desktop)",
    find: '!/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)', replace: "true",
    mustFail: "Chrome must get the webm" },
  { label: "a single-digit face loses its zero (dice/d20_7 is no file)",
    find: '"dice/d20_"+(n<10?"0":"")+n', replace: '"dice/d20_"+n',
    mustFail: "the name must be two digits" },
  { label: "a half-covered edge pixel keeps its premultiplied colour (a dark fringe round the die)",
    find: "else{k=255/a;cd[i]=Math.min(255,cd[i]*k);cd[i+1]=Math.min(255,cd[i+1]*k);cd[i+2]=Math.min(255,cd[i+2]*k);cd[i+3]=a;}", replace: "else{cd[i+3]=a;}",
    mustFail: "a half-covered pixel must be un-premultiplied" },
  { label: "the matte is ignored outside the die (the black field comes along, opaque)",
    find: "    else if(a===0)cd[i+3]=0;\n", replace: "",
    mustFail: "a pixel outside the die must end transparent" }
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
    find: '    if(!quiet&&!_diceClipReported&&typeof reportError==="function"){_diceClipReported=true;reportError("dice-clip",msg,{face:face,src:src});}\n', replace: "",
    mustFail: "a failed clip must report" },
  { label: "the stacked player paints the raw halves (the matte shows beside the die)",
    find: "    diceStackedRecombine(c.data,m.data);\n", replace: "",
    mustFail: "the stacked player must recombine through the pure diceStackedRecombine" }
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
