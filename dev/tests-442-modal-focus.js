// tests-442-modal-focus.js — #442 (Astra review R5): the shared modal shell contains the keyboard. Through the real
// modalShell (ui-shell.js) on a small DOM fake that models focus, tabbable descendants and key events:
//   • opening moves focus off the story box into the dialog (Enter can no longer reach sendAction behind it)
//   • Tab from the last control wraps to the first; Shift+Tab from the first wraps to the last; nothing leaves
//   • Escape closes a dismissible dialog and gives focus back to the opener; a forced choice ignores Escape
//   • a caller's own modal.remove() also restores focus (the observer path is exercised via _restoreFocus)
//   node dev/tests-442-modal-focus.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();

// ── a DOM fake: enough for focus, tabbables and keydown ──────────────────────
var ACTIVE = null;
function El(tag, attrs) {
  this.tagName = String(tag).toUpperCase(); this.attrs = attrs || {}; this.children = []; this.parentNode = null; this.style = {}; this.listeners = {}; this.id = this.attrs.id || ""; this.disabled = !!this.attrs.disabled;
}
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); };
El.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; };
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
El.prototype.remove = function () { if (this.parentNode) { var p = this.parentNode; p.children = p.children.filter(function (x) { return x !== this; }, this); this.parentNode = null; } };
El.prototype.contains = function (n) { if (n === this) return true; for (var i = 0; i < this.children.length; i++) if (this.children[i].contains(n)) return true; return false; };
El.prototype.focus = function () { ACTIVE = this; };
El.prototype.addEventListener = function (k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); };
El.prototype.fire = function (k, ev) { (this.listeners[k] || []).forEach(function (f) { f(ev); }); };
El.prototype.isTabbable = function () {
  if (this.disabled) return false;
  var ti = this.getAttribute("tabindex"); if (ti !== null) return ti !== "-1";
  return this.tagName === "BUTTON" || this.tagName === "INPUT" || this.tagName === "SELECT" || this.tagName === "TEXTAREA" || (this.tagName === "A" && this.getAttribute("href") !== null);
};
El.prototype.querySelectorAll = function () { var out = []; (function walk(e) { e.children.forEach(function (c) { if (c.isTabbable()) out.push(c); walk(c); }); })(this); return out; };
El.prototype.querySelector = function () { return null; };
Object.defineProperty(El.prototype, "firstChild", { get: function () { return this.children[0] || null; } });
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._html || ""; },
  set: function (html) { this._html = html; this.children = []; var box = new El("div"); this.appendChild(box);
    /* the shell wraps innerHtml in one box; the fake turns each <button id=..> / <input id=..> into a child control */
    var re = /<(button|input|select|textarea)\b([^>]*)>/g, m; while ((m = re.exec(html))) { var a = {}, id = /id=['"]([^'"]+)['"]/.exec(m[2]); if (id) a.id = id[1]; if (/\bdisabled\b/.test(m[2])) a.disabled = true; box.appendChild(new El(m[1], a)); } }
});
var body = new El("body");
global.window = global;
global.document = { body: body, get activeElement() { return ACTIVE; },
  createElement: function (t) { return new El(t); },
  getElementById: function (id) { var out = null; (function walk(e) { e.children.forEach(function (c) { if (c.id === id) out = c; walk(c); }); })(body); return out; } };
var geval = eval; geval(fs.readFileSync(path.join(ROOT, "ui-shell.js"), "utf8"));
function key(k, shift) { var ev = { key: k, shiftKey: !!shift, target: ACTIVE, prevented: false, preventDefault: function () { ev.prevented = true; }, stopPropagation: function () {} }; return ev; }
function open(opts) { return modalShell("t-modal", "<button id='b1'>One</button><input id='in1'><button id='b2'>Two</button>", opts); }
var input = new El("input", { id: "action-input" }); body.appendChild(input);
var sends = 0; sendAction = function () { sends++; };
input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendAction(); });/* the story box behind the overlay */
var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS " + name); } else { failed++; console.error("FAIL " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL " + name + " — threw: " + (e && e.stack || e.message)); } }
function reset() { var old = document.getElementById("t-modal"); if (old) old.remove(); input.focus(); sends = 0; }

test("opening moves focus off the story box into the dialog's first control — Enter reaches the dialog, never sendAction", function () {
  reset(); var m = open({});
  if (ACTIVE === input) return "focus stayed on action-input";
  if (!ACTIVE || ACTIVE.id !== "b1") return "expected the first control focused, got " + (ACTIVE && ACTIVE.id);
  ACTIVE.fire("keydown", key("Enter")); return sends === 0 ? true : "Enter reached sendAction behind the dialog";
});
test("Tab from the last control wraps to the first; Shift+Tab from the first wraps to the last; the story box is never reached", function () {
  reset(); var m = open({}); var b2 = document.getElementById("b2"), b1 = document.getElementById("b1");
  b2.focus(); var ev = key("Tab"); m.fire("keydown", ev);
  if (!ev.prevented || ACTIVE !== b1) return "Tab from the last did not wrap to the first (active " + (ACTIVE && ACTIVE.id) + ")";
  b1.focus(); ev = key("Tab", true); m.fire("keydown", ev);
  if (!ev.prevented || ACTIVE !== b2) return "Shift+Tab from the first did not wrap to the last (active " + (ACTIVE && ACTIVE.id) + ")";
  var in1 = document.getElementById("in1"); in1.focus(); ev = key("Tab"); m.fire("keydown", ev);
  return !ev.prevented && ACTIVE === in1 ? true : "a middle Tab was intercepted — the browser's own order must run inside the dialog";
});
test("Escape closes a dismissible dialog and gives focus back to the opener", function () {
  reset(); var m = open({ outside: true }); var ev = key("Escape"); m.fire("keydown", ev);
  if (document.getElementById("t-modal")) return "the dialog is still open";
  return ACTIVE === input ? true : "focus did not return to the opener (active " + (ACTIVE && ACTIVE.id) + ")";
});
test("a forced choice (wireClose:false) ignores Escape; noEscape:true too", function () {
  reset(); var m = open({ wireClose: false }); m.fire("keydown", key("Escape"));
  if (!document.getElementById("t-modal")) return "a forced choice closed on Escape";
  reset(); m = open({ noEscape: true }); m.fire("keydown", key("Escape"));
  return document.getElementById("t-modal") ? true : "noEscape closed on Escape";
});
test("a caller's own modal.remove() also restores focus to the opener (the observer's path)", function () {
  reset(); var m = open({}); if (ACTIVE === input) return "fixture";
  m.remove(); if (typeof m._restoreFocus !== "function") return "no restore hook"; m._restoreFocus();
  return ACTIVE === input ? true : "focus not restored after the caller removed the dialog";
});
test("a dialog with no controls focuses its box so keys still land inside it", function () {
  reset(); var m = modalShell("t-modal", "<div>Just text</div>", {}); var box = m.firstChild;
  return ACTIVE === box && box.getAttribute("tabindex") === "-1" ? true : "the box was not focused (active " + (ACTIVE && ACTIVE.tagName) + ")";
});
console.log("#442 MODAL FOCUS: " + failed + " failed, " + passed + " passed");
process.exit(failed ? 1 : 0);
