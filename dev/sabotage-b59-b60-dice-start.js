// dev/sabotage-b59-b60-dice-start.js — proves the B59/B60 guards in ui-dice.js: a page opened as a local file refuses the
// dice before the module is asked for and reports nothing (B60); a failed start is tried again by the next roll, three
// times and no more, its report's detail is text, and the player is told why no dice showed (B59). Each clause plants one
// regression; the named check of dev/tests-669-live-dice-browser.js must fail. Needs Chrome (skipped, said, without it).
//   node dev/sabotage-b59-b60-dice-start.js      (browser driver: dev/cdp-browser.js)
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js"), chrome = require("./cdp-browser.js").locateChrome();
var B60 = "FAIL B60 a page opened as a local file refuses the dice", RETRY = "FAIL B59 a dice start that fails at preload is not final", LATCH = "FAIL B59 a device that cannot start the dice";
var cases = [
  { label: "B60: the refusal is gone — a local file asks for the module and reports the failure to the live feed",
    find: "  return protocol===\"file:\"?\"Open the hosted game or localhost to see the dice\":null;",
    replace: "  return null;", mustFail: B60 },
  { label: "B60: the refusal is too wide — every page that is not https loses its dice (localhost too)",
    find: "  return protocol===\"file:\"?\"Open the hosted game or localhost to see the dice\":null;",
    replace: "  return protocol!==\"https:\"?\"Open the hosted game or localhost to see the dice\":null;", mustFail: "FAIL the dice module loads on an http page" },
  { label: "B60: a refused page still reports to the bug feed",
    find: "console.warn(\"live dice: \"+refused+\" (a page opened as a local file cannot load the dice module; not reported)\");return;}",
    replace: "diceLiveFail(refused);return;}", mustFail: B60 },
  { label: "a roll asked of dice that are off says nothing (Roll a test d20 falls silent)",
    find: "  if(_diceLive.state===\"failed\"){diceLiveSay();return false;}\n  diceLiveWhenReady(function(){\n    var overlay;",
    replace: "  if(_diceLive.state===\"failed\")return false;\n  diceLiveWhenReady(function(){\n    var overlay;", mustFail: LATCH },
  { label: "B60: Dice appearance blames the device for what the page caused",
    find: "if(b)b.textContent=_diceLive.why||\"The dice could not load on this device.\";}",
    replace: "if(b)b.textContent=\"The dice could not load on this device.\";}", mustFail: B60 },
  { label: "B59: one failed start switches the dice off for the whole page again",
    find: "  if(_diceLive.tries>=DICE_START_TRIES){_diceLive.state=\"failed\";",
    replace: "  if(_diceLive.tries>=1){_diceLive.state=\"failed\";", mustFail: RETRY },
  { label: "B59: the report's detail is an object again (the reporter prints [object Object])",
    find: "reportError(\"dice-live\",msg,diceLiveDetail(detail));}",
    replace: "reportError(\"dice-live\",msg,detail||{});}", mustFail: RETRY },
  { label: "B59: a preload failure is announced to the player before any roll",
    find: "  catch(e){diceLiveStartFailed(e,{at:\"preload\"},false);}",
    replace: "  catch(e){diceLiveStartFailed(e,{at:\"preload\"},true);}", mustFail: RETRY },
  { label: "B59: the starts are never capped — every roll makes another canvas and asks for another context",
    find: "var DICE_START_TRIES=3;",
    replace: "var DICE_START_TRIES=99;", mustFail: LATCH },
  { label: "B59: a roll whose dice did not start says nothing",
    find: "    catch(e){diceLiveStartFailed(e,{roll:label},true);return;}",
    replace: "    catch(e){diceLiveStartFailed(e,{roll:label},false);return;}", mustFail: LATCH },
  { label: "B59: the final failure is not said in its own words (reload to try again)",
    find: "_diceLive.said=false;/* final: said once more, in these words */}",
    replace: "}", mustFail: LATCH },
  { label: "B59: Dice appearance overwrites its presets after a failed start though the module loaded",
    find: "  if(_diceLive.state===\"failed\"&&(!window.DiceSim||diceLivePageRefusal())){",
    replace: "  if(_diceLive.state===\"failed\"){", mustFail: LATCH },
  { label: "B59: Roll a test d20 does nothing, silently, once the dice are off",
    find: "    if(_diceLive.state===\"failed\")_diceLive.said=false;/* asked for on purpose: say why again */\n",
    replace: "", mustFail: LATCH }
];
var failed = sabotage.prove({ file: "ui-dice.js", skip: !chrome.path, command: ["node", ["dev/tests-669-live-dice-browser.js"]], cases: cases });
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-b59-b60-dice-start.js", cases.length, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
