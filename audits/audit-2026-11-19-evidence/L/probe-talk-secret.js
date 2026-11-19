var L = require("C:/Projects/traffic-and-dragons/dev/load-engine.js");
var fs = require("fs");
L.loadEngine();
var ws = L.makeTestWorld();
ws.skeleton = { acts: [{ title: "Act 1", status: "active" }, { title: "Act 2", status: "pending" }] };
ws.npcs = [{ name: "Mira", partyMember: true, charSheet: { name: "Mira", cls: "Rogue", backstory: "A wanderer.", coreMemories: [] } }];
memory.npcs.Mira = { attitude: "warm", knowledge: ["Mira travels with Tess"], events: [], aliases: [],
  secrets: [{ source: "blueprint", text: "Mira is secretly the Guild's spy and will betray Tess at the bridge.", revealAct: 1 }],
  authored: [{ source: "blueprint", field: "notes", text: "GM: in Act 2 Mira leads the party into the ambush at Greyford." }] };
// companion-talk.js needs carMode etc. only at call time
global.CAR_HOST = {}; global.carSessionHost = function () {};
(0, eval)(fs.readFileSync("C:/Projects/traffic-and-dragons/companion-talk.js", "utf8"));
var p = talkPartner("Mira");
var ctx = talkContext(p);
var persona = talkPersona(p.sheet, ctx, "offstage");
console.log("npcDetail:\n" + ctx.npcDetail);
console.log("---- persona contains secret:", persona.indexOf("betray Tess") >= 0, " authored guidance:", persona.indexOf("ambush at Greyford") >= 0);
console.log("---- persona length", persona.length);
// trim pass: does the trim ever cut the rules? build a huge context
var big = { heroName: "Tess", isHero: false, campName: "C", place: { location: "X".repeat(3000), region: "R".repeat(3000) }, chapters: ["a".repeat(500), "b".repeat(500)], lastScene: "s".repeat(500),
  bonds: [], coreMemories: [], npcDetail: "d".repeat(2000) };
var sh = { name: "Mira", backstory: "x".repeat(800), appear: "y".repeat(400), trait: "t".repeat(400), flaw: "f".repeat(400), motivation: "m".repeat(400), manner: "q".repeat(400) };
var bp = talkPersona(sh, big, "offstage");
console.log("big persona length", bp.length, "cap 5720; rules kept:", bp.indexOf("WHAT YOU MUST NOT DO") >= 0, bp.indexOf("being an AI") >= 0);
