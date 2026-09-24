// tests-440-render-job.js — #440 (Astra review R3): a delayed scene render must never land in the campaign loaded
// afterward. Drives the REAL doRender with a held prompt writer and a held image service, switching the campaign
// in between (the review's reproduction), through DOM stubs.
//   • prompt boundary: the writer answers after a switch → nothing added to the new story, a loud drop
//   • control: no switch → the render-out block lands with the prompt
//   • image boundary: the image arrives after a switch → the block is removed, no <img>, a loud drop
//   • the Save pointer stamps the turn the render STARTED on, not the turn Save is clicked on
//   node dev/tests-440-render-job.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();

function stubEl() {
  var e = { style: {}, children: [], listeners: {}, textContent: "", innerHTML: "", disabled: false, isConnected: true, parentNode: null, removed: false,
    appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; }, remove: function () { e.removed = true; },
    addEventListener: function (k, f) { (e.listeners[k] = e.listeners[k] || []).push(f); }, querySelector: function () { return null; },
    setAttribute: function () {}, insertBefore: function () {} };
  return e;
}
global.window = global;
global.document = { createElement: function () { return stubEl(); }, getElementById: function () { return null; }, querySelector: function () { return null; }, body: { appendChild: function () {} } };
var msgs = [], toasts = [], warns = [];
addMsg = function (kind) { var e = stubEl(); e.kind = kind; msgs.push(e); return e; };
showToast = function (m) { toasts.push(String(m)); };
console.warn = function (m) { warns.push(String(m)); };
saveAll = function () {}; buildFilename = function () { return "render.png"; };
if (typeof escHtml !== "function") escHtml = function (s) { return String(s); };
renderAllowanceExhausted = function () { return null; };
function fresh(id, name) { var w = loader.makeTestWorld(); worldState = w; worldState.campId = id; worldState.campName = name; worldState.turn = 10; msgs.length = 0; toasts.length = 0; warns.length = 0; return w; }
function renderOut() { return msgs.filter(function (m) { return m.kind === "render-out"; }); }
function tick(n) { return new Promise(function (r) { setTimeout(r, n || 20); }); }
function findBtn(div, label) { var out = null; (function walk(e) { (e.children || []).forEach(function (c) { if (c.textContent === label) out = c; walk(c); }); })(div); return out; }

var pass = 0, fails = [], chain = Promise.resolve();
function t(name, fn) { chain = chain.then(function () { return Promise.resolve().then(fn).then(function (why) { if (!why) { pass++; console.log("PASS " + name); } else { fails.push(name + " — " + why); console.error("FAIL " + name + " — " + why); } }, function (e) { fails.push(name + " — threw: " + (e && e.message)); console.error("FAIL " + name + " — threw: " + (e && e.stack || e)); }); }); }

t("prompt boundary: the writer answers after a campaign switch → nothing lands in the new story, a loud drop, the latch clears", function () {
  fresh("camp_A", "Alpha"); var held; callGM = function () { return new Promise(function (r) { held = r; }); }; falAvailable = function () { return false; };
  var p = doRender();
  return tick().then(function () {
    if (!held) return "the writer was not called";
    fresh("camp_B", "Beta");/* the review's campLoad — a different campaign is live now */
    held("A moonlit vault, Ammut at the door.");
    return p;
  }).then(function () {
    if (renderOut().length) return "the old campaign's render-out block landed in the new story";
    if (!warns.some(function (w) { return /#440/.test(w) && /Alpha/.test(w) && /scene prompt/.test(w); })) return "no loud drop: " + JSON.stringify(warns);
    if (!toasts.some(function (x) { return /discarded/.test(x); })) return "no toast: " + JSON.stringify(toasts);
    if (_rendering) return "the render latch stayed up";
    return null;
  });
});
t("control: no switch → the render-out block lands with the prompt text", function () {
  fresh("camp_A", "Alpha"); callGM = function () { return Promise.resolve("A moonlit vault."); }; falAvailable = function () { return false; };
  return doRender().then(function () {
    var ro = renderOut(); if (ro.length !== 1) return "expected one render-out block, got " + ro.length;
    if (!ro[0].children.some(function (c) { return c.textContent === "A moonlit vault."; })) return "the prompt panel is missing";
    if (warns.some(function (w) { return /#440/.test(w); })) return "a live render was dropped";
    return null;
  });
});
t("image boundary: the image arrives after a campaign switch → the block is removed, no <img>, a loud drop", function () {
  fresh("camp_A", "Alpha"); callGM = function () { return Promise.resolve("A moonlit vault."); }; falAvailable = function () { return true; };
  var mdl = RENDER_MODELS.filter(function (m) { return !m.slow; })[0]; if (!mdl) return "fixture: no non-queued render model"; renderModel = mdl.id;
  var heldFal; falFetch = function () { return new Promise(function (r) { heldFal = r; }); };
  var p = doRender();
  return tick(40).then(function () {
    if (!heldFal) return "the image service was not called";
    var div = renderOut()[0]; if (!div) return "the render-out block was not created before the image call";
    fresh("camp_B", "Beta");
    heldFal({ ok: true, json: function () { return Promise.resolve({ images: [{ url: "https://img.test/scene.png" }] }); } });
    return p.then(function () { return div; });
  }).then(function (div) {
    if (!div.removed) return "the stale block was not removed from the story";
    if (div.children.some(function (c) { return c.alt === "Scene illustration"; })) return "an <img> was appended to a stale render";
    if (!warns.some(function (w) { return /#440/.test(w) && /the image/.test(w); })) return "no loud drop: " + JSON.stringify(warns);
    if (_rendering) return "the render latch stayed up";
    return null;
  });
});
t("the Save pointer stamps the turn the render STARTED on (turn 10), not the turn Save is clicked on (turn 11); a stale job refuses to save", function () {
  fresh("camp_A", "Alpha"); callGM = function () { return Promise.resolve("A moonlit vault."); }; falAvailable = function () { return true; };
  var mdl = RENDER_MODELS.filter(function (m) { return !m.slow; })[0]; renderModel = mdl.id;
  falFetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ images: [{ url: "https://img.test/scene.png" }] }); } }); };
  var captured = null; saveRenderImage = function (blob, fname, turn) { captured = turn; return Promise.resolve(true); };
  global.fetch = function () { return Promise.resolve({ blob: function () { return Promise.resolve("BLOB"); } }); };
  return doRender().then(function () {
    var div = renderOut()[0]; if (!div) return "no render-out block";
    var save = findBtn(div, "↓ Save"); if (!save || !save.listeners.click) return "no Save button with a click handler";
    worldState.turn = 11;/* the player played on before saving */
    save.listeners.click[0]();
    return tick(30);
  }).then(function () {
    if (captured !== 10) return "the pointer stamped turn " + captured + " — it must be the render's own turn 10";
    var div = renderOut()[0], save = findBtn(div, "↓ Save"); captured = null; toasts.length = 0;
    fresh("camp_B", "Beta");/* the scene's campaign is gone */
    save.listeners.click[0]();
    return tick(30);
  }).then(function () {
    if (captured !== null) return "a stale render saved into the new campaign";
    if (!toasts.some(function (x) { return /no longer loaded/.test(x); })) return "a refused save must say why: " + JSON.stringify(toasts);
    return null;
  });
});

chain.then(function () {
  console.log("#440 RENDER JOB: " + fails.length + " failed, " + pass + " passed");
  process.exit(fails.length ? 1 : 0);
});
