// tests-481-g5-helper-waits.js — #481 G5 follow-up (owner ruling 2026-09-30, "yes. count the seconds."): the waits a HELPER
// paints count seconds too. The G5 scan finds frozen statuses painted inside a waiting function; it could not see the ones a
// helper paints before the wait starts, so they were left to the owner. Now both helpers tick on their own:
//   • addMsg ticks every "thinking" marker ("The world turns... 7s", the skeleton forge, a re-roll, the render's
//     "Composing scene..."); the marker's text changes only through setThinking, which keeps the count running;
//   • _carSetStatus ticks the Car Mode statuses that wait on a model (CAR_WAIT_STR: thinking, retrying, getting options,
//     transcribing); a repeated wait keeps counting; any other status stops the count before it is painted; leaving Car
//     Mode stops it.
// Through the real ui-shell.js and ui-carmode.js on a small DOM fake, with a fake clock and fake interval timers.
//   node dev/tests-481-g5-helper-waits.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();

// ── a fake clock and interval scheduler (elapsedTicker reads Date.now and owns one setInterval) ──
var CLOCK = 1e9, TIMERS = {}, NEXT_ID = 1;
Date.now = function () { return CLOCK; };
global.setInterval = function (fn) { var id = NEXT_ID++; TIMERS[id] = fn; return id; };
global.clearInterval = function (id) { delete TIMERS[id]; };
function advance(sec) { CLOCK += sec * 1000; Object.keys(TIMERS).forEach(function (id) { if (TIMERS[id]) TIMERS[id](); }); }
function liveTimers() { return Object.keys(TIMERS).length; }

// ── a DOM fake: enough for addMsg (append, trim, scroll) and the Car Mode status line ──
var ROOT_NODE;
function El(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.className = ""; this.id = ""; this.style = {}; this.attrs = {}; this._text = ""; this.scrollTop = 0; this.scrollHeight = 0; this.clientHeight = 0; }
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); };
El.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; };
El.prototype.appendChild = function (c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c; };
El.prototype.insertBefore = function (c, ref) { if (c.parentNode) c.remove(); c.parentNode = this; var i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; };
El.prototype.removeChild = function (c) { c.remove(); return c; };
El.prototype.remove = function () { if (this.parentNode) { var p = this.parentNode, me = this; p.children = p.children.filter(function (x) { return x !== me; }); this.parentNode = null; } };
El.prototype.addEventListener = function () {};
El.prototype.querySelectorAll = function (sel) { var out = [], cls = sel === ".msg" ? "msg" : null; (function walk(e) { e.children.forEach(function (c) { if (cls && (" " + c.className + " ").indexOf(" " + cls + " ") >= 0) out.push(c); walk(c); }); })(this); return out; };
El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
Object.defineProperty(El.prototype, "firstChild", { get: function () { return this.children[0] || null; } });
Object.defineProperty(El.prototype, "isConnected", { get: function () { var e = this; while (e) { if (e === ROOT_NODE) return true; e = e.parentNode; } return false; } });
Object.defineProperty(El.prototype, "textContent", { get: function () { return this._text; }, set: function (t) { this._text = String(t); this.children = []; } });
Object.defineProperty(El.prototype, "innerHTML", { get: function () { return this._text; }, set: function (h) { this._text = String(h).replace(/&hellip;/g, "…"); this.children = []; } });
ROOT_NODE = new El("body");
function mount(id) { var e = new El("div"); e.id = id; ROOT_NODE.appendChild(e); return e; }
var story = mount("story-narrative"), carStatus = mount("car-status"); mount("story-tabletalk"); mount("car-overlay"); mount("car-tap-btn");
global.window = global;
global.document = { body: ROOT_NODE, activeElement: null, addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return true; },
  createElement: function (t) { return new El(t); }, createTextNode: function (t) { var e = new El("#text"); e.textContent = t; return e; },
  getElementById: function (id) { var out = null; (function walk(e) { e.children.forEach(function (c) { if (c.id === id) out = c; walk(c); }); })(ROOT_NODE); return out; } };
global.store = { get: function () { return ""; }, set: function () {}, del: function () {} };
var geval = eval;
geval(fs.readFileSync(path.join(ROOT, "ui-shell.js"), "utf8"));
geval(fs.readFileSync(path.join(ROOT, "ui-carmode.js"), "utf8"));
activeChatTab = "narrative";

var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS #481 G5 helper waits: " + name); } else { failed++; console.error("FAIL #481 G5 helper waits: " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL #481 G5 helper waits: " + name + " — threw: " + (e && e.stack || e)); } }
/* detach the previous test's markers, then fire every interval once at the same instant so the detached ones stop themselves —
   each test's interval count starts from a clean baseline */
function reset() { story.children.forEach(function (c) { c.parentNode = null; }); story.children = []; carMode = false; busy = false; _carSetStatus(""); carStatus.textContent = ""; advance(0); }

// ── the story's thinking markers ──
test("a thinking marker counts seconds from the moment it is painted", function () {
  reset(); var th = addMsg("thinking", "The world turns...");
  if (th.textContent !== "The world turns... 0s") return "at paint: " + JSON.stringify(th.textContent);
  advance(7);
  return th.textContent === "The world turns... 7s" ? true : "after 7s: " + JSON.stringify(th.textContent);
});
test("an escaped ellipsis marker counts too (\\u2026 and &hellip; read as the character)", function () {
  reset(); var th = addMsg("thinking", "Rephrasing the ask…"); advance(3);
  return th.textContent === "Rephrasing the ask… 3s" ? true : JSON.stringify(th.textContent);
});
test("removing the marker stops its count (no interval outlives the wait)", function () {
  reset(); var before = liveTimers(), th = addMsg("thinking", "Re-rolling the scene...");
  if (liveTimers() !== before + 1) return "expected one new interval, have " + (liveTimers() - before);
  th.remove(); advance(1);
  return liveTimers() === before ? true : "the interval survived the marker's removal";
});
test("setThinking swaps the marker's words while the seconds keep counting from the start of the wait", function () {
  reset(); var th = addMsg("thinking", "Forging the campaign..."); advance(20);
  if (typeof setThinking !== "function") return "setThinking is not defined";
  setThinking(th, "Reviewing the campaign...");
  if (th.textContent !== "Reviewing the campaign... 20s") return "after the swap: " + JSON.stringify(th.textContent);
  advance(5);
  return th.textContent === "Reviewing the campaign... 25s" ? true : "the next tick: " + JSON.stringify(th.textContent);
});
test("other message types never tick (a narration, a player line, a system note)", function () {
  reset(); var before = liveTimers();
  var n = addMsg("narrator", "You stand at the gate."), p = addMsg("player", "I wait..."), s = addMsg("system", "Filing memories...");
  advance(4);
  if (liveTimers() !== before) return "a non-thinking message started an interval";
  return n.textContent === "You stand at the gate." && p.textContent === "I wait..." && s.textContent === "Filing memories..." ? true : "a message's text changed";
});

// ── Car Mode's status line ──
test("in Car Mode a GM turn's wait reads \"Thinking… Ns\" and counts", function () {
  reset(); carMode = true; addMsg("thinking", "The world turns...");
  if (carStatus.textContent !== "Thinking… 0s") return "at paint: " + JSON.stringify(carStatus.textContent);
  advance(9);
  return carStatus.textContent === "Thinking… 9s" ? true : "after 9s: " + JSON.stringify(carStatus.textContent);
});
test("the narration stops the count before \"Narrator speaking…\" is painted (the next tick must not overwrite it)", function () {
  reset(); carMode = true; addMsg("thinking", "The world turns..."); advance(4);
  addMsg("narrator", "The gate opens.");
  if (carStatus.textContent !== CAR_STR.narratorSpeaking) return "after the narration: " + JSON.stringify(carStatus.textContent);
  advance(3);
  return carStatus.textContent === CAR_STR.narratorSpeaking ? true : "a later tick overwrote it: " + JSON.stringify(carStatus.textContent);
});
test("every declared Car Mode wait ticks: retrying, getting options, transcribing", function () {
  if (typeof CAR_WAIT_STR === "undefined") return "CAR_WAIT_STR is not defined";
  var want = [CAR_STR.thinking, CAR_STR.retrying, CAR_STR.gettingOptions, CAR_STR.transcribing], bad = [];
  want.forEach(function (w) { if (!w || CAR_WAIT_STR.indexOf(w) < 0) bad.push(String(w)); });
  if (bad.length) return "not declared as waits: " + bad.join(", ");
  for (var i = 0; i < want.length; i++) {
    reset(); carMode = true; _carSetStatus(want[i]); advance(2);
    if (carStatus.textContent !== want[i] + " 2s") return want[i] + " did not count: " + JSON.stringify(carStatus.textContent);
  }
  return true;
});
test("a repeated wait keeps counting (the options poll re-paints every 300 ms)", function () {
  reset(); carMode = true; _carSetStatus(CAR_STR.gettingOptions); advance(1);
  _carSetStatus(CAR_STR.gettingOptions); advance(1);
  _carSetStatus(CAR_STR.gettingOptions);
  return carStatus.textContent === CAR_STR.gettingOptions + " 2s" ? true : "the count restarted: " + JSON.stringify(carStatus.textContent);
});
test("a status that is not a wait never ticks, and replaces a running count", function () {
  reset(); carMode = true; var before = liveTimers();
  _carSetStatus(CAR_STR.retrying); _carSetStatus(CAR_STR.listening); advance(3);
  if (carStatus.textContent !== CAR_STR.listening) return JSON.stringify(carStatus.textContent);
  return liveTimers() === before ? true : "the retry's interval kept running under Listening…";
});
test("a failed turn's error replaces the count (carNotify error)", function () {
  reset(); carMode = true; addMsg("thinking", "The world turns..."); advance(2);
  carNotify("error", "Network: Load failed"); advance(2);
  return carStatus.textContent === CAR_STR.errorPrefix + "Network: Load failed" ? true : JSON.stringify(carStatus.textContent);
});
test("leaving Car Mode stops a running count", function () {
  reset(); carMode = true; var before = liveTimers(); addMsg("thinking", "The world turns..."); advance(1);
  if (liveTimers() !== before + 2) return "expected two counts (the story marker and the car status), have " + (liveTimers() - before);
  hideCarMode(); advance(1);
  if (carStatus.textContent !== "") return "a tick repainted the hidden status: " + JSON.stringify(carStatus.textContent);
  return liveTimers() === before + 1 ? true : "the car status count outlived the overlay (the story marker's count rightly runs on: the turn is still in flight)";
});
test("stt.js sends the transcribing status Car Mode declares as a wait (the cross-lane literal must match CAR_STR)", function () {
  var stt = fs.readFileSync(path.join(ROOT, "stt.js"), "utf8");
  return stt.indexOf('carNotify("info", "' + CAR_STR.transcribing + '")') >= 0 ? true : "stt.js no longer sends " + JSON.stringify(CAR_STR.transcribing);
});

Date.now = function () { return new Date().getTime(); };
console.log((failed ? "FAIL" : "PASS") + " #481 G5 helper waits: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
