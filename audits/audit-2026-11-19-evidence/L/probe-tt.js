var L = require("C:/Projects/traffic-and-dragons/dev/load-engine.js");
L.loadEngine();
var ws = L.makeTestWorld();
memory.npcs["Lord Vexmoor"] = { attitude: "", knowledge: ["Secretly leads the Ashen Cult"], events: [], aliases: [], blueprintSeeded: true,
  secrets: [{ source: "blueprint", text: "Vexmoor is the cult's master.", revealAct: 1 }] };
ws.npcs = [{ name: "Lord Vexmoor", status: "", faction: "" }];
ws.skeleton = { acts: [{ title: "A1", status: "active" }] };
memory.futureEvents.push({ what: "The Ashen Cult burns Ashfen", when: "in 3 days", resolved: false });
var discovered = (typeof npcDiscovered === "function") ? npcDiscovered(ws.npcs[0]) : "n/a";
console.log("npcDiscovered(Vexmoor):", discovered);
var p = buildTableTalkPrompt("who are the people in this campaign?");
p.split("\n").forEach(function (l) { if (/Vexmoor|Ashen|PENDING|KNOWN NPCs/.test(l)) console.log("TT> " + l.slice(0, 300)); });
