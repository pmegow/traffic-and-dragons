// #745: removing the shared portrait column must recreate the reported rendered layout failure.
// Chrome discovery and its loud skip share dev/cdp-browser.js with the browser proof.
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js"), chrome = require("./cdp-browser.js").locateChrome();
var failed = sabotage.prove({
  file: "blueprint-designer.html",
  skip: !chrome.path,
  command: ["node", ["dev/tests-732-missing-portraits-browser.js"]],
  only: "FAIL #732 ",
  cases: [{
    label: "the alternate portrait falls into the editor column beneath the card",
    find: '  return h?"<div class=\'creature-portrait-stack\'>"+h+"</div>":"";',
    replace: "  return h;",
    mustFail: "FAIL #732 #745 alternate portraits stack directly below true portraits in both card types"
  }]
});
if(!chrome.path&&!failed){verdict.reportSkip("sabotage-745-portrait-stack.js",1,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed ? 1 : 0);
