// Browser mutation proof on a system Chrome through dev/cdp-browser.js (no Playwright; CHROME_PATH overrides discovery).
// #472: with no Chrome on this machine every clause is SKIPPED out loud (exit 78 + one SABOTAGE SKIPPED line the runners
// print) — never passed. The clauses stay declared either way, so the dry applicability scan keeps counting them.
var sabotage=require("./sabotage.js"),verdict=require("./battery-verdict.js"),chrome=require("./cdp-browser.js").locateChrome();
var failed=sabotage.prove({
  "file": "ui-browsers.js",
  "skip": !chrome.path,
  "also": [
    "ui-boot.js",
    "storage-adapter.js",
    "samples/catalog.json",
    "samples/the_silence_between_leaves.blueprint",
    "dev/cdp-browser.js"
  ],
  "command": [
    "node",
    [
      "dev/tests-blueprint-catalog-browser.js"
    ]
  ],
  "cases": [
    {
      "label": "Catalog is the default source",
      "mustFail": "Catalog opens by default",
      "find": "var mode=\"catalog\",view=0;",
      "replace": "var mode=\"local\",view=0;"
    },
    {
      "label": "Catalog preview protects the authored ending",
      "mustFail": "Catalog preview hides campaign spoilers",
      "find": "escHtml(meta?meta.blurb:(bp.premise||\"\"))",
      "replace": "escHtml(bp.premise||\"\")"
    },
    {
      "label": "Tab changes invalidate personal-library replies",
      "mustFail": "Late library response must leave Import File visible",
      "find": "return stamp===view&&document.getElementById(\"bp-browser-modal\")===modal;",
      "replace": "return document.getElementById(\"bp-browser-modal\")===modal;"
    },
    {
      "label": "Selecting a catalog story never writes a personal copy",
      "mustFail": "Catalog selection never saves over My Library",
      "find": "modal.remove();_applyBlueprint(bp);",
      "replace": "storageAdapter.saveBlueprintToLibrary(bp,function(){});modal.remove();_applyBlueprint(bp);"
    }
  ]
});
if(!chrome.path&&!failed){verdict.reportSkip("sabotage-blueprint-catalog.js",4,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed);
