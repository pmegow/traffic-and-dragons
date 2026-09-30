// tests-481-f3-focus-behind-dialog.js — #481 F3 (audit 2026-09-29, Fable-approved): keyboard focus fell back to the story box
// BEHIND an open dialog, so Enter sent a story turn (#442 promised it could not). Two paths:
//   • an in-place sheet re-render is modalShell(same id): the OLD dialog's removal observer fired a microtask later — after
//     the new dialog had taken focus — and "restored" focus to the story box behind it;
//   • the end of sendAction focused the story box even while a dialog (the item-canon ask, a sheet) was open.
// Fable: the test must use the MICROTASK observer model — this fake MutationObserver batches records and delivers them in a
// microtask, as the platform does (tests-442 calls the restore by hand, which is why it stayed green). Real ui-shell.js.
//   node dev/tests-481-f3-focus-behind-dialog.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();

// ── a DOM fake: focus, tabbables, keydown, aria-modal queries and a microtask MutationObserver ─────────────
var ACTIVE = null, OBSERVERS = [];
function El(tag, attrs) {
  this.tagName = String(tag).toUpperCase(); this.attrs = attrs || {}; this.children = []; this.parentNode = null; this.style = {}; this.listeners = {}; this.id = this.attrs.id || ""; this.disabled = !!this.attrs.disabled;
}
function mutated(parent) { if (parent !== body) return; OBSERVERS.forEach(function (o) { if (!o.on) return; o.pending = true; if (!o.scheduled) { o.scheduled = true; Promise.resolve().then(function () { o.scheduled = false; if (o.on && o.pending) { o.pending = false; o.cb([{ type: "childList" }]); } }); } }); }
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); };
El.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; };
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); mutated(this); return c; };
El.prototype.remove = function () { if (this.parentNode) { var p = this.parentNode; p.children = p.children.filter(function (x) { return x !== this; }, this); this.parentNode = null; if (this.contains(ACTIVE)) ACTIVE = body; mutated(p); } };
El.prototype.contains = function (n) { if (n === this) return true; for (var i = 0; i < this.children.length; i++) if (this.children[i].contains(n)) return true; return false; };
El.prototype.focus = function () { ACTIVE = this; };
El.prototype.addEventListener = function (k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); };
El.prototype.fire = function (k, ev) { (this.listeners[k] || []).forEach(function (f) { f(ev); }); };
El.prototype.isTabbable = function () {
  if (this.disabled) return false;
  var ti = this.getAttribute("tabindex"); if (ti !== null) return ti !== "-1";
  return this.tagName === "BUTTON" || this.tagName === "INPUT" || this.tagName === "SELECT" || this.tagName === "TEXTAREA";
};
function walk(root, fn) { root.children.forEach(function (c) { fn(c); walk(c, fn); }); }
El.prototype.querySelectorAll = function (sel) { var out = []; walk(this, function (c) { if (sel === "[aria-modal='true']" ? c.getAttribute("aria-modal") === "true" : c.isTabbable()) out.push(c); }); return out; };
El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
Object.defineProperty(El.prototype, "firstChild", { get: function () { return this.children[0] || null; } });
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._html || ""; },
  set: function (html) { this._html = html; this.children = []; var box = new El("div"); box.parentNode = this; this.children.push(box);
    var re = /<(button|input|select|textarea)\b([^>]*)>/g, m; while ((m = re.exec(html))) { var a = {}, id = /id=['"]([^'"]+)['"]/.exec(m[2]); if (id) a.id = id[1]; var c = new El(m[1], a); c.parentNode = box; box.children.push(c); } }
});
var body = new El("body");
global.window = global;
global.MutationObserver = function (cb) { var o = { cb: cb, on: false, pending: false, scheduled: false }; OBSERVERS.push(o);
  this.observe = function () { o.on = true; }; this.disconnect = function () { o.on = false; o.pending = false; }; };
global.document = { body: body, get activeElement() { return ACTIVE; }, createElement: function (t) { return new El(t); },
  querySelectorAll: function (s) { return body.querySelectorAll(s); }, querySelector: function (s) { return body.querySelector(s); },
  getElementById: function (id) { var out = null; walk(body, function (c) { if (c.id === id) out = c; }); return out; } };
var geval = eval; geval(fs.readFileSync(path.join(ROOT, "ui-shell.js"), "utf8"));
var input = new El("input", { id: "action-input" }); body.appendChild(input);
var sends = 0; sendAction = function () { sends++; };
input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendAction(); });   /* the story box behind the overlay */
function enter() { var ev = { key: "Enter", shiftKey: false, preventDefault: function () {}, stopPropagation: function () {} }; if (ACTIVE && ACTIVE.fire) ACTIVE.fire("keydown", ev); }
function sheet() { return modalShell("cs-modal", "<button id='cs-close'>Close</button><button id='cs-drop'>Drop</button>", { closeId: "cs-close" }); }
var settle = function () { return new Promise(function (r) { setImmediate(r); }); };
function reset() { OBSERVERS.forEach(function (o) { o.on = false; }); OBSERVERS.length = 0; body.children.filter(function (c) { return c !== input; }).forEach(function (c) { c.remove(); }); OBSERVERS.forEach(function (o) { o.on = false; }); input.focus(); sends = 0; }

var failed = 0, passed = 0, tests = [];
function test(name, fn) { tests.push([name, fn]); }
test("the repro: an in-place sheet re-render (same-id modalShell) keeps focus in the dialog — Enter never reaches the story box", async function () {
  reset(); await settle();
  sheet(); await settle();
  if (!ACTIVE || ACTIVE === input) return "fixture: the sheet did not take focus";
  sheet(); await settle();                                   /* the re-render: the old dialog removed, a new one appended */
  if (!document.getElementById("cs-modal")) return "fixture: the sheet is gone";
  if (ACTIVE === input) return "focus fell back to the story box BEHIND the open sheet (the old dialog's observer restored it)";
  enter(); return sends === 0 ? true : "Enter behind the open dialog sent a story turn";
});
test("the re-created dialog inherits the original opener: closing it gives focus back to the story box", async function () {
  reset(); await settle();
  sheet(); await settle(); sheet(); await settle();
  document.getElementById("cs-close").fire("click", {}); await settle();
  if (document.getElementById("cs-modal")) return "fixture: the sheet did not close";
  return ACTIVE === input ? true : "focus did not return to the story box that opened the first sheet (active " + (ACTIVE && (ACTIVE.id || ACTIVE.tagName)) + ")";
});
test("a stacked dialog closing returns focus to its opener INSIDE the dialog beneath — never to the story box behind both", async function () {
  reset(); await settle();
  sheet(); await settle(); var drop = document.getElementById("cs-drop"); drop.focus();
  var ask = modalShell("item-ask", "<button id='ia-ok'>OK</button>", { closeId: "ia-ok" }); await settle();
  if (ACTIVE && ACTIVE.id !== "ia-ok") return "fixture: the ask did not take focus";
  document.getElementById("ia-ok").fire("click", {}); await settle();
  if (ACTIVE === input) return "focus fell to the story box behind the open sheet";
  return ACTIVE === drop ? true : "focus did not return to the sheet button that opened the ask (active " + (ACTIVE && (ACTIVE.id || ACTIVE.tagName)) + ")";
});
test("a dialog removed while another stays open never hands focus to the story box behind the one still open", async function () {
  reset(); await settle();
  var a = modalShell("a-modal", "<button id='a1'>A</button>", {}); await settle();         /* opened from the story box */
  modalShell("b-modal", "<button id='b1'>B</button>", {}); await settle();                  /* a second dialog on top */
  document.getElementById("a1").focus();
  a.remove(); await settle();                                                                /* a caller removes the first */
  if (ACTIVE === input) return "focus went to the story box behind the dialog still open";
  enter(); return sends === 0 ? true : "Enter sent a story turn from behind the open dialog";
});
test("a caller's own remove() never steals focus that already moved somewhere live", async function () {
  reset(); await settle();
  var m = sheet(); await settle();
  var other = new El("button", { id: "elsewhere" }); body.appendChild(other); other.focus();
  m.remove(); await settle();
  return ACTIVE === other ? true : "the restore stole focus from a live element (active " + (ACTIVE && (ACTIVE.id || ACTIVE.tagName)) + ")";
});
test("focusStoryBox yields while a dialog is open and focuses the story box when none is", async function () {
  reset(); await settle();
  if (typeof focusStoryBox !== "function") return "focusStoryBox is missing (ui-shell.js)";
  sheet(); await settle(); var inside = ACTIVE;
  if (focusStoryBox() !== false || ACTIVE !== inside) return "focusStoryBox moved focus behind the open sheet";
  document.getElementById("cs-close").fire("click", {}); await settle(); var b = new El("button"); body.appendChild(b); b.focus();
  return focusStoryBox() === true && ACTIVE === input ? true : "with no dialog open the story box must take focus";
});
test("source: the end of sendAction puts focus back through focusStoryBox, never a bare action-input focus", function () {
  var g = fs.readFileSync(path.join(ROOT, "game.js"), "utf8"), a = g.indexOf("async function sendAction("), b = g.indexOf("\nfunction ", a + 10), body = g.slice(a, b > 0 ? b : undefined);
  if (a < 0) return "sendAction not found";
  if (/getElementById\("action-input"\)\.focus\(\)/.test(body)) return "sendAction still focuses the story box directly";
  return /focusStoryBox\(/.test(body) ? true : "sendAction must call focusStoryBox";
});

(async function () {
  for (var i = 0; i < tests.length; i++) {
    var name = tests[i][0], r;
    try { r = await tests[i][1](); } catch (e) { r = "threw " + (e && e.stack || e); }
    if (r === true) { passed++; console.log("PASS #481 F3 " + name); } else { failed++; console.error("FAIL #481 F3 " + name + " — " + r); }
  }
  console.log("#481 F3 FOCUS: " + failed + " failed, " + passed + " passed");
  process.exit(failed ? 1 : 0);
})();
