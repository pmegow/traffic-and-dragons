// tests-525-ending-screen.js — #525: the ending the player SEES. campaignDenouement() is async (it awaits the model), so it is
// driven here through the real function against a stubbed provider (the tests-372 pattern — the engine suite cannot await).
//   • the model's reply ends with "RECORD: <third-person sentence>": the screen frame, its replay text and the transcript
//     hold the prose only; the hero's defining moment is the record sentence
//   • the call is made with the ending's system prompt, which asks for the second person and the RECORD line
//   node dev/tests-525-ending-screen.js
var engine = require("./load-engine.js");
engine.loadEngine("game.js");

var shown = [], calls = [];
addMsg = function (kind, html, opts) { shown.push({ kind: kind, html: String(html), opts: opts || {} }); return { remove: function () {} }; };
showToast = function () {}; syncUI = function () {}; saveAll = function () {}; saveCore = function () { return true; }; saveMem = function () { return true; };
showCampaignEndedModal = function () {};
var ow = console.warn, oi = console.info; console.warn = function () {}; console.info = function () {};

var REPLY = "You walk out of the palace and the rain feels like a joke at your expense.\n\nYou learned to stay.\nRECORD: Ammut learned to stay when leaving was easier.";
function seed() {
  worldState = engine.makeTestWorld(); memory = blankMemory(); sessionLog = []; shown = []; calls = [];
  var c = worldState.character; c.name = "Ammut"; c.coreMemories = []; worldState.turn = 89; worldState.transcript = [];
  worldState.ended = { turn: 89, cause: "the tale is told", at: 1, spine: true }; worldState.denouementOwed = true; busy = false;
  callGM = function (msg, sys) { calls.push({ msg: String(msg), sys: String(sys) }); return Promise.resolve(REPLY); };
}
var pass = 0, fails = [];
function check(name, r) { if (r === true) { pass++; console.log("PASS " + name); } else fails.push(name + " — " + r); }

(async function () {
  seed();
  await campaignDenouement();
  check("#525 the ending call carries the second-person and RECORD rules", calls.length === 1 && /second person/i.test(calls[0].sys) && /RECORD: /.test(calls[0].sys) ? true : "calls " + calls.length + ", sys " + String(calls[0] && calls[0].sys).slice(0, 160));
  var f = shown.filter(function (m) { return m.kind === "narrator"; })[0];
  check("#525 the screen shows the prose and never the RECORD line", f && f.html.indexOf("You learned to stay.") >= 0 && !/RECORD/.test(f.html) ? true : "frame: " + JSON.stringify(f && f.html).slice(0, 260));
  check("#525 the replay (voice) text never reads the RECORD line aloud", f && f.opts && typeof f.opts.replayText === "string" && !/RECORD/.test(f.opts.replayText) && f.opts.replayText.indexOf("You walk out") === 0 ? true : "replay: " + JSON.stringify(f && f.opts && f.opts.replayText).slice(0, 200));
  var tr = worldState.transcript[worldState.transcript.length - 1];
  check("#525 the transcript holds the prose only", tr && !/RECORD/.test(JSON.stringify(tr)) ? true : "transcript: " + JSON.stringify(tr).slice(0, 200));
  var e = (worldState.character.coreMemories || []).filter(function (m) { return m.kind === "ending"; });
  check("#525 the defining moment is the record sentence", e.length === 1 && e[0].text === "Ammut learned to stay when leaving was easier." ? true : JSON.stringify(e));
  check("#525 the owed flag is cleared and the call is not repeated", !worldState.denouementOwed && busy === false ? true : "owed " + worldState.denouementOwed + " busy " + busy);
  console.warn = ow; console.info = oi;
  if (fails.length) { console.error("#525 ending screen: " + fails.length + " FAILED\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("#525 ending screen: all green (" + pass + ")");
})().catch(function (e) { console.warn = ow; console.error("#525 ending screen threw: " + (e && e.stack || e)); process.exit(1); });
