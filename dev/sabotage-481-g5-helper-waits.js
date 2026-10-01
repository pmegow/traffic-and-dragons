// dev/sabotage-481-g5-helper-waits.js — proves the #481 G5 follow-up is guarded (owner ruling 2026-09-30, "yes. count the
// seconds."): the waits a HELPER paints count seconds. addMsg ticks every story thinking marker, setThinking keeps the count
// running through a word change, _carSetStatus ticks the Car Mode waits it declares and stops the count before any other
// status, leaving Car Mode stops it, and the class guard finds a direct write to a thinking marker. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-481-g5-helper-waits.js
var sabotage = require("./sabotage.js");
var WAITS = ["node", ["dev/tests-481-g5-helper-waits.js"]], GUARD = ["node", ["dev/tests-481-g5-class-guards.js"]], failed = 0;
failed += sabotage.prove({ file: "ui-shell.js", command: WAITS, cases: [
  { label: "the story's thinking marker stops counting",
    find: "if(type===\"thinking\"&&typeof elapsedTicker===\"function\")div._tick=elapsedTicker(div,div.textContent,{text:true});", replace: "",
    mustFail: "a thinking marker counts seconds from the moment it is painted" },
  { label: "every message type ticks, not just the thinking marker",
    find: "if(type===\"thinking\"&&typeof elapsedTicker===\"function\")div._tick=", replace: "if(typeof elapsedTicker===\"function\")div._tick=",
    mustFail: "other message types never tick" },
  { label: "setThinking writes the words directly and the next tick erases them",
    find: "function setThinking(div,text){if(!div)return;if(div._tick)div._tick.set(text);else div.textContent=text;}", replace: "function setThinking(div,text){if(!div)return;div.textContent=text;}",
    mustFail: "setThinking swaps the marker's words while the seconds keep counting" },
  { label: "Car Mode's turn wait is painted as a bare literal outside the declared waits",
    find: "if(type===\"thinking\"){_carSetStatus(CAR_STR.thinking);", replace: "if(type===\"thinking\"){_carSetStatus(\"Thinking...\");",
    mustFail: "in Car Mode a GM turn's wait reads" }
]});
failed += sabotage.prove({ file: "ui-carmode.js", command: WAITS, cases: [
  { label: "Car Mode's status never ticks",
    find: "  if (waits && typeof elapsedTicker === \"function\") _carStatusTick = elapsedTicker(el, text, { text: true });\n  else el.textContent = text;", replace: "  el.textContent = text;",
    mustFail: "in Car Mode a GM turn's wait reads" },
  { label: "a running count is not stopped before the next status lands",
    find: "    _carStatusTick.stop(); _carStatusTick = null;           // stop BEFORE", replace: "    _carStatusTick = null;           // stop BEFORE",
    mustFail: "the narration stops the count before" },
  { label: "a repeated wait restarts its count (the options poll would read 0s forever)",
    find: "    if (waits && _carStatusTick.base() === text) return;", replace: "",
    mustFail: "a repeated wait keeps counting" },
  { label: "the retry drops out of the declared waits",
    find: "var CAR_WAIT_STR = [CAR_STR.thinking, CAR_STR.retrying, ", replace: "var CAR_WAIT_STR = [CAR_STR.thinking, ",
    mustFail: "every declared Car Mode wait ticks" },
  { label: "a count outlives the overlay",
    find: "  _carSetStatus(\"\");   // #481 G5 follow-up — nor may a running count", replace: "  // #481 G5 follow-up — nor may a running count",
    mustFail: "leaving Car Mode stops a running count" }
]});
failed += sabotage.prove({ file: "stt.js", command: WAITS, cases: [
  { label: "the speech model's wait is reworded and silently stops counting",
    find: "carNotify(\"info\", \"Transcribing…\");", replace: "carNotify(\"info\", \"Transcribing your words…\");",
    mustFail: "stt.js sends the transcribing status Car Mode declares as a wait" }
]});
// The #356 engine test now pins the loading modal's ticker by name (it used to count ui-shell.js's tickers).
failed += sabotage.prove({ file: "ui-shell.js", command: ["node", ["dev/run-tests.js", "class bible (#72)"]], cases: [
  { label: "the loading modal stops counting",
    find: "  var _lmT=elapsedTicker(document.getElementById(\"lm-secs\"),\"\",{text:true});/* #356 */", replace: "  var _lmT={stop:function(){}};/* #356 */",
    mustFail: "the loading modal must tick and stop on removal" }
]});
// End to end: the scan, its place in allProblems, and the live-tree test together (one mutation, the whole chain).
failed += sabotage.prove({ file: "game.js", command: GUARD, cases: [
  { label: "the campaign forge writes its marker directly again",
    find: "generateSkeleton(function(tx){try{setThinking(_skMsg,tx);}catch(_e){}})", replace: "generateSkeleton(function(tx){try{_skMsg.innerHTML=tx;}catch(_e){}})",
    mustFail: "the live tree" }
]});
failed += sabotage.prove({ file: "dev/class-guards.js", command: GUARD, cases: [
  { label: "the marker scan ignores the callbacks of the function that painted it",
    find: "      var fn = s.fns[inner], body = code.slice(fn.open, fn.close + 1), x;", replace: "      var fn = s.fns[inner], body = ownBody(code, fn, s.fns.map(function (g) { return g === fn ? g : { open: g.open, close: g.close, deferred: true }; })), x;",
    mustFail: "a thinking marker's words change only through setThinking" },
  { label: "a write inside a string counts as a marker write",
    find: "      var fn = s.fns[inner], body = code.slice(fn.open, fn.close + 1), x;", replace: "      var fn = s.fns[inner], body = s.src.slice(fn.open, fn.close + 1), x;",
    mustFail: "a thinking marker's words change only through setThinking" }
]});
process.exit(failed ? 1 : 0);
