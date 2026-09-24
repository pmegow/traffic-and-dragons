// tests-439-designer-incoming.js — #439 (Astra review R2): "Open in designer" must never discard the designer's
// unsaved draft. The pure decision (bpdIncomingDecision, sliced out of blueprint-designer.html the way the
// DESIGNER CONTRACT slices bpFieldSet) plus source pins on both pages.
//   node dev/tests-439-designer-incoming.js
var fs = require("fs"), path = require("path"), vm = require("vm");
var ROOT = path.join(__dirname, "..");
var page = fs.readFileSync(path.join(ROOT, "blueprint-designer.html"), "utf8");
var home = fs.readFileSync(path.join(ROOT, "home.html"), "utf8");
var globalsSrc = fs.readFileSync(path.join(ROOT, "globals.js"), "utf8");
var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS " + name); } else { failed++; console.error("FAIL " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL " + name + " — threw: " + e.message); } }
var ctx = {};
var fnStart = page.indexOf("function bpdIncomingDecision("), fnEnd = page.indexOf("var _incoming=null");
if (fnStart < 0 || fnEnd < 0) { console.error("FAIL could not slice bpdIncomingDecision out of the designer"); process.exit(1); }
vm.runInNewContext(page.slice(fnStart, fnEnd), ctx);
var decide = ctx.bpdIncomingDecision;
var BP = { format: "tnd-blueprint-v1", name: "The Iron Meridian" };
var DIRTY = { bp: { format: "tnd-blueprint-v1", name: "UNSAVED ORIGINAL REVIEW FIXTURE" }, dirty: true, at: 1 };
var CLEAN = { bp: { format: "tnd-blueprint-v1", name: "Saved one" }, dirty: false, at: 1 };

test("no draft → the incoming blueprint is adopted without asking", function () { var asked = 0; var d = decide(null, { bp: BP, at: 2 }, function () { asked++; return false; }); return d.action === "adopt" && asked === 0 ? true : JSON.stringify(d) + " asked " + asked; });
test("a CLEAN draft → adopted without asking (nothing unsaved to lose)", function () { var asked = 0; var d = decide(CLEAN, { bp: BP, at: 2 }, function () { asked++; return false; }); return d.action === "adopt" && asked === 0 ? true : JSON.stringify(d); });
test("a DIRTY draft → the author is asked, naming both blueprints; Cancel keeps the draft", function () {
  var q = null; var d = decide(DIRTY, { bp: BP, at: 2 }, function (question) { q = question; return false; });
  if (d.action !== "keep") return "expected keep, got " + JSON.stringify(d);
  if (!q || q.indexOf("UNSAVED ORIGINAL REVIEW FIXTURE") < 0 || q.indexOf("The Iron Meridian") < 0) return "the question must name both: " + q;
  if (!/lost/i.test(q)) return "the question must say the draft would be lost";
  return true;
});
test("a DIRTY draft → OK replaces it", function () { var d = decide(DIRTY, { bp: BP, at: 2 }, function () { return true; }); return d.action === "replace" ? true : JSON.stringify(d); });
test("a malformed incoming record is ignored, never asked about", function () { var asked = 0; var a = decide(DIRTY, null, function () { asked++; return true; }), b = decide(DIRTY, { bp: { name: "no format" } }, function () { asked++; return true; }); return a.action === "ignore" && b.action === "ignore" && asked === 0 ? true : JSON.stringify([a, b, asked]); });
test("Home writes the incoming slot (BPD_INCOMING_K from globals.js) and never the designer's draft slot", function () {
  if (home.indexOf("localStorage.setItem(BPD_INCOMING_K") < 0) return "home.html does not write BPD_INCOMING_K";
  if (home.indexOf('"bpd_draft_v1"') >= 0) return "home.html still writes the designer's autosave slot directly";
  if (!/var BPD_INCOMING_K\s*=\s*"bpd_incoming_v1"/.test(globalsSrc)) return "BPD_INCOMING_K missing from globals.js";
  return true;
});
test("the designer consumes the incoming slot once, BEFORE the draft restore, and clears the old draft only on adopt/replace", function () {
  var boot = page.slice(page.indexOf("var _incoming=null"), page.indexOf("}else{", page.indexOf("var _incoming=null")));
  if (boot.indexOf("localStorage.removeItem(BPD_INCOMING_K)") < 0) return "the incoming slot is not cleared";
  if (boot.indexOf('_dec.action==="adopt"||_dec.action==="replace"') < 0 || boot.indexOf("clearDraft();") < 0) return "adopt/replace must clear the prior draft slot";
  var keepAt = boot.indexOf('_dec.action==="keep"'), clearAt = boot.indexOf("clearDraft();");
  if (keepAt < 0 || clearAt > keepAt) return "keep must not clear the draft";
  if (page.indexOf("var _incoming=null") > page.indexOf("if(_draft&&_draft.bp&&_draft.bp.format){")) return "the incoming decision must run before the draft restore";
  if (page.indexOf("if(_draft&&_draft.bp&&_draft.bp.format){") < page.indexOf("bpdIncomingDecision(_draft,_incoming")) return "the decision must see the stored draft";
  return true;
});
console.log("#439 DESIGNER INCOMING: " + failed + " failed, " + passed + " passed");
process.exit(failed ? 1 : 0);
