var L = require("C:/Projects/traffic-and-dragons/dev/load-engine.js");
L.loadEngine();
var clock = 1000, timers = [], plays = [];
var drv = {
  now: function () { return clock; }, later: function (fn, ms) { var t = { fn: fn, at: clock + ms }; timers.push(t); return t; },
  cancel: function (t) { var i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); }, abort: function () { return new AbortController(); },
  idle: function () { return true; }, bedPending: function () { return false; },
  load: function (set) { return Promise.resolve({ fake: set.id }); }, release: function () {}, rng: function () { return 0.5; },
  error: function (e) { console.log("ERR", e.message); }, warn: function (m) { console.log("WARN", m); },
  play: function (buf, set, steps, gain) { plays.push({ set: set.id, gain: gain }); return { done: false }; }, stop: function () {}, gain: function () {}
};
var ac = createAccentController(drv, AUDIO_CATALOG, AUDIO_SCENES);
var snap = { campaignId: "c1", generation: 1, campaignKind: "village", nodeKey: "Vill|the tavern", open: true, common: "the tavern",
  enabled: true, unlocked: true, visible: true, held: false, paused: false, capturing: false, hidden: false, speaking: false, volume: 0 /* muted */ };
ac.update(snap, "load");
function run(ms) { var end = clock + ms; while (true) { timers.sort(function (a, b) { return a.at - b.at; }); var t = timers[0]; if (!t || t.at > end) break; timers.shift(); clock = t.at; t.fn(); } clock = end; }
setTimeout(function () {
  run(5 * 60 * 1000);
  setTimeout(function () { run(5 * 60 * 1000); console.log("inspect", JSON.stringify(ac.inspect())); console.log("plays while volume=0:", plays.length, JSON.stringify(plays.slice(0, 3))); }, 10);
}, 10);
