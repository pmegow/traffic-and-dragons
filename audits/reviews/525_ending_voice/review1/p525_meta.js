require("./h.js");
var bs = String.fromCharCode(92);
["Ro]ok", "Ro" + bs + "ok", "Ro[ok", "^Rook", "Ro-ok", "Ro/ok", "Ro|ok", "Ro{2}k", "R.k", "Ro$ok", "R*", "?", bs, "Ro ok", "  Rook  ", "Rook" + bs].forEach(function (nm) {
  try {
    var first = nm.trim().split(/\s+/)[0];
    var a = endingMomentText(nm, first + " learned to stay."), b = endingMomentText(nm, a);
    var x = endingMomentText(nm, "Rxk learned. Rook stayed. Rok left.");
    console.log(JSON.stringify(nm) + " -> " + JSON.stringify(a) + (a !== b ? "  [second pass differs: " + JSON.stringify(b) + "]" : "") + "  | metachar literal? " + JSON.stringify(x).slice(0, 70));
  } catch (e) { console.log(JSON.stringify(nm) + " THROWS " + e.message); }
});
