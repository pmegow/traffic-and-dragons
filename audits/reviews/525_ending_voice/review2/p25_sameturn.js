// Probe 25: a legacy hero who carries an ending from an EARLIER campaign that closed on the same turn number as this one.
var m = require("./p5_e2e.js");
(async function () {
  m.seed({ comps: [{ name: "Morwen" }], pre: function () {
    worldState.campName = "A New Tale"; worldState.campId = "camp_2";
    worldState.character.coreMemories = [{ text: "Ammut's ending: I spent nineteen levels pulling the pin.", turn: 89, kind: "ending", who: "Ammut", camp: "The Princess", campId: "camp_1" }];
  } });
  callGM = function () { return Promise.resolve("You walk out. Morwen follows.\nRECORD: Ammut learned to stay."); };
  await campaignDenouement();
  console.log("SAMETURN hero endings: " + JSON.stringify(worldState.character.coreMemories.filter(function (x) { return x.kind === "ending"; }).map(function (x) { return x.camp + " t" + x.turn + ": " + x.text; })));
  console.log("SAMETURN Morwen endings: " + JSON.stringify(worldState.npcs[0].charSheet.coreMemories.map(function (x) { return x.camp + " t" + x.turn + ": " + x.text; })) + " | owed=" + worldState.denouementOwed + " | hero fate=" + JSON.stringify(worldState.character.fate && worldState.character.fate.line));
  process.exit(0);
})();
