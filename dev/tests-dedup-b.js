// _tests_dedupB.js — TODO #54 dedup pass, lane B (AUDIT_FABLE_07_16_2026 #15 ①②④⑤ + UA21 ③⑤):
// tests for the shared helpers extracted in this lane —
//   • partyMemberVitals (ui-panels.js)  — fixtures mirroring EACH renderer's current math,
//     incl. the deliberately-preserved HUD-vs-Car color-threshold divergence (rounded pct
//     >50 vs raw ratio >0.5) pinned at a boundary input.
//   • campSlotKey (state.js)            — exact key strings.
//   • radioRowsHTML (ui-modals.js)      — byte-parity against the ORIGINAL inline builders
//     (copied verbatim from pre-dedup showRenderOptionsModal / showProseModal).
//   • eachMenuEl (ui-shell.js)          — id construction, visit order, missing-el tolerance
//     (stubbed document; the real DOM walks are coordinator-smoked in the browser).
//
// UNWIRED fragment — not loaded by run-tests.js or test.html. Run standalone:
//   node dev/_tests_dedupB.js
//
// Engine-tests style (section/t/eq reporter, same shape as dev/run-tests.js). ES5 throughout.

var le = require("./load-engine.js");
le.loadEngine(); // full 13 — state.js (campSlotKey) + helpers.js (escHtml) ride along
var fs = require("fs"), path = require("path");
var geval = eval;
// The lane-B ui files are function-declaration-only at top level (no DOM touched at load),
// so they geval safely headless. ui-boot.js is EXCLUDED (its window load listener runs at load).
["ui-shell.js", "ui-panels.js", "ui-modals.js"].forEach(function (f) {
  try { geval(fs.readFileSync(path.join(le.ROOT, f), "utf8")); }
  catch (e) { console.error("UI LOAD FAILED in " + f + ": " + e.message); process.exit(1); }
});

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

// ── campSlotKey (#15②) ───────────────────────────────────────────────────────
section("campSlotKey");
t("ws key exact", function () { return eq(campSlotKey("camp_1752600000000_1234", "ws"), "tnd_camp_camp_1752600000000_1234_ws"); });
t("sl key exact", function () { return eq(campSlotKey("camp_1752600000000_1234", "sl"), "tnd_camp_camp_1752600000000_1234_sl"); });
t("mem key exact", function () { return eq(campSlotKey("camp_1752600000000_1234", "mem"), "tnd_camp_camp_1752600000000_1234_mem"); });
t("matches the legacy hand-built expression for any id/part", function () {
  var ids = ["a", "camp_9_0001"], parts = ["ws", "sl", "mem"], i, j;
  for (i = 0; i < ids.length; i++) for (j = 0; j < parts.length; j++) {
    var want = "tnd_camp_" + ids[i] + "_" + parts[j]; // the pre-dedup inline concat, verbatim
    if (campSlotKey(ids[i], parts[j]) !== want) return "mismatch at " + ids[i] + "/" + parts[j];
  }
  return true;
});

// ── partyMemberVitals (UA21③) ────────────────────────────────────────────────
// Each fixture mirrors what the three renderers computed inline pre-dedup:
//   HUD:   pct = max(0,min(100,round((hp||0)/maxHp*100)))   [only when sheet && maxHp]
//   Car:   ratio = maxHp ? hp/maxHp : 1                      [only for charSheet holders]
//   Panel: hp/maxHp raw-or-null, cls = sheet.cls||"" else npc.role||""
section("partyMemberVitals");
t("full-health member", function () {
  var v = partyMemberVitals({ name: "Morwen", charSheet: { hp: 20, maxHp: 20, cls: "Cleric" } });
  return eq(v.name, "Morwen", "name") === true && eq(v.hp, 20, "hp") === true && eq(v.maxHp, 20, "maxHp") === true
    && eq(v.pct, 100, "pct") === true && eq(v.ratio, 1, "ratio") === true && eq(v.cls, "Cleric", "cls") === true || "field mismatch";
});
t("hurt member (9/20): pct 45, ratio 0.45", function () {
  var v = partyMemberVitals({ name: "F", charSheet: { hp: 9, maxHp: 20 } });
  return eq(v.pct, 45, "pct") === true && eq(v.ratio, 0.45, "ratio") === true || "mismatch pct=" + v.pct + " ratio=" + v.ratio;
});
t("critical member (2/20): pct 10, ratio 0.1", function () {
  var v = partyMemberVitals({ name: "F", charSheet: { hp: 2, maxHp: 20 } });
  return eq(v.pct, 10, "pct") === true && eq(v.ratio, 0.1, "ratio") === true || "mismatch";
});
t("dead member (0/20): pct 0, ratio 0, hp stays 0 not null", function () {
  var v = partyMemberVitals({ name: "F", charSheet: { hp: 0, maxHp: 20 } });
  return eq(v.pct, 0, "pct") === true && eq(v.ratio, 0, "ratio") === true && eq(v.hp, 0, "hp") === true || "mismatch";
});
t("negative hp clamps pct to 0 (HUD's max(0,…)), ratio stays raw negative (Car's)", function () {
  var v = partyMemberVitals({ name: "F", charSheet: { hp: -5, maxHp: 20 } });
  return eq(v.pct, 0, "pct") === true && eq(v.ratio, -0.25, "ratio") === true || "mismatch pct=" + v.pct + " ratio=" + v.ratio;
});
t("sheet-less member: all vitals null, cls falls back to npc.role", function () {
  var v = partyMemberVitals({ name: "Guide", role: "wilderness guide", status: "ally" });
  return v.sheet === null && v.hp === null && v.maxHp === null && v.pct === null && v.ratio === null
    && eq(v.cls, "wilderness guide", "cls") === true || "mismatch " + JSON.stringify(v);
});
t("sheet WITHOUT maxHp: pct null (HUD guard), ratio 1 (Car default), cls does NOT fall back to role", function () {
  var v = partyMemberVitals({ name: "F", role: "scout", charSheet: { hp: 7 } });
  return v.pct === null && eq(v.ratio, 1, "ratio") === true && eq(v.cls, "", "cls") === true || "mismatch " + JSON.stringify(v);
});
t("sheet with undefined hp: pct uses hp||0 (HUD), hp field stays undefined-raw", function () {
  var v = partyMemberVitals({ name: "F", charSheet: { maxHp: 20, cls: "Rogue" } });
  return eq(v.pct, 0, "pct") === true && v.hp === undefined || "mismatch pct=" + v.pct + " hp=" + JSON.stringify(v.hp);
});
t("PRESERVED DIVERGENCE pinned: 1001/2000 → HUD pct 50 (amber, not green) but Car ratio 0.5005 (green)", function () {
  var v = partyMemberVitals({ name: "F", charSheet: { hp: 1001, maxHp: 2000 } });
  // the two renderers' own ternaries, verbatim:
  var hudClr = v.pct > 50 ? "var(--grn)" : v.pct > 25 ? "var(--acc)" : "var(--red)";
  var carCol = v.ratio > 0.5 ? "var(--grn)" : v.ratio > 0.25 ? "var(--warn)" : "var(--dng)";
  return eq(v.pct, 50, "pct") === true && eq(hudClr, "var(--acc)", "hudClr") === true
    && eq(carCol, "var(--grn)", "carCol") === true || "divergence NOT preserved: pct=" + v.pct + " hud=" + hudClr + " car=" + carCol;
});
t("pure — does not mutate the npc or its sheet", function () {
  var sheet = { hp: 9, maxHp: 20, cls: "Bard" }, npc = { name: "F", charSheet: sheet };
  var before = JSON.stringify(npc);
  partyMemberVitals(npc);
  return eq(JSON.stringify(npc), before);
});

// ── radioRowsHTML byte-parity (#15①) ─────────────────────────────────────────
// The two label shapes, against the ORIGINAL inline builders copied verbatim from the
// pre-dedup code (showRenderOptionsModal's mhtml loop / showProseModal's rows()).
section("radioRowsHTML parity");
function legacySpanRow(cls, id, label, sel) { // = pre-dedup Render/Provider row, verbatim
  return "<div class='" + cls + "' data-id='" + id + "' style='display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid " + (sel ? "var(--acc)" : "var(--brd)") + ";background:" + (sel ? "rgba(184,147,90,.08)" : "var(--bg2)") + ";margin-bottom:6px;'>"
    + "<div style='width:13px;height:13px;border-radius:50%;border:2px solid " + (sel ? "var(--acc)" : "var(--brd2)") + ";background:" + (sel ? "var(--acc)" : "transparent") + ";flex-shrink:0;'></div>"
    + "<span style='font-size:13px;color:" + (sel ? "var(--acc)" : "var(--t1)") + "'>" + label + "</span>"
    + "</div>";
}
function legacyProseRow(a, s, selId) { // = pre-dedup showProseModal rows() body, verbatim
  return "<div class='pr-row' data-id='" + a.id + "' style='display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid " + (s ? "var(--acc)" : "var(--brd)") + ";background:" + (s ? "rgba(184,147,90,.08)" : "var(--bg2)") + ";margin-bottom:6px;'>"
    + "<div style='width:13px;height:13px;border-radius:50%;border:2px solid " + (s ? "var(--acc)" : "var(--brd2)") + ";background:" + (s ? "var(--acc)" : "transparent") + ";flex-shrink:0;margin-top:2px;'></div>"
    + "<div><div style='font-size:13px;color:" + (s ? "var(--acc)" : "var(--t1)") + ";'>" + escHtml(a.nm) + (a.profane ? " <span style=\"font-size:10px;color:var(--t2);\">· 18+ for full voice</span>" : "") + "</div>"
    + (a.blurb ? "<div style='font-size:11px;color:var(--t2);margin-top:2px;'>" + escHtml(a.blurb) + "</div>" : "") + "</div></div>";
}
var spanLabelFn = function (it, sel) { return "<span style='font-size:13px;color:" + (sel ? "var(--acc)" : "var(--t1)") + "'>" + it.label + "</span>"; };
t("span shape (Render/Provider): selected + unselected rows byte-identical", function () {
  var items = [{ id: "fal-ai/flux/dev", label: "Flux Dev" }, { id: "fal-ai/nano-banana-2", label: "Nano Banana 2" }];
  var got = radioRowsHTML("ro-row", items, "fal-ai/flux/dev", spanLabelFn);
  var want = legacySpanRow("ro-row", items[0].id, items[0].label, true) + legacySpanRow("ro-row", items[1].id, items[1].label, false);
  return eq(got, want);
});
t("span shape with pv-row class (Provider) byte-identical", function () {
  var items = [{ id: "anthropic", label: "Anthropic (Claude)" }, { id: "openai", label: "OpenAI" }];
  var got = radioRowsHTML("pv-row", items, "openai", spanLabelFn);
  var want = legacySpanRow("pv-row", "anthropic", "Anthropic (Claude)", false) + legacySpanRow("pv-row", "openai", "OpenAI", true);
  return eq(got, want);
});
t("prose shape (flex-start + dotTop + nested label, profane + blurb variants) byte-identical", function () {
  var authors = [
    { id: "", nm: "House default", blurb: "" },
    { id: "abercrombie", nm: "Joe Abercrombie", blurb: "Grim wit & <edge>", profane: true }
  ];
  var got = radioRowsHTML("pr-row", authors, "abercrombie", function (a, s) {
    return "<div><div style='font-size:13px;color:" + (s ? "var(--acc)" : "var(--t1)") + ";'>" + escHtml(a.nm) + (a.profane ? " <span style=\"font-size:10px;color:var(--t2);\">· 18+ for full voice</span>" : "") + "</div>"
      + (a.blurb ? "<div style='font-size:11px;color:var(--t2);margin-top:2px;'>" + escHtml(a.blurb) + "</div>" : "") + "</div>";
  }, { align: "flex-start", dotTop: true });
  var want = legacyProseRow(authors[0], false) + legacyProseRow(authors[1], true);
  return eq(got, want);
});

// ── eachMenuEl (#15⑤) — stubbed-document walk semantics ──────────────────────
section("eachMenuEl");
function withDocStub(existingIds, fn) {
  var lookedUp = [], visited = [];
  global.document = { getElementById: function (id) { lookedUp.push(id); return existingIds.indexOf(id) >= 0 ? { id: id } : null; } };
  try { fn(lookedUp, visited); } finally { delete global.document; }
  return { lookedUp: lookedUp, visited: visited };
}
t("default prefixes build fm-/cs-fm-/api-fm- ids in order", function () {
  var r = withDocStub(["fm-adult-cb", "cs-fm-adult-cb", "api-fm-adult-cb"], function (lu, vis) {
    eachMenuEl("adult-cb", function (el) { vis.push(el.id); });
    if (lu.join("|") !== "fm-adult-cb|cs-fm-adult-cb|api-fm-adult-cb") throw new Error("lookup order: " + lu.join("|"));
    if (vis.join("|") !== "fm-adult-cb|cs-fm-adult-cb|api-fm-adult-cb") throw new Error("visit order: " + vis.join("|"));
  });
  return true;
});
t("missing elements are skipped silently (fn not called)", function () {
  var r = withDocStub(["cs-fm-font-lg"], function (lu, vis) {
    eachMenuEl("font-lg", function (el) { vis.push(el.id); });
    if (vis.join("|") !== "cs-fm-font-lg") throw new Error("visited: " + vis.join("|"));
  });
  return true;
});
t("MENU_ID_PREFIXES variant builds the three menu-container ids (closeAllMenus' space)", function () {
  var r = withDocStub(["file-menu", "cs-file-menu", "api-file-menu"], function (lu, vis) {
    eachMenuEl("file-menu", function (el) { vis.push(el.id); }, MENU_ID_PREFIXES);
    if (vis.join("|") !== "file-menu|cs-file-menu|api-file-menu") throw new Error("visited: " + vis.join("|"));
  });
  return true;
});

// ── Report ───────────────────────────────────────────────────────────────────
console.log("");
if (fails.length) {
  console.log("FAIL — " + pass + " passed, " + fails.length + " failed:");
  fails.forEach(function (f) { console.log("  ✗ " + f); });
  process.exit(1);
} else {
  console.log("ALL GREEN — " + pass + " assertions (dedup lane B: partyMemberVitals / campSlotKey / radioRowsHTML / eachMenuEl)");
}
