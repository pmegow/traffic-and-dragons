// Probe 10: stampCampaignFates / endingMomentText with names that share a word; repeated calls; vocatives.
// usage: [ER=<tree>] node p10_fates.js
require("./h.js");
function world(hero, comps) {
  makeWorld(); var c = worldState.character; c.name = hero; c.coreMemories = []; worldState.campName = "The Long Walk"; worldState.turn = 89; worldState.transcript = []; memory.chapters = [];
  worldState.ended = { turn: 89, cause: "the tale is told" };
  comps.forEach(function (n) { worldState.npcs.push({ name: n, status: "steady", rel: "companion", partyMember: true, charSheet: { name: n, coreMemories: [] } }); });
  return c;
}
function fates() { var o = {}; o[worldState.character.name + " (hero)"] = worldState.character.fate && worldState.character.fate.line; worldState.npcs.forEach(function (n) { if (n.charSheet) o[n.name] = n.charSheet.fate && n.charSheet.fate.line; }); return o; }
function go(label, hero, comps, reply) {
  world(hero, comps);
  quiet(function () { fileDenouement(reply); });
  console.log("== " + label + "\n   hero=" + JSON.stringify(hero) + " comps=" + JSON.stringify(comps) + "\n   reply=" + JSON.stringify(reply));
  var f = fates(); Object.keys(f).forEach(function (k) { console.log("   fate[" + k + "] = " + JSON.stringify(f[k])); });
  console.log("   hero ending moment = " + JSON.stringify((worldState.character.coreMemories || []).filter(function (m) { return m.kind === "ending"; }).map(function (m) { return m.text; })));
}
go("shared surname: hero + spouse", "Ammut Zethran", ["Morwen Zethran", "Daeris"],
  "You walk out of the palace. Morwen Zethran keeps the house by the mill, and counts the days. Daeris laughed once, at the gate.\n\nYou learned to stay.\nRECORD: Ammut Zethran learned to stay when leaving was easier.");
go("shared surname: two sisters in the party", "Ammut", ["Frizwick Vale", "Daeris Vale"],
  "You walk out. Daeris Vale took the high road north. Frizwick Vale opened a shop and never spoke of it.\n\nYou learned to stay.\nRECORD: Ammut learned to stay.");
go("shared epithet word", "Ammut", ["Old Tam", "Old Marta"],
  "You walk out. Old Marta kept the inn. Old Tam went back to the river.\n\nRECORD: Ammut learned to stay.");
go("companion's name word is an ordinary word (Rose Red / hero Red Sonja)", "Red Sonja", ["Rose Red"],
  "You walk out. Red was the sky that night. Rose kept the garden.\n\nRECORD: Sonja left.");
go("hero named by a vocative in the prose", "Ammut", ["Morwen"],
  "You walk out. \"You did it, Ammut,\" Morwen says, and that is all she says.\n\nRECORD: Ammut learned to stay.");
go("companion with a title and full stop", "Ammut", ["Dr. Vex", "Mr. Fox"],
  "You walk out. Dr. Vex closed the clinic. Mr. Fox went north.\n\nRECORD: Ammut learned to stay.");
go("companion named in the hero-naming sentence", "Ammut", ["Morwen"],
  "Ammut, you walk out, and Morwen follows.\n\nRECORD: Ammut learned to stay.");
go("no companion sentence", "Ammut", ["Morwen"], "You walk out.\n\nRECORD: Ammut learned to stay.");
// repeated calls: does anything stack?
world("José", ["Morwen"]);
var prose = "You walk out. Morwen walks beside you.";
quiet(function () { stampCampaignFates(prose, "José learned to stay."); }); var a = JSON.stringify(fates());
quiet(function () { stampCampaignFates(prose, "José learned to stay."); stampCampaignFates(prose, "José learned to stay."); }); var b = JSON.stringify(fates());
console.log("== repeated stamp x3 identical: " + (a === b) + " " + b);
// feeding a stamped line back in as prose (a second ending written from the first's lines)
var back = worldState.npcs[0].charSheet.fate.line;
quiet(function () { stampCampaignFates(back, ""); }); console.log("   re-stamp from own line: " + JSON.stringify(fates()));
// endingMomentText: a text that does NOT name the hero, passed bare because of a shared word
[["Ammut Zethran", "I left Morwen Zethran at the gate and never looked back."], ["Silas Morne", "I buried Edda Morne and kept walking."], ["Ammut the Black", "I walked through the Black Gate and never looked back."],
 ["Old Ben", "Old habits kept me alive."], ["Little John", "Little did I know."], ["Count Orlok", "Count the dead; I did."], ["Korrag the Bold", "Bold moves were never my way."],
 ["The Captain", "In the end the Captain kept his ship."], ["ammut", "Ammut learned to stay."], ["D'Arcy", "D’Arcy learned to stay."], ["Jean-Luc", "Jean learned to stay."], ["José", "José learned to stay."], ["Sir Galahad", "Sir Galahad's quest ended."],
 ["Ammut", "AMMUT LEARNED TO STAY."], ["Ammut", "Ammut’s road ended here."], ["Mr. T", "T pitied the fool."], ["דוד", "הדודה שלי באה."]
].forEach(function (p) { console.log("endingMomentText(" + JSON.stringify(p[0]) + ", " + JSON.stringify(p[1]) + ") = " + JSON.stringify(endingMomentText(p[0], p[1]))); });
