// Probe 17: the word "constructor" through the word-keyed tables #533 did NOT convert (helpers.js MOTIF_STOP / motifWords / pastWords / pastRaisedByHero / ARCH_MATCH_STOP).
require("./h.js");
function safe(fn) { try { return fn(); } catch (e) { return "THROW " + e.message; } }
console.log("MOTIF_STOP is a plain object: " + (Object.getPrototypeOf(MOTIF_STOP) === Object.prototype) + " | MOTIF_STOP['constructor'] truthy: " + !!MOTIF_STOP["constructor"]);
console.log("motifWords('the constructor engines of the necrotic tether') = " + JSON.stringify(Object.keys(safe(function () { return motifWords("the constructor engines of the necrotic tether", []); }))));
console.log("pastWords('the constructor engines of the necrotic tether') = " + JSON.stringify(Object.keys(safe(function () { return pastWords("the constructor engines of the necrotic tether", {}); }))));
console.log("archMatchStems('constructor of golems, builder') = " + JSON.stringify(Object.keys(safe(function () { return archMatchStems("constructor of golems, builder"); }))));
var moments = [{ who: "Daeris", text: "Daeris broke the constructor that bound the tether engines.", camp: "Old", turn: 5 }];
console.log("pastRaisedByHero('what about the constructor and the engines?') = " + safe(function () { return pastRaisedByHero("what about the constructor and the engines?", [], ["Ammut", "Daeris"], moments); }) + "   (two record words in the action: constructor, engines)");
console.log("pastRaisedByHero('what about the constructor and the weather?') = " + safe(function () { return pastRaisedByHero("what about the constructor and the weather?", [], ["Ammut", "Daeris"], moments); }));
console.log("pastRaisedByHero('Daeris, the constructor?') = " + safe(function () { return pastRaisedByHero("Daeris, the constructor?", [], ["Ammut", "Daeris"], moments); }) + "   (her name + a word from her record)");
console.log("momentEchoWords('[the constructor broke the tether engines]') = " + JSON.stringify(safe(function () { return momentEchoWords("the constructor broke the tether engines", moments, ["Ammut"]); })));
console.log("detectMomentRetelling = " + JSON.stringify(safe(function () { return detectMomentRetelling("[SAY:Peet]\"She broke the constructor that bound the tether engines.\"", moments, ["Ammut"]); })));
// full prompt build + a turn with Malrik on file, to be sure nothing throws at the tip
makeWorld(); memory.npcs["Malrik the Constructor"] = { attitude: "", knowledge: ["builds golems"], events: [{ turn: 1, note: "met" }], aliases: [] }; worldState.npcs.push({ name: "Malrik the Constructor", status: "busy", rel: "neutral", met: 1 });
worldState.character.coreMemories = [{ kind: "bond", who: "Tess", text: "Tess spared the constructor.", turn: 3 }];
var r = run("The Constructor nods. [NPC:Malrik the Constructor|wary|ally] [NPC:The Constructor|dead|enemy] [NPC_NOTE:Constructor|he hums] [SCENE_CAST:Malrik the Constructor] [SAY:Malrik the Constructor]\"Fine.\"");
console.log("turn with Malrik: errors=" + JSON.stringify((r.r && r.r.errors) || []) + " muts=" + JSON.stringify(r.muts));
lastAction = "I ask the constructor about the constructor.";
console.log("buildSysPrompt: " + safe(function () { var s = quiet(function () { return buildSysPrompt(); }).r; return "ok " + s.stable.length + "/" + s.volatile.length; }));
