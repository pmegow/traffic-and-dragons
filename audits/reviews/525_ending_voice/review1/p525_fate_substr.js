require("./h.js");
function go(hero, prose, rec) {
  var c = w525(hero); worldState.ended = { turn: 89, cause: "the tale is told", at: 1, spine: true };
  quiet(function () { fileDenouement(prose + "\nRECORD: " + rec); });
  console.log("hero " + J(hero) + " -> fate.line " + J(c.fate && c.fate.line) + "   (record: " + J(rec) + ")");
}
go("Tom", "Tomorrow the bells will ring without you.\n\nYou learned to stay.", "Tom learned to stay.");
go("Al", "You walk out. Although the rain keeps falling, nobody waits.\n\nYou learned to stay.", "Al learned to stay.");
go("Will", "You walk out. Willows bend over the road you will not take.\n\nYou learned to stay.", "Will learned to stay.");
go("Ammut", "You walk out. The rain keeps falling.\n\nYou learned to stay.", "Ammut learned to stay.");
