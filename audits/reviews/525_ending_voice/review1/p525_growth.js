require("./h.js");
// Full flow: a hero whose first name ends (or starts) with a non-ASCII letter. The ending is filed with a correct RECORD line,
// then the save is "loaded" N times (migrateWorldState is the load path's heal battery: loadState / importSave / cloud adopt).
function flow(hero, record, loads) {
  var c = w525(hero), d = wsNpcByName("Daeris").charSheet;
  var q = quiet(function () { return fileDenouement("You walk out of the palace.\n\nYou learned to stay.\nRECORD: " + record); });
  console.log("\n=== hero " + J(hero) + " — RECORD: " + record);
  console.log("filed (hero)      : " + J(endings(c)));
  console.log("filed (companion) : " + J(endings(d)));
  console.log("fate.line         : " + J(c.fate && c.fate.line));
  var i;
  for (i = 1; i <= loads; i++) {
    var r = quiet(function () { return migrateWorldState(); });
    var info = r.warns.filter(function (w) { return /#525/.test(w); });
    console.log("load " + i + ": migrateWorldState() -> " + r.r + (info.length ? "  | " + info.join(" | ") : "") + "\n        hero ending: " + J(endings(c)[0]) + " (len " + endings(c)[0].length + ")");
  }
  var blk = buildCoreMemoryBlock();
  console.log("DEFINING MOMENTS line the GM reads each turn:\n  " + (blk.split("\n").filter(function (l) { return /ending|learned|stay/.test(l); })[0] || "(none)"));
}
flow("Ammut", "Ammut learned to stay when leaving was easier.", 3);
flow("José", "José learned to stay when leaving was easier.", 5);
flow("Zoë Marsh", "Zoë learned to stay when leaving was easier.", 3);
flow("Éowyn", "Éowyn learned to stay when leaving was easier.", 3);
flow("Dr. Vex", "Dr. Vex learned to stay when leaving was easier.", 3);
