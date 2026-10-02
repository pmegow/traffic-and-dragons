require("./h.js");
// A RECORD sentence without a final full stop (or ending in a dash / ellipsis / colon): what is filed?
function go(label, rec, hero) {
  var c = w525(hero || "Ammut");
  var q = quiet(function () { return fileDenouement("You walk out of the palace.\n\nYou learned to stay.\nRECORD: " + rec); });
  console.log(label + "\n   RECORD: " + J(rec) + "\n   filed : " + J(endings(c)) + "   fate.line: " + J(c.fate && c.fate.line));
}
go("no terminal punctuation", "Ammut learned to stay when leaving was easier");
go("ends with an ellipsis char", "Ammut learned to stay, and then…");
go("ends with a dash", "Ammut learned to stay —");
go("ends with a closing parenthesis", "Ammut learned to stay (at last)");
go("bold with the period outside the stars", "**Ammut learned to stay**.");
go("short, no punctuation", "Ammut stayed");
go("two sentences, second unpunctuated", "Ammut learned to stay when leaving was easier. He never said why");
go("proper", "Ammut learned to stay when leaving was easier.");
