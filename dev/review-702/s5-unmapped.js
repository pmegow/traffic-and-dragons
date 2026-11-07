// s5-unmapped.js — part C: a scripted reply sequence in a campaign WITHOUT an atlas; dumps memory.map, identity, the
// pointer, the split records and the receipts per reply as JSON. Run at HEAD and at BASE; diff the two dumps.
var ROOT = process.argv[2], OUTF = process.argv[3], fs = require("fs");
var H = require("./h.js")(ROOT);
H.startBare();
var sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = "Bren"; delete sheet.splitLoc;
worldState.npcs.push({ name: "Bren", status: "travelling with the party", attitude: "friendly", partyMember: true, charSheet: sheet }); memory.npcs.Bren = { events: [], firstSeen: 1 };
var replies = [
  "You reach the town. [LOCATION:Oakhaven][LOCATION_DESC:A market town on the river.]",
  "Into the inn. [SUBLOCATION:The Old Ram][LOCATION_DESC:Low beams, a long bar.]",
  "Through to the kitchen. [SUBLOCATION:Kitchen][LOCATION_DESC:Copper pots.][LOCATION_ITEM:Ladle|placed]",
  "You hang up the cleaver and step next door. [LOCATION_ITEM:Cleaver|placed|Kitchen][LOCATION_STATE:The window is broken.|Kitchen][SUBLOCATION:Pantry]",
  "Back out. [SUBLOCATION_LEAVE]",
  "Into the kitchen by the back way. [SUBLOCATION:Kitchen]",
  "A low door. [EXIT:Scullery|a low door]",
  "Through it. [SUBLOCATION:Scullery]",
  "You leave the fork and go out into the street. [LOCATION:Oakhaven][LOCATION_ITEM:Fork|placed|Kitchen][LOCATION_STATE:Dusty.|Kitchen]",
  "The town again. [LOCATION:Oakhaven][LOCATION:Oakhaven][SUBLOCATION:Kitchen]",
  "Bren stays. [PARTY_SPLIT:Bren|Oakhaven|Kitchen][SUBLOCATION:Pantry]",
  "A quiet moment.",
  "Back to Bren. [SUBLOCATION:Kitchen]",
  "The road. [SUBLOCATION_LEAVE][LOCATION:Marrowgate][LOCATION_DESC:A fishing village.]",
  "Into its inn. [SUBLOCATION:The Ashen Hare][SUBLOCATION:Kitchen][LOCATION_DESC:THE HARE'S KITCHEN.]",
  "A letter left and away. [LOCATION_ITEM:Letter|placed|Kitchen][LOCATION:Oakhaven]",
  "Into the Ram's kitchen. [SUBLOCATION:The Old Ram — Kitchen]",
  "A hyphen. [SUBLOCATION:The Old Ram - Pantry]",
  "The GM says where. [LOCATION:Bleakford][MAP_PLACE:Bleakford|near Oakhaven]",
  "Back. [LOCATION:Oakhaven][SUBLOCATION:the Kitchen]",
  "A world named like a room. [LOCATION:Kitchen]",
  "Deep. [SUBLOCATION:The Old Ram][SUBLOCATION:Cellar][SUBLOCATION:Vault]",
  "A door into the dark. [EXIT:Crypt|an iron door][SUBLOCATION_LEAVE]",
  "Through the iron door. [SUBLOCATION:Crypt]",
  "Out and on. [SUBLOCATION_LEAVE][LOCATION:The Salt Road][LOCATION:Marrowgate]",
  "A cave. [LOCATION:The Weeping Hollow][SUBLOCATION:The Silver Cavern]",
  "The pair. [SUBLOCATION:The Weeping Hollow — The Silver Cavern]",
  "A placement in the cave. [LOCATION_ITEM:Torch|placed|The Silver Cavern][LOCATION_STATE:Dripping.|The Silver Cavern]"
];
var dump = [];
replies.forEach(function (t, i) {
  var R = H.mutsOf(t); atlasFollow();
  dump.push({ i: i, reply: t, muts: R.muts, world: worldState.world.location, sub: worldState.world.sublocation, twins: worldState.locationTwinConflicts || null,
    split: (worldState.npcs.filter(function (p) { return p.name === "Bren"; })[0].charSheet.splitLoc) || null, placeDecls: worldState.placeDecls || null,
    nodes: Object.keys(memory.map.nodes).sort().map(function (k) { var n = memory.map.nodes[k]; return [k, n.parent, n.visits, n.description, (n.items || []).map(function (x) { return x.name; }), (n.stateNotes || []).map(function (x) { return x.n; }), (n.exits || []).map(function (x) { return x.name; })]; }),
    edges: memory.map.edges.map(function (e) { return e.from + ">" + e.to; }), identity: memory.map.identity || null, lastArrivalFrom: memory.map.lastArrivalFrom });
});
fs.writeFileSync(OUTF, JSON.stringify(dump, null, 1));
console.log("wrote " + OUTF + " (" + dump.length + " replies, " + Object.keys(memory.map.nodes).length + " nodes)");
