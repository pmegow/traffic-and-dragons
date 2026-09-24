// tests-441-home-handoff.js — #441 (Astra review R4): a story picked on Home while a saved campaign exists is offered,
// never silently ignored. The pure read (homeHandoffPending), the chooser (homeHandoffChoose) against spies, and the
// boot wiring pin. Real ui-browsers.js in node with a localStorage fake.
//   node dev/tests-441-home-handoff.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine(); loader.makeTestWorld(); worldState.campName = "Existing review campaign";
var mem = {};
global.localStorage = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
global.window = global;
global.document = { getElementById: function () { return null; }, createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {}, addEventListener: function () {} }; }, body: { appendChild: function () {} } };
var geval = eval; geval(fs.readFileSync(path.join(ROOT, "ui-browsers.js"), "utf8"));
var calls = [], toasts = [];
showToast = function (m) { toasts.push(String(m)); };
campNew = function () { calls.push("campNew"); };
consumeHomeBlueprint = function () { calls.push("consumeBp"); return true; };
consumeHomeQuickStart = function () { calls.push("consumeQs"); return true; };
busy = false;
var BP = { format: "tnd-blueprint-v1", name: "The Iron Meridian" };
function fresh() { mem = {}; calls.length = 0; toasts.length = 0; busy = false; }
var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS " + name); } else { failed++; console.error("FAIL " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL " + name + " — threw: " + e.message); } }

test("nothing pending → null", function () { fresh(); return homeHandoffPending() === null ? true : "pending"; });
test("a fresh blueprint handoff is pending with its name; a quick start outranks it", function () {
  fresh(); mem[HOME_PENDING_BP_K] = JSON.stringify({ bp: BP, at: Date.now() });
  var p = homeHandoffPending(); if (!p || p.kind !== "bp" || p.name !== "The Iron Meridian") return JSON.stringify(p);
  mem[HOME_PENDING_QS_K] = JSON.stringify({ char: { name: "Maud" }, bp: BP, at: Date.now() });
  p = homeHandoffPending(); return p && p.kind === "qs" ? true : JSON.stringify(p);
});
test("a stale (>1h) or malformed payload is not offered", function () {
  fresh(); mem[HOME_PENDING_BP_K] = JSON.stringify({ bp: BP, at: Date.now() - 2 * 3600 * 1000 });
  if (homeHandoffPending() !== null) return "stale offered";
  mem[HOME_PENDING_BP_K] = "not json{{"; if (homeHandoffPending() !== null) return "malformed offered";
  mem[HOME_PENDING_BP_K] = JSON.stringify({ at: Date.now() }); return homeHandoffPending() === null ? true : "payload without a blueprint offered";
});
test("Continue clears both keys, says the story is still on the shelf, and starts nothing", function () {
  fresh(); mem[HOME_PENDING_BP_K] = JSON.stringify({ bp: BP, at: Date.now() });
  var r = homeHandoffChoose("continue");
  if (r !== "continued") return r;
  if (mem[HOME_PENDING_BP_K] !== undefined) return "the payload survived Continue — it would replay on the next boot";
  if (calls.length) return "Continue started something: " + calls.join(",");
  return toasts.some(function (x) { return /still on the Home shelf/.test(x) && /Existing review campaign/.test(x); }) ? true : JSON.stringify(toasts);
});
test("Start with a blueprint: the picker's New reset runs FIRST (the current campaign is snapshotted), then the wizard consumes the blueprint", function () {
  fresh(); mem[HOME_PENDING_BP_K] = JSON.stringify({ bp: BP, at: Date.now() });
  var r = homeHandoffChoose("start"); return r === "started" && calls.join(",") === "campNew,consumeBp" ? true : r + " " + calls.join(",");
});
test("Start with a quick start: the quick start's own reset + start, no wizard reset in front of it", function () {
  fresh(); mem[HOME_PENDING_QS_K] = JSON.stringify({ char: { name: "Maud" }, bp: BP, at: Date.now() });
  var r = homeHandoffChoose("start"); return r === "started" && calls.join(",") === "consumeQs" ? true : r + " " + calls.join(",");
});
test("Start during a turn is refused loudly and the payload survives for the next boot", function () {
  fresh(); busy = true; mem[HOME_PENDING_BP_K] = JSON.stringify({ bp: BP, at: Date.now() });
  var r = homeHandoffChoose("start"); if (r !== "busy" || calls.length) return r + " " + calls.join(",");
  return mem[HOME_PENDING_BP_K] && toasts.some(function (x) { return /Finish the current turn/.test(x); }) ? true : "payload lost or no toast";
});
test("boot wiring: the saved-world branch of initState offers the handoff; the no-saved branch still consumes it directly", function () {
  var boot = fs.readFileSync(path.join(ROOT, "ui-boot.js"), "utf8"), init = boot.slice(boot.indexOf("function initState("), boot.indexOf("function init(){"));
  var saved = init.slice(0, init.indexOf("}else{")), rest = init.slice(init.indexOf("}else{"));
  if (saved.indexOf("offerHomeHandoff()") < 0) return "the saved-world branch does not offer the handoff — the choice stays stranded";
  if (rest.indexOf("consumeHomeQuickStart()") < 0 || rest.indexOf("consumeHomeBlueprint()") < 0) return "the no-saved branch lost its direct consumption";
  return true;
});
console.log("#441 HOME HANDOFF: " + failed + " failed, " + passed + " passed");
process.exit(failed ? 1 : 0);
