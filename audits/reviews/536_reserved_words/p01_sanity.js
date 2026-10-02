// REVIEW PROBE p01: first candidates, one line each. argv: <tree>
var L = require("./lib.js");
var CASES = [
  ["exact (the author's own case)", "It happens. [ITEM_GAINED:constructor]"],
  ["plural s", "It happens. [ITEM_GAINED:Constructors]"],
  ["count suffix", "It happens. [ITEM_GAINED:constructor x2]"],
  ["parenthetical", "It happens. [ITEM_GAINED:Constructor (from Bram)]"],
  ["dash clause", "It happens. [ITEM_GAINED:Constructor — a mason's tool]"],
  ["two items, the second ordinary", "It happens. [ITEM_GAINED:Constructors] [ITEM_GAINED:Healing potion]"],
  ["nested bracket hides a LOCATION", "It happens. [TIME:dusk [LOCATION:constructor]"],
  ["nested bracket hides an NPC death", "It happens. [NOTE:see [NPC:constructor|dead|enemy]"],
  ["chained WARES tail", "It happens. [WARES:Ale|1 gp|good]|constructor|1 gp|odd]"],
  ["chained WARES tail __proto__", "It happens. [WARES:Ale|1 gp|good]|__proto__|1 gp|odd]"],
  ["ability with a parenthetical", "It happens. [ABILITY_GAINED:Constructor (lesser)|You raise a wall of stone.]"],
  ["spell def with a parenthetical", "It happens. [SPELL_DEF:Constructor (ritual)|range=30 ft|effect=raises a wall]"],
  ["layout second room", "It happens. [LAYOUT:hall|small|a bench|outside; constructor|small|a vat|hall]"],
  ["sublocation with article", "It happens. [SUBLOCATION:The Constructor]"],
  ["location with article", "It happens. [LOCATION:The Constructor]"]
];
CASES.forEach(function (c) {
  var r = L.runCase(c[1], "plain");
  var flags = [];
  if (r.thrown) flags.push("THROW out of applyMuts: " + r.thrown);
  if (r.errors.length) flags.push("handler error: " + r.errors.join("; "));
  if (r.poison.length) flags.push("WROTE ON BUILT-INS: " + r.poison.join(", "));
  if (r.promptThrow) flags.push("next buildSysPrompt THROWS: " + r.promptThrow);
  if (r.poison2.length) flags.push("prompt build wrote on built-ins: " + r.poison2.join(", "));
  if (r.serThrow) flags.push("serialize throws: " + r.serThrow);
  if (r.scan.length) flags.push("state: " + r.scan.slice(0, 4).join(" | "));
  console.log((flags.length ? "!! " : "   ") + c[0] + " :: " + c[1].slice(13) + "\n      refused=" + r.refused + " muts=" + JSON.stringify(r.muts).slice(0, 260) + (flags.length ? "\n      " + flags.join("\n      ") : ""));
});
