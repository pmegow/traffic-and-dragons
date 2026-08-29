// tests-280b-actions-sync.js — #280b (field 2026-08-29, owner report): the suggestion-button
// cross-device regression. R4 made generateActions' save local-only, but generateActions ALSO
// nulls worldState.lastActions at its start (the E26 reload guard) — and the turn's single
// debounced POST fires at +1.5s, INSIDE the suggestion call's async window. So the server blob
// for the latest turn carried lastActions:null, the page-hide flush that was supposed to carry
// the late buttons is size-SKIPPED on any mature save (the JP0-11 56KB keepalive cap), and the
// second device rendered the newest narration with NO buttons until its own next turn.
//
// The fix under test: the turn's ONE cloud sync moves from commit-time to suggestion-COMPLETION
// — commitGmTurn persists locally (saveLocal; UA6 intact), and every generateActions exit
// (success, empty, failure, stale-race) runs the saveAll that arms the POST. Same single upload
// per turn, now always carrying the truth: fresh buttons, or the honest null when the call
// failed everywhere.
//
// Why a standalone battery: generateActions is async and the shared engine harness's t() is
// synchronous. Own document/callGM/storageAdapter stubs. Run directly:
//   node dev/tests-280b-actions-sync.js
// ES5 throughout, matching the engine.

var le = require("./load-engine.js");
le.loadEngine();

// ── Reporter (mirrors tests-jp011-flush-dirty.js) ────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
var chain = Promise.resolve();
function tAsync(name, fn) {
  var label = curSection + " › " + name;
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) pass++; else fails.push(label + " — " + r); },
      function (e) { fails.push(label + " — threw: " + e.message); }
    );
  });
}

// ── Stubs ────────────────────────────────────────────────────────────────────
function el() {
  return { className: "", textContent: "", innerHTML: "", disabled: false, style: {}, parentNode: null,
    children: [],
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild: function (c) { c.parentNode = null; },
    setAttribute: function () {}, removeAttribute: function () {} };
}
document = { createElement: function () { return el(); } };
addMsg = function () { return el(); };
showToast = function () {};
syncUI = function () {};
TTS = { speakResponse: function () {}, isOn: function () { return false; } };
reportError = function () {};
var syncCount = 0;
storageAdapter = { syncToServer: function () { syncCount++; }, syncNow: function () {} };

function freshWorld() {
  le.makeTestWorld();
  worldState.turn = 40;
  sessionLog = [{ role: "user", content: "look" }, { role: "assistant", content: "You look around." }];
  syncCount = 0;
}

section("#280b — the turn's ONE POST rides suggestion completion");
tAsync("success: completion arms the sync with the fresh buttons already aboard", function () {
  freshWorld();
  callGM = function () { return Promise.resolve('["Look around the room","Ask Bram about the toll","Rest by the fire"]'); };
  return generateActions(el()).then(function () {
    if (!worldState.lastActions || worldState.lastActions.length !== 3) return "fresh actions not stored: " + JSON.stringify(worldState.lastActions);
    if (syncCount !== 1) return "completion armed " + syncCount + " cloud syncs (want exactly 1 — the turn's ONE POST, carrying the buttons)";
    return true;
  });
});
tAsync("failure: the honest null still syncs — the E26 clear reaches the server instead of stranding it locally", function () {
  freshWorld();
  worldState.lastActions = ["stale a", "stale b", "stale c"];
  callGM = function () { return Promise.reject(new Error("provider down")); };
  return generateActions(el()).then(function () {
    if (worldState.lastActions !== null) return "the E26 clear was lost: " + JSON.stringify(worldState.lastActions);
    if (syncCount !== 1) return "the failure path armed " + syncCount + " syncs (want 1 — the server must converge to the honest null)";
    return true;
  });
});
tAsync("unparseable result: the empty exit syncs too", function () {
  freshWorld();
  callGM = function () { return Promise.resolve("no array here at all"); };
  return generateActions(el()).then(function () {
    if (syncCount !== 1) return "the empty-result exit armed " + syncCount + " syncs (want 1)";
    return true;
  });
});
tAsync("stale race: a superseding turn's window still ends in exactly one sync", function () {
  freshWorld();
  callGM = function () { worldState.turn = 41; return Promise.resolve('["a","b","c"]'); };
  return generateActions(el()).then(function () {
    if (syncCount !== 1) return "the stale-race exit armed " + syncCount + " syncs (want 1 — coalesced by the debounce, never zero)";
    return true;
  });
});

chain.then(function () {
  if (fails.length) {
    console.error("#280b ACTIONS-SYNC FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#280b actions sync)");
});
