require("./h.js");
// endingMomentText: does a text that DOES name the hero get recognised, for assorted hero names?
var names = ["Ammut", "Silas Morne", "José", "Renée", "Zoë", "Éowyn", "Finwë", "Åsa", "Björn", "Mr. Fox", "Dr. Vex", "St. Aldous", "J. Smith", "\"Lucky\" Jack", "D'Artagnan",
  "The Gray Fox", "A", "I", "Al", "Will", "Sir Galen", "Captain Vex", "O'", "X-23", "C++", "(Rook)", "$ilver", "Mary-Anne", "Иван", "アムト", "ammut", "Na'vi", "Tom.", "R2D2", "Anne Marie"];
names.forEach(function (nm) {
  var first = nm.split(/\s+/)[0];
  var named = first + " learned to stay when leaving was easier.";      // a record that DOES name the hero (by first token)
  var a = endingMomentText(nm, named);
  var b = endingMomentText(nm, a), c = endingMomentText(nm, b);
  console.log(J(nm) + "\n   named record  -> " + J(a) + (a !== named ? "   <-- prefixed although it names the hero" : "") +
    "\n   2nd pass      -> " + (b === a ? "(stable)" : J(b) + "   <-- NOT IDEMPOTENT") + (c !== b ? "\n   3rd pass      -> " + J(c) : ""));
  var un = "The road had been easier, and still the hero stayed.";
  var u1 = endingMomentText(nm, un);
  console.log("   unnamed record-> " + J(u1) + (u1 === un ? "   <-- NOT prefixed (treated as naming the hero)" : ""));
});
