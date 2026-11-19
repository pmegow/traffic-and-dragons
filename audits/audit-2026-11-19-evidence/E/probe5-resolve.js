// Probe 5: resolveNpcName fusion cases.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
addMsg = function () { return {}; }; showToast = function () {};
var _i = console.info; console.info = function () {}; console.warn = function () {};
function rec() { return { attitude: "", knowledge: [], events: [], aliases: [] }; }
function caseRun(onFile, name) { L.makeTestWorld({ turn: 10 }); onFile.forEach(function (k) { memory.npcs[k] = rec(); }); _i.call(console, JSON.stringify(onFile), " +", JSON.stringify(name), " => ", JSON.stringify(resolveNpcName(name))); }
caseRun(["Mara the Younger"], "Captain Mara");
caseRun(["Mara the Younger"], "Mara the Elder");
caseRun(["Mara the Younger"], "Old Mara");
caseRun(["Mara Voss"], "Mara");
caseRun(["Mara Voss"], "Captain Mara");
caseRun(["Mara Voss", "Mara"], "Captain Mara");
caseRun(["The Scarred Man"], "The Scarred Woman");
caseRun(["Brother Aldo"], "Aldo");
caseRun(["Guard Captain Holt"], "Holt the Smith");
caseRun(["Hemlock"], "Hemlock the Younger");
caseRun(["Tam"], "Tam's mother");
caseRun(["Brin Ashby"], "Ashby");
caseRun(["Brin Ashby", "Kell Ashby"], "Ashby");
caseRun(["Mara Voss"], "MARA VOSS");
caseRun(["Mara Voss"], "Mara  Voss.");
