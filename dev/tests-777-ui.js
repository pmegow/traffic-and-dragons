// dev/tests-777-ui.js — audit 2026-11-19 (TODO #777), the DOM shells judged over a fake page.
//   C5  Back from an imported character restores the wizard · C6 an undecodable picture is refused, never stored
//   U5  the four hand-built modals (Respawn, Onward, Campaign ended, Health) are dialogs to the focus contract: built by
//       modalShell, so the story box behind them cannot take focus and Enter cannot send a turn; their look is the old one.
// The fake DOM is the #481 F3 suite's (focus, tabbables, keydown, aria-modal queries, a microtask MutationObserver). It
// shows what the code does; it is not a browser.
//   node dev/tests-777-ui.js              every case
//   node dev/tests-777-ui.js --only U5    the cases whose name contains the text
var assert = require("assert"), fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
var realLog = console.log, realErr = console.error;
console.warn = console.info = console.log = console.debug = function () {};
loader.loadEngine();
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var ACTIVE = null, OBSERVERS = [];
function El(tag, attrs) { this.tagName = String(tag).toUpperCase(); this.attrs = attrs || {}; this.children = []; this.parentNode = null; this.style = {}; this.listeners = {}; this.id = this.attrs.id || ""; this.disabled = !!this.attrs.disabled; }
function mutated(parent) { if (parent !== body) return; OBSERVERS.forEach(function (o) { if (!o.on) return; o.pending = true; if (!o.scheduled) { o.scheduled = true; Promise.resolve().then(function () { o.scheduled = false; if (o.on && o.pending) { o.pending = false; o.cb([{ type: "childList" }]); } }); } }); }
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); };
El.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; };
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); mutated(this); return c; };
El.prototype.remove = function () { if (this.parentNode) { var p = this.parentNode; p.children = p.children.filter(function (x) { return x !== this; }, this); this.parentNode = null; if (this.contains(ACTIVE)) ACTIVE = body; mutated(p); } };
El.prototype.contains = function (n) { if (n === this) return true; for (var i = 0; i < this.children.length; i++) if (this.children[i].contains(n)) return true; return false; };
El.prototype.focus = function () { ACTIVE = this; };
El.prototype.addEventListener = function (k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); };
El.prototype.fire = function (k, ev) { (this.listeners[k] || []).forEach(function (f) { f.call(this, ev); }, this); if (k === "click" && typeof this.onclick === "function") this.onclick(ev); };
El.prototype.isTabbable = function () { if (this.disabled) return false; var ti = this.getAttribute("tabindex"); if (ti !== null) return ti !== "-1"; return this.tagName === "BUTTON" || this.tagName === "INPUT" || this.tagName === "SELECT" || this.tagName === "TEXTAREA"; };
function walk(root, fn) { root.children.forEach(function (c) { fn(c); walk(c, fn); }); }
El.prototype.querySelectorAll = function (sel) { var out = []; walk(this, function (c) { if (sel === "[aria-modal='true']" ? c.getAttribute("aria-modal") === "true" : c.isTabbable()) out.push(c); }); return out; };
El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
Object.defineProperty(El.prototype, "firstChild", { get: function () { return this.children[0] || null; } });
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._html || ""; },
  set: function (html) { this._html = html; this.children = []; var box = new El("div"); box.parentNode = this; this.children.push(box);
    var re = /<(button|input|select|textarea|span)\b([^>]*)>/g, m; while ((m = re.exec(html))) { var a = {}, id = /id=['"]([^'"]+)['"]/.exec(m[2]); if (id) a.id = id[1]; var c = new El(m[1], a); c.parentNode = box; box.children.push(c); } }
});
var body = new El("body");
global.window = global;
global.MutationObserver = function (cb) { var o = { cb: cb, on: false, pending: false, scheduled: false }; OBSERVERS.push(o); this.observe = function () { o.on = true; }; this.disconnect = function () { o.on = false; o.pending = false; }; };
global.document = { body: body, get activeElement() { return ACTIVE; }, createElement: function (t) { return new El(t); },
  querySelectorAll: function (s) { return body.querySelectorAll(s); }, querySelector: function (s) { return body.querySelector(s); },
  getElementById: function (id) { var out = null; walk(body, function (c) { if (c.id === id) out = c; }); return out; } };
var geval = eval;
geval(src("ui-shell.js")); geval(src("ui-modals.js"));
closeAllMenus = function () {};
var input = new El("input", { id: "action-input" }); body.appendChild(input);
var sends = 0; sendAction = function () { sends++; };
input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendAction(); });
function key(k) { var ev = { key: k, shiftKey: false, preventDefault: function () {}, stopPropagation: function () {} }; var n = ACTIVE; while (n) { if (n.fire) n.fire("keydown", ev); n = n.parentNode; } }
var settle = function () { return new Promise(function (r) { setImmediate(r); }); };
function reset() { OBSERVERS.forEach(function (o) { o.on = false; }); OBSERVERS.length = 0; body.children.filter(function (c) { return c !== input; }).forEach(function (c) { c.remove(); }); OBSERVERS.forEach(function (o) { o.on = false; }); input.focus(); sends = 0; }
function world() { worldState = loader.makeTestWorld({}); migrateWorldState(worldState); worldState.campName = "The Long Road"; return worldState; }

var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }
/* the four, each with how it is opened, the control focus must land on, and whether Escape may close it */
var FOUR = [
  { id: "respawn-modal", open: function () { showRespawnModal({ camp: "the mill", respawn: 1 }, "slain by wolves"); }, focus: "respawn-ok", escape: true,
    overlay: "position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:320;display:flex;align-items:center;justify-content:center;padding:16px;",
    box: "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;max-width:480px;width:100%;padding:22px;font-family:var(--font);color:var(--t0);" },
  { id: "onward-modal", open: function () { showOnwardConfirmModal(); }, focus: "onward-no", escape: false,
    overlay: "position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:320;display:flex;align-items:center;justify-content:center;padding:16px;",
    box: "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;max-width:480px;width:100%;padding:22px;font-family:var(--font);color:var(--t0);" },
  { id: "ended-modal", open: function () { showCampaignEndedModal("slain"); }, focus: "ended-ok", escape: true,
    overlay: "position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:320;display:flex;align-items:center;justify-content:center;padding:16px;",
    box: "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;max-width:480px;width:100%;padding:22px;font-family:var(--font);color:var(--t0);" },
  { id: "health-modal", open: function () { showHealthModal(); }, focus: "hm-ok", escape: true,
    overlay: "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;",
    box: "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;max-width:460px;width:100%;max-height:85vh;overflow-y:auto;padding:16px;" }
];
FOUR.forEach(function (d) {
  kase("U5: " + d.id + " is a dialog — the story box behind it cannot take focus, Enter sends nothing, and it looks as it did", function () {
    reset(); world();
    return settle().then(function () {
      d.open(); return settle();
    }).then(function () {
      var m = document.getElementById(d.id);
      assert.ok(m, "fixture: the modal did not open");
      assert.strictEqual(m.getAttribute("aria-modal"), "true", d.id + " is not a dialog to the focus contract (no aria-modal)");
      assert.strictEqual(m.getAttribute("role"), "dialog");
      assert.ok(ACTIVE && ACTIVE !== input && m.contains(ACTIVE), "focus stayed on the story box behind " + d.id);
      assert.strictEqual(ACTIVE.id, d.focus, "focus landed on " + (ACTIVE.id || ACTIVE.tagName) + ", not on " + d.focus);
      assert.strictEqual(focusStoryBox(), false, "the story box took focus behind " + d.id);
      input.focus(); focusStoryBox();
      assert.strictEqual(typeof modalTopOpen, "function"); assert.strictEqual(modalTopOpen(), m);
      assert.strictEqual(m.style.cssText, d.overlay, "the overlay's look changed");
      assert.ok(m.innerHTML.indexOf("<div style='" + d.box + "'>") === 0, "the box's look changed: " + m.innerHTML.slice(0, 200));
      document.getElementById(d.focus).focus(); key("Enter");
      assert.strictEqual(sends, 0, "Enter sent a story turn from behind " + d.id);
      key("Escape"); return settle();
    }).then(function () {
      var still = !!document.getElementById(d.id);
      if (d.escape) assert.strictEqual(still, false, "Escape does not close " + d.id);
      else assert.strictEqual(still, true, "Escape closed " + d.id + " — a forced choice was skipped");
    });
  });
});
kase("U5: the modals' own buttons still do their work, and closing one gives the keyboard back", function () {
  reset(); world(); var chose = [], realChoose = deathSceneChoose, realConfirm = deathSceneOnwardConfirm;
  deathSceneChoose = function (c) { chose.push("choose:" + c); }; deathSceneOnwardConfirm = function () { chose.push("onward"); };
  return settle().then(function () {
    showOnwardConfirmModal(); return settle();
  }).then(function () {
    document.getElementById("onward-no").fire("click", {}); return settle();
  }).then(function () {
    assert.deepStrictEqual(chose, ["choose:back"]); assert.strictEqual(document.getElementById("onward-modal"), null);
    showOnwardConfirmModal(); return settle();
  }).then(function () {
    document.getElementById("onward-yes").fire("click", {}); return settle();
  }).then(function () {
    assert.deepStrictEqual(chose, ["choose:back", "onward"]);
    deathSceneChoose = realChoose; deathSceneOnwardConfirm = realConfirm;
    showRespawnModal({ camp: "the mill", respawn: 1 }, "slain"); return settle();
  }).then(function () {
    document.getElementById("respawn-ok").fire("click", {}); return settle();
  }).then(function () {
    assert.strictEqual(document.getElementById("respawn-modal"), null, "Wake did not close the modal");
    assert.strictEqual(ACTIVE, input, "the keyboard did not come back to the story box");
    showHealthModal(); return settle();
  }).then(function () {
    document.getElementById("hm-close").fire("click", {}); return settle();
  }).then(function () {
    assert.strictEqual(document.getElementById("health-modal"), null, "the health modal's × did not close it");
    showCampaignEndedModal("slain"); return settle();
  }).then(function () {
    document.getElementById("ended-ok").fire("click", {}); return settle();
  }).then(function () { assert.strictEqual(document.getElementById("ended-modal"), null); });
});
kase("U5 derived: every modal the game builds by hand is a dialog to the focus contract, or is exempt with its reason", function () {
  var EXEMPT = { "loading-modal": "a wait indicator with no control of its own; not a finding of the audit, left as it was" };
  var bad = [], seen = [];
  fs.readdirSync(ROOT).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    var s = src(f), re = /\.id\s*=\s*["']([a-z0-9-]*-modal)["']/g, m;
    while ((m = re.exec(s))) {
      seen.push(m[1]);
      if (EXEMPT[m[1]]) continue;
      var near = s.slice(m.index, m.index + 400);
      if (!/setAttribute\("aria-modal","true"\)/.test(near)) bad.push(f + ": " + m[1] + " is built by hand with no aria-modal");
    }
  });
  assert.ok(seen.indexOf("loading-modal") >= 0, "fixture: the scan no longer finds hand-built modals: " + seen);
  assert.deepStrictEqual(bad, [], "a hand-built modal is not a dialog — focusStoryBox would focus the story box behind it");
  Object.keys(EXEMPT).forEach(function (k) { assert.ok(seen.indexOf(k) >= 0, "the exemption for " + k + " names a modal that is gone"); });
});

// ── C5, C6 (2026-11-20): the wizard's import and the portrait upload, over the same fake page ──────────────────────
kase("C5: Back from an imported character puts the wizard back as it was — a fresh hero never starts on the import's leftovers", function () {
  geval(src("ui-browsers.js"));
  var went = [], realGo = (typeof goStep === "function") ? goStep : null;
  goStep = function (n) { went.push(n); cs.step = n; if (n > (cs.reached || 0)) cs.reached = n; };
  rvSyncXp = function () {};
  cs = blankWizardState(); cs.tone = "grim"; cs.step = 1; cs.reached = 1; pendingImportChar = null;
  _importCharToReview({ name: "Kael", gender: "M", age: "thirties", ancestry: "Elf", cls: "Rogue", level: 3 });
  assert.strictEqual(cs.step, 6, "fixture: the import did not go to the review"); assert.strictEqual(cs.ancestry, "Elf");
  wizardReviewBack();
  assert.strictEqual(pendingImportChar, null, "the import is still pending after Back");
  assert.strictEqual(cs.ancestry, null, "the imported ancestry (a display name, not an id) is left in the fresh hero's wizard");
  assert.strictEqual(cs.cls, null, "the imported class is left in the wizard"); assert.strictEqual(cs.name, "", "the imported name is left in the wizard");
  assert.strictEqual(cs.tone, "grim", "the player's own choice was lost");
  assert.strictEqual(cs.step, 1, "Back did not return to the step the player was on (it went to " + cs.step + ")");
  assert.strictEqual(cs.reached, 1, "the progress bar still links ahead to steps the player never did: reached " + cs.reached);
  // a second import before Back keeps the FIRST snapshot
  cs.step = 3; cs.reached = 3; cs.cls = "Wizard";
  _importCharToReview({ name: "A", ancestry: "Elf", cls: "Rogue" }); _importCharToReview({ name: "B", ancestry: "Dwarf", cls: "Cleric" });
  wizardReviewBack();
  assert.strictEqual(cs.cls, "Wizard", "a second import replaced the snapshot of the player's own wizard: " + cs.cls); assert.strictEqual(cs.step, 3);
  // no import: Back from the review is the ordinary step back
  cs.step = 6; went.length = 0; wizardReviewBack();
  assert.deepStrictEqual(went, [5], "without an import, Back from the review no longer goes to step 5");
  assert.ok(/getElementById\("rv-back"\)\.addEventListener\("click",function\(\)\{wizardReviewBack\(\);\}\)/.test(src("ui-boot.js")), "the review's Back button is not wired to it");
  if (realGo) goStep = realGo;
});
kase("C6: a file the browser cannot read as an image is refused and said — it is never stored as the portrait", function () {
  geval(src("ui-portrait.js"));
  var toasts = [], got = "unset";
  showToast = function (m) { toasts.push(String(m)); };
  global.Image = function () { var self = this; Object.defineProperty(this, "src", { set: function () { setImmediate(function () { if (self.onerror) self.onerror(); }); } }); };
  compressPortrait("data:image/heic;base64,AAAA", function (v) { got = v; });
  return settle().then(settle).then(function () {
    assert.strictEqual(got, null, "an undecodable file was handed on as the portrait: " + String(got).slice(0, 40));
    assert.ok(toasts.some(function (t) { return /could not be read as an image/.test(t); }), "the player is not told why the picture never shows: " + JSON.stringify(toasts));
    // every caller refuses a null — none stores it
    var bad = [];
    ["char-creation.js", "game.js", "ui-boot.js", "ui-portrait.js"].forEach(function (f) {
      var s = src(f), re = /compressPortrait\(([^,()]+(?:\.[a-zA-Z.]+)?),function\((\w+)\)\{\s*([^\n]{0,160})/g, m, tail;
      while ((m = re.exec(s))) { tail = s.slice(m.index, m.index + 420); if (!new RegExp("if\\(!" + m[2] + "\\)").test(tail)) bad.push(f + ": " + tail.slice(0, 90)); }
    });
    var calls = ["char-creation.js", "game.js", "ui-boot.js", "ui-portrait.js"].reduce(function (n, f) { return n + (src(f).match(/compressPortrait\(/g) || []).length; }, 0);
    assert.ok(calls >= 6, "fixture: the callers were not found (" + calls + ")");
    assert.deepStrictEqual(bad, [], "a caller stores whatever it is handed, a refused picture included");
    // a link that answers with an error page is not read as a picture
    ["ui-portrait.js", "char-creation.js", "game.js"].forEach(function (f) { var s = src(f), n = (s.match(/the image could not be fetched \(HTTP /g) || []).length; assert.ok(n >= 1, f + " reads the body of a failed image request as the picture"); });
  });
});
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
function next(i) {
  if (i >= todo.length) {
    if (failed) { realErr.call(console, "#777 ui: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    realLog.call(console, "ALL GREEN — " + passed + " #777 ui cases"); process.exit(0);
  }
  var c = todo[i];
  function ok() { passed++; realLog.call(console, "PASS #777 " + c.name); next(i + 1); }
  function bad(e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n    ")); next(i + 1); }
  try { var r = c.fn(); if (r && typeof r.then === "function") r.then(ok, bad); else ok(); } catch (e) { bad(e); }
}
next(0);
