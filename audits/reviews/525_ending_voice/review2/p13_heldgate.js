// Probe 13: the Village "held back" gate and the word "ending" that the heal prefix adds to every ending moment.
// usage: [ER=<tree>] node p13_heldgate.js   (read-only on the owner's save; in memory)
require("./h.js");
var fs = require("fs");
var SAVE = "C:/Projects/traffic-and-dragons/Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t254.tnd";
var save = JSON.parse(fs.readFileSync(SAVE, "utf8"));
function load(mig) { quiet(function () { worldState = inflateWorldStateSnapshot(JSON.parse(JSON.stringify(save.worldState))); memory = JSON.parse(JSON.stringify(save.memory)); sessionLog = []; if (mig && typeof migrateWorldState === "function") migrateWorldState(); }); }
var acts = ["I look around.", "Daeris, did you like the ending of that play last night?", "Morwen, what was the ending of the song you were humming?", "I tell Frizwick the ending of the joke.", "Ask Daeris about the weather.", "Ask Daeris about the grenade."];
[false, true].forEach(function (mig) {
  acts.forEach(function (a) {
    load(mig); lastAction = a;
    var b = quiet(function () { return buildCoreMemoryBlock(); }).r;
    var held = /^EARLIER ADVENTURES HELD BACK/.test(b), served = /an earlier adventure\)/.test(b);
    var eg = quiet(function () { return typeof ragEchoGate === "function" ? !!ragEchoGate() : null; }).r;
    console.log((mig ? "after load  " : "raw (no heal)") + " | action " + JSON.stringify(a) + " -> block " + (held ? "HELD" : served ? "SERVED (" + (b.match(/an earlier adventure\)/g) || []).length + " earlier moments)" : "other:" + b.slice(0, 60)) + " | retriever's echo gate says held: " + eg);
  });
});
