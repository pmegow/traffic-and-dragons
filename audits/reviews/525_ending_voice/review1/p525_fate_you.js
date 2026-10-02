require("./h.js");
// A second-person ending (as #525 now asks for) through the real engine: what lands on a COMPANION's sheet as fate.line,
// and what the Village Hall block then tells the GM when a DIFFERENT hero stands in the Hall.
var c = w525("Ammut"), dn = wsNpcByName("Daeris");
dn.charSheet.inventory = ["Silver holy symbol"]; dn.charSheet.gender = "F";
worldState.ended = { turn: 89, cause: "the tale is told", at: 1, spine: true };
var PROSE = "You walk out of the palace and the rain feels like a joke at your expense.\n\n" +
  "Daeris has her arm thrown over your chest, breathing easy, and she never asks where you buried the crown.\n\n" +
  "You learned to stay.";
quiet(function () { fileDenouement(PROSE + "\nRECORD: Ammut learned to stay when leaving was easier."); });
console.log("hero   fate.line: " + J(c.fate && c.fate.line));
console.log("Daeris fate.line: " + J(dn.charSheet.fate && dn.charSheet.fate.line));
console.log("Daeris ending   : " + J(endings(dn.charSheet)));
// The sheet rides into the library; a Village (played by another hero) moves her in and seeds the Hall.
var lib = JSON.parse(JSON.stringify(dn.charSheet));
villageEF();                                   // hero "Silas", residents Frizwick + Daeris (fixture) -> replace the fixture Daeris with the library copy
worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== "Daeris"; });
importVillageResidents([{ character: lib, updatedAt: 5 }]);
quiet(function () { villageHallSeed(); });
worldState.world.sublocation = "the Village Hall";
var geo = buildGeoBlock(), hall = (geo.match(/THE HALL[^\n]*/) || ["(no THE HALL line)"])[0];
console.log("\nVillage hero now: " + worldState.character.name);
console.log("GM-facing line: " + hall.slice(0, 600));
