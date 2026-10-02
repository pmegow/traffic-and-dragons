// Probe 13b: the same Village save, the load path, one ordinary action holding the word "ending" — the moments block and the whole prompt, per tree.
// usage: [ER=<tree>] node p13b_heldgate.js
require("./h.js");
var fs = require("fs");
var SAVE = "C:/Projects/traffic-and-dragons/Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t254.tnd";
var save = JSON.parse(fs.readFileSync(SAVE, "utf8"));
function load() { quiet(function () { worldState = inflateWorldStateSnapshot(JSON.parse(JSON.stringify(save.worldState))); memory = JSON.parse(JSON.stringify(save.memory)); sessionLog = []; migrateWorldState(); }); }
["Daeris, did you like the ending of that play last night?", "I ask Daeris how her day was."].forEach(function (a) {
  load(); lastAction = a;
  var b = quiet(function () { return buildCoreMemoryBlock(); }).r;
  var names = [worldState.character.name].concat(livingPartyCompanions().map(function (n) { return n.name; }));
  var hp = heldPastParty();
  var rw = {}; (hp ? hp.prior : []).forEach(function (m) { var ex = {}; names.concat([m.who || ""]).forEach(function (n) { String(n).toLowerCase().split(/[^a-z]+/).forEach(function (p) { if (p) ex[p] = 1; }); }); var w = pastWords(m.text, ex), k; for (k in w) rw[k] = 1; });
  load(); lastAction = a;
  var sys = quiet(function () { return buildSysPrompt(); }).r;
  console.log("action " + JSON.stringify(a) + "\n   moments block: " + b.length + " chars, starts " + JSON.stringify(b.slice(0, 70)) + "\n   'ending' is a record word: " + !!rw.ending + " | prior moments held by the party: " + (hp ? hp.prior.length : 0) + "\n   whole prompt: stable " + sys.stable.length + " + volatile " + sys.volatile.length + " chars; prompt holds 'an earlier adventure)' lines: " + ((sys.stable + sys.volatile).match(/an earlier adventure\)/g) || []).length);
});
