// tests-443-campaign-delete.js — #443 (Astra review R6): campaign deletion owns its cloud acknowledgement. The real
// campDelete (ui-campaigns.js) against stubs: unconnected → local delete at once; connected → the remote delete is
// awaited and the local copy goes only after the server agreed; a failure keeps the local copy, reports the reason
// and reopens the picker (deleting again is the retry); a 404 (never on the server) still deletes locally.
//   node dev/tests-443-campaign-delete.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();
global.window = global;
global.document = { getElementById: function () { return null; }, createElement: function () { return { style: {}, appendChild: function () {}, addEventListener: function () {}, setAttribute: function () {} }; }, body: { appendChild: function () {} }, querySelector: function () { return null; } };
var geval = eval; geval(fs.readFileSync(path.join(ROOT, "ui-campaigns.js"), "utf8"));
var calls = [], toasts = [], warns = [], lastCb = null, mode = false;
confirm = function () { return true; };
closeAllMenus = function () {};
campDisplayName = function () { return "Alpha"; };
deleteCampaign = function (id) { calls.push("local:" + id); };
showCampaignPicker = function () { calls.push("picker"); };
showToast = function (m) { toasts.push(String(m)); };
console.warn = function (m) { warns.push(String(m)); };
storageAdapter = { isServerMode: function () { return mode; }, deleteCampaignFromServer: function (id, cb) { calls.push("remote:" + id); lastCb = cb; } };
function fresh(server) { calls.length = 0; toasts.length = 0; warns.length = 0; lastCb = null; mode = !!server; }
var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS " + name); } else { failed++; console.error("FAIL " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL " + name + " — threw: " + e.message); } }

test("unconnected: the local delete is the whole operation, then the picker", function () { fresh(false); campDelete("c1"); return calls.join(",") === "local:c1,picker" ? true : calls.join(","); });
test("connected: the remote delete goes first with a callback; nothing local until the server answers", function () {
  fresh(true); campDelete("c1");
  if (calls.join(",") !== "remote:c1") return "order before the answer: " + calls.join(",");
  if (typeof lastCb !== "function") return "no callback was passed — the result could never be awaited";
  if (!toasts.some(function (x) { return /Deleting Alpha/.test(x); })) return "no in-progress toast";
  lastCb(null, { ok: true });
  return calls.join(",") === "remote:c1,local:c1,picker" && toasts.some(function (x) { return /^Deleted Alpha$/.test(x); }) ? true : calls.join(",") + " " + JSON.stringify(toasts);
});
test("connected, the server fails: the local copy is KEPT, the reason reaches the player, the picker reopens, and deleting again retries", function () {
  fresh(true); campDelete("c1"); lastCb("HTTP 502");
  if (calls.indexOf("local:c1") >= 0) return "the local copy was deleted after a failed cloud delete";
  if (calls.join(",") !== "remote:c1,picker") return "order: " + calls.join(",");
  if (!toasts.some(function (x) { return /Cloud delete failed/.test(x) && /HTTP 502/.test(x) && /still here/.test(x); })) return "the failure toast must carry the reason and say the campaign is still here: " + JSON.stringify(toasts);
  if (!warns.some(function (w) { return /#443/.test(w); })) return "no console warn";
  calls.length = 0; campDelete("c1"); return calls.join(",") === "remote:c1" ? true : "retry did not go remote again: " + calls.join(",");
});
test("connected, the server never had it (404): the local delete proceeds and the toast says it was only on this device", function () {
  fresh(true); campDelete("c1"); lastCb("HTTP 404 — not found");
  return calls.join(",") === "remote:c1,local:c1,picker" && toasts.some(function (x) { return /only on this device/.test(x); }) ? true : calls.join(",") + " " + JSON.stringify(toasts);
});
test("the outcome classifier: null → deleted, 404/not found → absent, anything else → failed", function () {
  return campDeleteRemoteOutcome(null) === "deleted" && campDeleteRemoteOutcome("HTTP 404") === "absent" && campDeleteRemoteOutcome("Not found") === "absent" && campDeleteRemoteOutcome("HTTP 500") === "failed" && campDeleteRemoteOutcome("Not connected") === "failed" ? true : "classifier";
});
console.log("#443 CAMPAIGN DELETE: " + failed + " failed, " + passed + " passed");
process.exit(failed ? 1 : 0);
