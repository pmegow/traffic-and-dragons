// dev/sabotage-501-shop-button.js — proves the #501 guards are guarded (owner 2026-10-01: "Let's add an explicit shop button to
// the narrative window … on the bottom row where the 'render' button is, but connect it to the right side of the panel. Only
// draw the button if there's a shopping opportunity … and turn the button off once a new scene is written"; ruled the same day:
// the fourth suggestion button goes back to its ladder). The rule is ONE pure function (shopOpportunity); the button is painted
// from the live state. The browser clauses drive the real index.html through dev/cdp-browser.js; with no Chrome they are SKIPPED
// out loud (exit 78 + one SABOTAGE SKIPPED line) — never passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-501-shop-button.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var NODE = ["node", ["dev/run-tests.js", "#6 the village — phase E/F"]], BROWSER = ["node", ["dev/tests-501-shop-button-browser.js"]], failed = 0;
var T = "#501 the counter is reached";
// The rule.
failed += sabotage.prove({ file: "helpers.js", command: NODE, cases: [
  { label: "an open gate that names no shop counts (the adventure gets a counter)",
    find: "  return (t&&t.ok&&t.shop)?{shop:t.shop,keeper:t.keeper}:null;", replace: "  return (t&&t.ok)?{shop:t.shop,keeper:t.keeper}:null;",
    mustFail: T },
  { label: "any answer from the trade gate counts, a refusal included (nobody behind the counter)",
    find: "  return (t&&t.ok&&t.shop)?{shop:t.shop,keeper:t.keeper}:null;", replace: "  return t?{shop:t.shop,keeper:t.keeper}:null;",
    mustFail: T }
]});
// The fourth suggestion button is the ladder's again.
failed += sabotage.prove({ file: "game.js", command: NODE, cases: [
  { label: "the Shop rung is back on the fourth button",
    find: "  if(!worldState.combat&&typeof c.hp===\"number\"&&typeof c.maxHp===\"number\"&&c.hp<c.maxHp/2)return {kind:\"rest\"", replace: "  var _sv=shopOpportunity();if(_sv)return {kind:\"shop\",text:\"Shop at \"+_sv.shop+\".\"};\n  if(!worldState.combat&&typeof c.hp===\"number\"&&typeof c.maxHp===\"number\"&&c.hp<c.maxHp/2)return {kind:\"rest\"",
    mustFail: T },
  { label: "the village's own Buy rung comes back beside the counter",
    find: "  if(!(_tk&&_tk.tradeOnlyInShops)&&(c.gold||0)>0&&memory&&memory.map", replace: "  if((c.gold||0)>0&&memory&&memory.map",
    mustFail: T },
  { label: "a suggestion that says \"Shop at …\" opens the counter instead of being sent",
    find: "  if(ev&&(ev.ctrlKey||ev.metaKey)){if(!busy)sendAction(toFirstPerson(action));return;}", replace: "  if(/^Shop at /.test(action)){invLedgerOpen(\"showShopModal\");return;}\n  if(ev&&(ev.ctrlKey||ev.metaKey)){if(!busy)sendAction(toFirstPerson(action));return;}",
    mustFail: T }
]});
// One rule, two doors; the click goes through the one gate.
failed += sabotage.prove({ file: "ui-panels.js", command: NODE, cases: [
  { label: "the inventory panel's Trade row decides on its own again",
    find: "var _so=(typeof shopOpportunity===\"function\"&&typeof showShopModal===\"function\")?shopOpportunity():null;", replace: "var _vtcx=villageTradeContext(),_so=(kindDef().waresPerShop&&_vtcx.ok)?{keeper:_vtcx.keeper}:null;",
    mustFail: T }
]});
failed += sabotage.prove({ file: "ui-shell.js", command: NODE, cases: [
  { label: "the Shop button calls the counter directly, past the click-time gate",
    find: "b.onclick=function(ev){ev.stopPropagation();invLedgerOpen(\"showShopModal\");};", replace: "b.onclick=function(ev){ev.stopPropagation();showShopModal();};",
    mustFail: T }
]});
// The button itself, in a real browser.
failed += sabotage.prove({ file: "ui-panels.js", skip: !chrome.path, command: BROWSER, cases: [
  { label: "a repaint no longer refreshes the Shop button (walking out leaves it on)",
    find: "if(typeof syncShopButton===\"function\")syncShopButton();/* #501: the narration's Shop button follows the live state */", replace: "/* #501: the narration's Shop button follows the live state */",
    mustFail: "walking out turns it off" }
]});
failed += sabotage.prove({ file: "ui-shell.js", skip: !chrome.path, command: BROWSER, cases: [
  { label: "a narration landing no longer moves the button (a reload shows none)",
    find: "if(type===\"narrator\")syncShopButton();", replace: "",
    mustFail: "after a reload in a shop with its keeper" },
  { label: "the scene before keeps its button when a new scene is written",
    find: "  for(i=0;i<old.length;i++)if(!op||old[i].parentNode!==newest)old[i].parentNode.removeChild(old[i]);", replace: "  for(i=0;i<old.length;i++)if(!op)old[i].parentNode.removeChild(old[i]);",
    mustFail: "a new scene written in the shop takes the button" },
  { label: "the button is drawn with no shopping opportunity",
    find: "  var op=(typeof shopOpportunity===\"function\"&&typeof worldState!==\"undefined\"&&worldState)?shopOpportunity():null;", replace: "  var op={shop:\"anywhere\",keeper:\"anyone\"};",
    mustFail: "walking out turns it off" },
  { label: "a narrator line that is not a scene takes the button",
    find: "  var frames=story.querySelectorAll(\".msg.narrator[data-turn]\"),newest=", replace: "  var frames=story.querySelectorAll(\".msg.narrator\"),newest=",
    mustFail: "a narrator line that is not a scene" },
  { label: "a re-made button lands under the suggestions instead of on the Render row",
    find: "    if(row&&row.parentNode===newest)newest.insertBefore(wrap,row.nextSibling);else newest.appendChild(wrap);}", replace: "    newest.appendChild(wrap);}",
    mustFail: "the keeper leaving turns it off" }
]});
failed += sabotage.prove({ file: "index.html", skip: !chrome.path, command: BROWSER, cases: [
  { label: "the button loses its place at the panel's right edge",
    find: ".frame-shop-wrap{float:right}", replace: ".frame-shop-wrap{}",
    mustFail: "after a reload in a shop with its keeper" }
]});
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-501-shop-button.js", 7, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
