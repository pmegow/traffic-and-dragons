// dev/sabotage-558-shop-eye.js — proves the #558 guards are guarded (owner 2026-10-02: an inspect button on every ledger
// row; a shop stocks at least five wares). Disposable clones.
//   node dev/sabotage-558-shop-eye.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#6 the village — phase E/F"]];
var T = "#558 a shop stocks at least five";
rc |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the first ask goes back to \"one or two\"",
    find: "Emit at least \"+WARES_MIN_SHOP+\" and up to \"+cap+\" [WARES:item|price|note] lines for what this shop genuinely sells — a real shelf, not two things",
    replace: "Emit one or two [WARES:item|price|note] lines for what this shop genuinely sells (up to \"+cap+\" on its shelf",
    mustFail: "the first ask must name the floor and the cap" },
  { label: "the top-up never fires (a thin shelf stays thin for the week)",
    find: "if(_perShop&&_live<WARES_MIN_SHOP&&_ma0&&_ma0.node===key&&!_ma0.topped", replace: "if(false&&_perShop&&_live<WARES_MIN_SHOP&&_ma0&&_ma0.node===key&&!_ma0.topped",
    mustFail: "a thin shelf must be asked to fill once" },
  { label: "the top-up repeats every turn (the latch is dropped)",
    find: "      _ma0.topped=true;var _lbl=", replace: "      var _lbl=",
    mustFail: "the top-up must not repeat in the window" },
  { label: "the top-up fires in adventures too",
    find: "if(_perShop&&_live<WARES_MIN_SHOP&&_ma0&&_ma0.node===key", replace: "if(_live<WARES_MIN_SHOP&&_ma0&&_ma0.node===key",
    mustFail: "no top-up outside the per-shop kind" }
]});
rc |= sabotage.prove({ file: "globals.js", command: CMD, cases: [
  { label: "the floor drops to three",
    find: "var WARES_MIN_SHOP=5;", replace: "var WARES_MIN_SHOP=3;",
    mustFail: "WARES_MIN_SHOP must be at least 5" }
]});
rc |= sabotage.prove({ file: "ui-modals.js", command: CMD, cases: [
  { label: "the eye opens the card but lets the row mark itself too",
    find: "ev.stopPropagation();ev.preventDefault();var nm=eye.getAttribute(\"data-eye\")", replace: "var nm=eye.getAttribute(\"data-eye\")",
    mustFail: "the eye must open the item card (with the keeper's note) and stop the row's own click" },
  { label: "the rows lose the eye",
    find: "<button type='button' class='shop-eye' data-eye='\"+escHtml(r.label)+\"' data-note='\"+escHtml(r.note||\"\")+\"' title='Inspect \"+escHtml(r.label)+\"' aria-label='Inspect \"+escHtml(r.label)+\"'>&#128065;</button>", replace: "",
    mustFail: "every ledger row must carry an inspect button" }
]});
process.exit(rc ? 1 : 0);
