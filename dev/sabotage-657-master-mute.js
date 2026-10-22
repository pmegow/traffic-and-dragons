// dev/sabotage-657-master-mute.js — proves the #657 guards (the master mute): the multiplier itself (gain, the
// save, the listeners), each source's multiply (the narration master node, the browser voice's volume, the earcon
// bus, the ambience snapshot and its re-sync), the phone button's toggle, and the load wiring (index.html, the
// designer, sw.js) must each turn the #657 section red.
//   node dev/sabotage-657-master-mute.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#657"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("audio-master.js", [
  { label: "the gain ignores the mute",
    find: "function gain() { return muted ? 0 : 1; }", replace: "function gain() { return 1; }",
    mustFail: "gain while muted" },
  { label: "the mute is never saved",
    find: 'try { s.setItem(KEY, muted ? "1" : "0"); }', replace: "try { 0; }",
    mustFail: "saved under" },
  { label: "a reload ignores the saved mute",
    find: 'try { return s.getItem(KEY) === "1"; }', replace: "try { return false; }",
    mustFail: "reload reads" },
  { label: "the listeners are never told",
    find: "listeners.slice().forEach(function(f) {", replace: "[].forEach(function(f) {",
    mustFail: "listener told" },
  { label: "an unsubscribed listener keeps firing",
    find: "if (i >= 0) listeners.splice(i, 1);", replace: "0;",
    mustFail: "unsubscribed" }
]);
prove("tts.js", [
  { label: "a decoded source goes straight to the destination",
    find: "src.connect(_masterNode(ctx));", replace: "src.connect(ctx.destination);",
    mustFail: "master node" },
  { label: "the master node is born at full gain whatever the mute",
    find: "_masterNodeGain.gain.value = AudioMaster.gain();", replace: "_masterNodeGain.gain.value = 1;",
    mustFail: "born at AudioMaster.gain" },
  { label: "a mute no longer reaches the live master node",
    find: "if (_masterNodeGain) { try { _masterNodeGain.gain.value = g; }", replace: "if (false) { try { _masterNodeGain.gain.value = g; }",
    mustFail: "live master node" },
  { label: "the browser voice speaks at full volume while muted",
    find: "u.volume = AudioMaster.gain();", replace: "u.volume = 1;",
    mustFail: "u.volume" }
]);
prove("sound.js", [
  { label: "the earcon bus ignores the mute",
    find: "var bus = ctx.createGain(); bus.gain.value = AudioMaster.gain();", replace: "var bus = ctx.createGain(); bus.gain.value = 1;",
    mustFail: "earcon bus" }
]);
prove("ui-ambient.js", [
  { label: "the ambience snapshot ignores the mute",
    find: "volume:volume*AudioMaster.gain(),", replace: "volume:volume,",
    mustFail: "snapshot volume" },
  { label: "a mute no longer re-syncs the ambience",
    find: "AudioMaster.onChange(function() { sync(); });", replace: "0;",
    mustFail: "re-sync" }
]);
prove("ui-mobile.js", [
  { label: "the phone button no longer toggles the mute",
    find: 'mute.addEventListener("click",function(){AudioMaster.toggle();});', replace: "0;",
    mustFail: "AudioMaster.toggle" },
  { label: "the button leaves the Connected locations row",
    find: "waysRow.appendChild(ways);waysRow.appendChild(mute);", replace: "waysRow.appendChild(ways);top.appendChild(mute);",
    mustFail: "inside #mobile-ways-row" }
]);
prove("index.html", [
  { label: "the game page loads the sources without the master",
    find: '<script src="audio-master.js"></script>\n', replace: "",
    mustFail: "index.html must load audio-master.js" }
]);
prove("blueprint-designer.html", [
  { label: "the designer auditions without the master",
    find: '<script src="audio-master.js"></script>\n', replace: "",
    mustFail: "blueprint-designer.html must load audio-master.js" }
]);
prove("sw.js", [
  { label: "the app shell forgets the master",
    find: '  "/audio-master.js",\n', replace: "",
    mustFail: "sw.js" }
]);
process.exit(code);
