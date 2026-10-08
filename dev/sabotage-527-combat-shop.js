// #527(24): both counter doors and stale completion obey the live combat gate.
// Browser clauses use dev/cdp-browser.js; locateChrome preflights them, and a missing browser
// skips those two clauses loudly with reportSkip and exit 78 after the engine clauses run.
var sabotage=require("./sabotage.js"),verdict=require("./battery-verdict.js"),chrome=require("./cdp-browser.js").locateChrome(),rc=0;
rc|=sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 shopping waits for combat"
    ]
  ],
  "cases": [
    {
      "label": "counter stays open in combat",
      "find": "if(typeof worldState!==\"undefined\"&&worldState&&worldState.combat)return {ok:false,reason:\"finish combat before trading\"};",
      "replace": "",
      "mustFail": "#527 combat hides the shopping"
    },
    {
      "label": "opportunity bypasses counter gate",
      "find": "var t=shopCounterContext();",
      "replace": "var t=villageTradeContext();",
      "mustFail": "#527 combat hides the shopping"
    },
    {
      "label": "catalog bypasses counter gate at completion",
      "find": "var vtc=shopCounterContext();",
      "replace": "var vtc=villageTradeContext();",
      "mustFail": "#527 stale shop marks"
    }
  ]
});
rc|=sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 shopping waits for combat"
    ]
  ],
  "cases": [
    {
      "label": "actual combat trade refusal is not logged",
      "find": "if(typeof console!==\"undefined\")console.warn(\"[shop] trade refused — \"+cat.reason);",
      "replace": "",
      "mustFail": "#527 stale shop marks"
    }
  ]
});
rc|=sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/tests-501-shop-button-browser.js"
    ]
  ],
  skip:!chrome.path,
"cases": [
    {
      "label": "real stale modal click completes in combat",
      "find": "if(typeof worldState!==\"undefined\"&&worldState&&worldState.combat)return {ok:false,reason:\"finish combat before trading\"};",
      "replace": "",
      "mustFail": "#527 an already open marked counter refuses completion"
    }
  ]
});
rc|=sabotage.prove({
  "file": "ui-modals.js",
  "command": [
    "node",
    [
      "dev/tests-501-shop-button-browser.js"
    ]
  ],
  skip:!chrome.path,
"cases": [
    {
      "label": "stale opener loses its visible refusal reason",
      "find": "showToast(\"Trade: \"+cat.reason);",
      "replace": "",
      "mustFail": "#527 combat hides both shopping doors and a stale opener"
    }
  ]
});
if(!chrome.path&&!rc){verdict.reportSkip("sabotage-527-combat-shop.js",2,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(rc);
