// Browser mutation proof; uses the same PLAYWRIGHT_PATH and CHROME_PATH as the acceptance script.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "ui-browsers.js",
  "also": [
    "ui-boot.js",
    "samples/catalog.json",
    "samples/the_silence_between_leaves.blueprint"
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
      "find": "var mode=\"catalog\",view=0,catalog=null;",
      "replace": "var mode=\"local\",view=0,catalog=null;"
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
}));
