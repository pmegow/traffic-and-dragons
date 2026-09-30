// dev/sabotage-481-g5-class-guards.js — proves the #481 G5 guards are guarded: the three classes (model/image waits tick, every
// page is on the shared palette, every page outside the app shell is network-first) are DERIVED from the source by
// dev/class-guards.js, and each fixed wait counts seconds and stops before its result lands. The browser clauses drive real
// pages through dev/cdp-browser.js; with no Chrome they are SKIPPED out loud (exit 78 + one SABOTAGE SKIPPED line) — never
// passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g5-class-guards.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var NODE = ["node", ["dev/tests-481-g5-class-guards.js"]], BROWSER = ["node", ["dev/tests-481-g5-waits-browser.js"]], failed = 0;
// The fixes, reverted one at a time: the derived scan must name each.
failed += sabotage.prove({ file: "game.js", command: NODE, cases: [
  { label: "the Enhance button freezes again",
    find: "enhanceBtn.disabled=true;var _et=elapsedTicker(enhanceBtn,\"Enhancing…\",{text:true});", replace: "enhanceBtn.textContent=\"Enhancing…\";enhanceBtn.disabled=true;var _et={stop:function(){}};",
    mustFail: "the live tree" }
]});
failed += sabotage.prove({ file: "char-creation.js", command: NODE, cases: [
  { label: "the random hero paints a frozen label again",
    find: "async function aiRandomHero(btn){\n  if(btn)btn.disabled=true;", replace: "async function aiRandomHero(btn){\n  if(btn){btn.disabled=true;btn.textContent=\"✦ Rolling…\";}",
    mustFail: "the live tree" }
]});
failed += sabotage.prove({ file: "story_compiler.html", command: NODE, cases: [
  { label: "the story compiler drops the shared palette",
    find: "<link rel=\"stylesheet\" href=\"satellite.css\">\n<style>\n  /* #481 G5: tokens", replace: "<style>\n  /* #481 G5: tokens",
    mustFail: "the live tree" }
]});
failed += sabotage.prove({ file: "sw.js", command: NODE, cases: [
  { label: "the necro page is served cache-first again",
    find: "|timeline_day1|necro_spells_TMP|", replace: "|timeline_day1|",
    mustFail: "the live tree" }
]});
// The scanner itself: each rule that makes it a CLASS guard.
failed += sabotage.prove({ file: "dev/class-guards.js", command: NODE, cases: [
  { label: "the fixpoint stops at one level (a status before outer() → inner() → callGM passes)",
    find: "        var names = WAIT_PRIMITIVES.concat(Object.keys(global)).concat(isJs ? [] : Object.keys(loc));", replace: "        var names = WAIT_PRIMITIVES;",
    mustFail: "a frozen status is found in every wait shape" },
  { label: "every nested callback is cut from the flow (a .map wait is missed)",
    find: "    if (g !== fn && g.deferred && g.open > fn.open && g.close < fn.close) {", replace: "    if (g !== fn && g.open > fn.open && g.close < fn.close) {",
    mustFail: "a frozen status is found in every wait shape" },
  { label: "the \\u2026 escape is not an ellipsis",
    find: "(?:…|\\\\u2026|\\.\\.\\.)", replace: "(?:…|\\.\\.\\.)",
    mustFail: "a frozen status is found in every wait shape" },
  { label: "a deferred handler counts as the wiring function's wait",
    find: "var DEFERRED_RE = /(?:\\.on[a-z]+\\s*=|", replace: "var DEFERRED_RE = /(?!)(?:\\.on[a-z]+\\s*=|",
    mustFail: "nothing that is not a frozen wait is flagged" },
  { label: "a call inside a string literal counts",
    find: "if (!s.own) { var code = codeOnly(s.src);", replace: "if (!s.own) { var code = s.src;",
    mustFail: "nothing that is not a frozen wait is flagged" },
  { label: "a module-private name propagates as a global",
    find: "if (!fn.name || !fn.topLevel || (isJs ? global[fn.name] : loc[fn.name])) return;", replace: "if (!fn.name || (isJs ? global[fn.name] : loc[fn.name])) return;",
    mustFail: "nothing that is not a frozen wait is flagged" },
  { label: "an exemption for a page that links satellite.css is not stale",
    find: "    else if (linksPalette(byName[f].text)) out.push(", replace: "    else if (false) out.push(",
    mustFail: "the palette class" },
  { label: "the network-first test never runs",
    find: "!exempt[p.file] && !sw.regex.test(\"https://tnd.example/\" + p.file); })", replace: "!exempt[p.file] && false; })",
    mustFail: "the network-first class" }
]});
// The stop-before-result discipline, in a real browser.
failed += sabotage.prove({ file: "blueprint-designer.html", skip: !chrome.path, command: BROWSER, cases: [
  { label: "the creature ticker is not stopped before the result",
    find: "    _ct.stop();\n    var c=JSON.parse(repairModelJson(resp));", replace: "    var c=JSON.parse(repairModelJson(resp));",
    mustFail: "the result stays once it lands" },
  { label: "the Generate button's ticker is not stopped before the label returns",
    find: "    _gt.stop();btn.disabled=false;btn.textContent=\"✨ Generate\";", replace: "    btn.disabled=false;btn.textContent=\"✨ Generate\";",
    mustFail: "the Generate modal" },
  { label: "a batch apply starts a second ticker per finding",
    find: "var _at=_applyingAll?null:statusTicker(", replace: "var _at=statusTicker(",
    mustFail: "inside Apply-all the batch owns the one ticker" }
]});
failed += sabotage.prove({ file: "char-creation.js", skip: !chrome.path, command: BROWSER, cases: [
  { label: "the random hero's loading modal is never removed",
    find: "finally{if(_done)_done();if(btn)btn.disabled=false;}", replace: "finally{if(btn)btn.disabled=false;}",
    mustFail: "the random hero" }
]});
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-481-g5-class-guards.js", 4, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
