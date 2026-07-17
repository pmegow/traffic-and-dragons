// tests-modal-shell.js — AUDIT_FABLE_07_16_2026 #14: the ONE modal scaffold (modalShell,
// ui-shell.js). Asserts against LEGACY scaffold strings captured verbatim from git HEAD
// (v1.332, pre-conversion) so the shell provably rebuilds each modal's overlay + box
// cssText byte-identically:
//   • z-300 flex-start scroller  — rules-modal (ui-modals.js:35-36 @ HEAD)
//   • z-300 flex-center          — usage-modal (ui-modals.js:254-255 @ HEAD)
//   • custom maxWidth, z-400     — char-export-opts (ui-browsers.js:541-543 @ HEAD)
//   • touch-scroll sheet variant — cs-modal (ui-sheets.js:136-138 @ HEAD)
//   • bg/boxCss overrides        — cap-card-modal (ui-sheets.js:118-119 @ HEAD)
//   • #181818 legacy box         — arch-modal (game.js:419-421 @ HEAD)
// Plus remove-prior-by-id semantics and wireClose:false skipping ALL close listeners.
//
// UNWIRED fragment — not loaded by run-tests.js or test.html. Run standalone:
//   node dev/tests-modal-shell.js
//
// Engine-tests style (section/t/eq reporter, same shape as dev/tests-dedup-b.js). ES5.

var fs = require("fs"), path = require("path");
var geval = eval;
// modalShell lives in ui-shell.js (function-declaration-only at top level — geval-safe headless).
try { geval(fs.readFileSync(path.join(__dirname, "..", "ui-shell.js"), "utf8")); }
catch (e) { console.error("UI LOAD FAILED in ui-shell.js: " + e.message); process.exit(1); }

// ── Reporter (mirrors run-tests.js) ──────────────────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function eq(got, want, label) { if (got === want) return true; return (label || "") + " expected " + JSON.stringify(want) + " got " + JSON.stringify(got); }
function t(name, fn) {
  var label = curSection + " › " + name;
  try {
    var r = fn();
    if (r === true || r === undefined) pass++;
    else fails.push(label + " — " + r);
  } catch (e) { fails.push(label + " — threw: " + e.message); }
}

// ── Stubbed document ─────────────────────────────────────────────────────────
// Minimal surface modalShell touches: getElementById / createElement / body.appendChild,
// element .id/.style.cssText/.innerHTML/.addEventListener/.remove. innerHTML is stored RAW
// (no parsing) — the box style is asserted by extracting the style='…' attribute from it.
function stubEl() {
  return { id: "", style: { cssText: "" }, innerHTML: "", listeners: {}, removed: false,
    addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    remove: function () { this.removed = true; } };
}
function withDoc(existing, fn) {
  var els = existing || {};
  var body = stubEl();
  body.appendChild = function (el) { if (el.id) els[el.id] = el; body._appended = el; };
  global.document = {
    body: body,
    createElement: function () { return stubEl(); },
    getElementById: function (id) { return els[id] || null; }
  };
  try { return fn(els, body); } finally { delete global.document; }
}
function boxStyleOf(modal) { // extract the box div's style attribute from the raw innerHTML
  var m = /^<div style='([^']*)'>/.exec(modal.innerHTML);
  return m ? m[1] : "(no box div: " + modal.innerHTML.slice(0, 60) + ")";
}

// ── Byte-parity vs legacy scaffolds (verbatim from HEAD, pre-conversion) ─────
section("modalShell byte-parity");
t("rules-modal shape: z-300 flex-start scroller + mw520 mt40 box", function () {
  // ui-modals.js:35-36 @ HEAD, verbatim:
  var wantOverlay = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var wantBox = "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  return withDoc(null, function () {
    var m = modalShell("rules-modal", "", { align: "flex-start", overlayExtra: "overflow-y:auto;", maxWidth: 520, boxExtra: "margin-top:40px;", wireClose: false });
    var r = eq(m.style.cssText, wantOverlay, "overlay"); if (r !== true) return r;
    return eq(boxStyleOf(m), wantBox, "box");
  });
});
t("usage-modal shape: z-300 flex-center + mw560 box", function () {
  // ui-modals.js:254-255 @ HEAD, verbatim:
  var wantOverlay = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  var wantBox = "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;";
  return withDoc(null, function () {
    var m = modalShell("usage-modal", "<span>x</span>", { maxWidth: 560, closeId: "us-x", outside: true });
    var r = eq(m.style.cssText, wantOverlay, "overlay"); if (r !== true) return r;
    return eq(boxStyleOf(m), wantBox, "box");
  });
});
t("char-export-opts shape: custom maxWidth 380 at z-400 center", function () {
  // ui-browsers.js:541-543 @ HEAD, verbatim:
  var wantOverlay = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;";
  var wantBox = "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:380px;width:100%;";
  return withDoc(null, function () {
    var m = modalShell("char-export-opts", "", { z: 400, maxWidth: 380, outside: true });
    var r = eq(m.style.cssText, wantOverlay, "overlay"); if (r !== true) return r;
    return eq(boxStyleOf(m), wantBox, "box");
  });
});
t("cs-modal shape: touch-scroll overlay + margin:20px 0 40px box", function () {
  // ui-sheets.js:136-138 @ HEAD, verbatim:
  var wantOverlay = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;";
  var wantBox = "background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;margin:20px 0 40px;";
  return withDoc(null, function () {
    var m = modalShell("cs-modal", "", { align: "flex-start", overlayExtra: "overflow-y:auto;-webkit-overflow-scrolling:touch;", maxWidth: 560, boxExtra: "margin:20px 0 40px;", closeId: "cs-x", outside: true });
    var r = eq(m.style.cssText, wantOverlay, "overlay"); if (r !== true) return r;
    return eq(boxStyleOf(m), wantBox, "box");
  });
});
t("cap-card shape: bg .9 override + full boxCss override", function () {
  // ui-sheets.js:118-119 @ HEAD, verbatim:
  var wantOverlay = "position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;";
  var wantBox = "background:var(--modal-bg,#181818);border:1px solid var(--acc);border-radius:12px;max-width:420px;width:100%;position:relative;";
  return withDoc(null, function () {
    var m = modalShell("cap-card-modal", "", { z: 400, bg: ".9", boxCss: wantBox, closeId: "cap-card-x", outside: true });
    var r = eq(m.style.cssText, wantOverlay, "overlay"); if (r !== true) return r;
    return eq(boxStyleOf(m), wantBox, "box");
  });
});
t("arch-modal shape: legacy #181818 box + center-with-scroll overlay", function () {
  // game.js:419-421 @ HEAD, verbatim:
  var wantOverlay = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";
  var wantBox = "background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:480px;width:100%;";
  return withDoc(null, function () {
    var m = modalShell("arch-modal", "", { overlayExtra: "overflow-y:auto;", boxBg: "#181818", maxWidth: 480, wireClose: false });
    var r = eq(m.style.cssText, wantOverlay, "overlay"); if (r !== true) return r;
    return eq(boxStyleOf(m), wantBox, "box");
  });
});
t("innerHtml lands inside the box div", function () {
  return withDoc(null, function () {
    var m = modalShell("x-modal", "<p id='hello'>hi</p>", { maxWidth: 400 });
    return eq(m.innerHTML, "<div style='" + boxStyleOf(m) + "'><p id='hello'>hi</p></div>");
  });
});

// ── Remove-prior semantics ───────────────────────────────────────────────────
section("modalShell remove-prior");
t("an existing element with the same id is removed before the new modal is built", function () {
  var prior = stubEl(); prior.id = "quest-modal";
  return withDoc({ "quest-modal": prior }, function (els) {
    var m = modalShell("quest-modal", "", { maxWidth: 480 });
    if (!prior.removed) return "prior modal NOT removed";
    if (els["quest-modal"] !== m) return "new modal not registered under the id";
    return true;
  });
});
t("no prior element → no throw, modal appended to body", function () {
  return withDoc(null, function (els, body) {
    var m = modalShell("fresh-modal", "", {});
    return body._appended === m || "modal not appended to document.body";
  });
});

// ── Close wiring ─────────────────────────────────────────────────────────────
section("modalShell close wiring");
t("closeId wires the × to remove the modal", function () {
  var x = stubEl(); x.id = "qm-x";
  return withDoc({ "qm-x": x }, function () {
    var m = modalShell("quest-modal", "…", { closeId: "qm-x" });
    if (!x.listeners.click || x.listeners.click.length !== 1) return "× not wired";
    x.listeners.click[0]();
    return m.removed || "modal not removed on × click";
  });
});
t("outside:true closes only when the overlay ITSELF is the click target", function () {
  return withDoc(null, function () {
    var m = modalShell("rag-modal", "…", { outside: true });
    if (!m.listeners.click || m.listeners.click.length !== 1) return "outside closer not wired";
    m.listeners.click[0]({ target: {} });          // click inside the box → stays
    if (m.removed) return "removed on an INSIDE click";
    m.listeners.click[0]({ target: m });           // click the dim overlay → closes
    return m.removed || "not removed on overlay click";
  });
});
t("onClose replaces the default close for BOTH × and outside", function () {
  var x = stubEl(); x.id = "pm-x"; var calls = 0;
  return withDoc({ "pm-x": x }, function () {
    var m = modalShell("portrait-modal", "…", { closeId: "pm-x", outside: true, onClose: function () { calls++; } });
    x.listeners.click[0]();
    m.listeners.click[0]({ target: m });
    if (calls !== 2) return "onClose called " + calls + " times, want 2";
    return !m.removed || "default remove ran despite onClose";
  });
});
t("wireClose:false skips ALL close listeners (even with closeId + outside set)", function () {
  var x = stubEl(); x.id = "cip-x";
  return withDoc({ "cip-x": x }, function () {
    var m = modalShell("char-import-preview", "…", { wireClose: false, closeId: "cip-x", outside: true });
    if (x.listeners.click) return "× wired despite wireClose:false";
    if (m.listeners.click) return "outside closer wired despite wireClose:false";
    return true;
  });
});
t("missing closeId element is tolerated (no throw)", function () {
  return withDoc(null, function () {
    modalShell("m1", "", { closeId: "does-not-exist" });
    return true;
  });
});

// ── Report ───────────────────────────────────────────────────────────────────
console.log("");
if (fails.length) {
  console.log("FAIL — " + pass + " passed, " + fails.length + " failed:");
  fails.forEach(function (f) { console.log("  ✗ " + f); });
  process.exit(1);
} else {
  console.log("ALL GREEN — " + pass + " assertions (modalShell scaffold, #14)");
}
