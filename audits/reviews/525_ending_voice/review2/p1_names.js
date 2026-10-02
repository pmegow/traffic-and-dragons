// Probe 1: endingMomentText / textNamesPerson / personNameWords with hand-picked names.
require("./h.js");

var names = [
  "", " ", "   ", "\t", "The", "Sir", "Mr.", "Mr", "Dr.", "The Captain", "the captain", "Captain", "Lady", "Sister", "Brother", "King", "A", "An", "Of",
  "X", "V", "7", "47", "T-800", "R2-D2", "Mr. T", "J. R. R. Tolkien", "J.R.R.", "A B C",
  "\uD83D\uDD25", "\uD83D\uDD25 Blaze", "Blaze \uD83D\uDD25", "\uD83D\uDE00\uD83D\uDE00", "\uD801\uDC00\uD801\uDC01", // emoji, Deseret (astral cased letters)
  "Jose\u0301", "Jos\u00e9", "Zoe\u0308", "Zo\u00eb", "Rene\u0301e", "\u0130brahim", "Stra\u00dfe", "\u00dfeta", "\u01c5ungla", "\uFB01sh",
  "O'Brien", "O\u2019Brien", "Jean-Luc", "D'Arcy", "D\u2019Arcy", "Anne-Marie St. Clair", "St. John", "Mary-Jane",
  "a.b*c", ".*", "(Rook)", "[Rook]", "\"Lucky\"", "$", "^$", "\\", "\\b", "Rook?", "Rook+", "C++", "C#", "A|B", "Mr. (Fox)",
  "Silas's", "Chris'", "James's Ghost", "Ammut's", "Bram 's",
  "Will", "Hope", "Grace", "Ammut the Black", "Rose Red", "Ash", "May", "Mark",
  "\u592a\u90ce", "\u592a\u90ceA", "A\u592a\u90ce", "\u0418\u0432\u0430\u043d", "\u05d3\u05d5\u05d3", "\u0645\u062d\u0645\u062f", "\u0e2a\u0e21\u0e0a\u0e32\u0e22", "\u0930\u093e\u092e",
  "constructor", "__proto__", "toString", "hasOwnProperty", "Constructor", "valueOf",
  "Ammut  Silverhand", " Ammut ", "Ammut\u00a0Silverhand", "Ammut\u3000Silverhand", "\uFEFFAmmut", "Ammut\u200b", "\u200bAmmut", "Am\u00admut",
  "McCoy", "mcCoy", "de la Cruz", "van der Berg", "al-Rashid", "ibn Sina", "e. e. cummings", "bell hooks", "x", "xx",
  "Sir", "Sir Sir", "The The", "Mr. Mrs.", "A. B.", "...", "---", "'", "''", "' '", "'s", "s", "ending", "Ammut's ending:", "'s ending: ",
  "0", "00", "1 2 3", "NaN", "null", "undefined", "true"
];
var texts = [
  "You learned to stay.", "I spent nineteen levels pretending.", "He was never the grand anchor.", "", " ", "Tomorrow you will rest.",
  "Willingly you went.", "Will you stay?", "The captain went down with the ship.", "x", "7 times you fell.", "s", "'s ending: ", "ending"
];
var bad = 0, n = 0;
names.forEach(function (who) {
  texts.forEach(function (t) {
    n++;
    var a = endingMomentText(who, t), b = endingMomentText(who, a), c = endingMomentText(who, b);
    if (a !== b || b !== c) { bad++; console.log("NOT IDEMPOTENT who=" + JSON.stringify(who) + " text=" + JSON.stringify(t) + "\n  1: " + JSON.stringify(a) + "\n  2: " + JSON.stringify(b) + "\n  3: " + JSON.stringify(c)); }
  });
});
console.log("pairs: " + n + ", non-idempotent: " + bad);
// show personNameWords for each
names.forEach(function (who) { console.log(JSON.stringify(who) + " -> " + JSON.stringify(personNameWords(who))); });
