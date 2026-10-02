require("./h.js");
var OLD = "I spent nineteen levels pulling the pin on every grenade in the realm. The bill never came due.";
function sheetEnd(cs) { return J(endings(cs)); }
// 1. hero swapped AFTER the ending was filed (adventure shape: the old hero becomes a companion)
var c = w525("Ammut"), d = wsNpcByName("Daeris");
c.coreMemories = [{ text: OLD, turn: 89, kind: "ending", who: "Ammut", camp: "P" }]; d.charSheet.coreMemories = [{ text: OLD, turn: 89, kind: "ending", who: "Ammut", camp: "P" }];
d.charSheet.gender = "F"; c.gender = "M";
var sw = quiet(function () { return swapPlayerCharacter("Daeris"); }).r;
console.log("1. swap -> " + J(sw && { ok: sw.ok, from: sw.from, to: sw.to }) + " | hero now " + worldState.character.name);
var n1 = healEndingMoments(worldState), n2 = healEndingMoments(worldState);
console.log("   heal: " + n1 + " then " + n2 + " | new hero (Daeris) " + sheetEnd(worldState.character) + " | old hero sheet " + sheetEnd(wsNpcByName("Ammut").charSheet));
// 2. a hero whose first name token is a common word
[["The Entity", OLD], ["The Entity", "I never learned to stay."], ["A", "A quiet life was all I wanted."], ["Old Tom", "The old road refused to change me."], ["I", "I spent nineteen levels."], ["Will", "Will you remember me? I doubt it."], ["Hope", "Hope was all I had left."]].forEach(function (p) {
  var cc = w525(p[0]); cc.coreMemories = [{ text: p[1], turn: 89, kind: "ending", who: p[0] }];
  var n = healEndingMoments(worldState);
  console.log("2. hero " + J(p[0]) + " old ending " + J(p[1]) + " -> healed " + n + " : " + sheetEnd(cc));
});
// 3. a companion's OWN ending from her own earlier campaign, and an ending that already has the prefix, and surname/nickname only
var c3 = w525("Ammut"), d3 = wsNpcByName("Daeris").charSheet;
d3.coreMemories = [{ text: "Daeris walked out of the temple and did not look back.", turn: 40, kind: "ending", who: "Daeris", camp: "Her Own Tale" },
  { text: "She walked out of the temple and did not look back.", turn: 41, kind: "ending", who: "Daeris", camp: "Her Other Tale" }];
c3.coreMemories = [{ text: "Ammut's ending: I spent nineteen levels.", turn: 89, kind: "ending", who: "Ammut" },
  { text: "The Rogue of Ashfen learned to stay.", turn: 90, kind: "ending", who: "Ammut" },
  { text: "ammut learned to stay.", turn: 91, kind: "ending", who: "Ammut" },
  { text: "Ammut's ending: ", turn: 92, kind: "ending", who: "Ammut" },
  { text: "", turn: 93, kind: "ending", who: "Ammut" },
  { text: "It ended.", turn: 94, kind: "ending", who: "" },
  { text: "I held the bridge.", turn: 95, kind: "gm", who: "Ammut" }];
var a = healEndingMoments(worldState), b = healEndingMoments(worldState);
console.log("3. heal " + a + " then " + b + "\n   Daeris: " + J(d3.coreMemories.map(function (m) { return m.text; })) + "\n   Ammut : " + J(c3.coreMemories.map(function (m) { return m.text; })));
