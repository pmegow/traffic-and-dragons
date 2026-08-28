// Retained mutation proof for Fable f82's martial-menu exclusivity census.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "capability_bible.js",
  command: ["node", ["dev/run-tests.js", "capcapability_bible (TODO #10)"]],
  cases: [{
    label: "Stolen voice leaks back into the martial menu",
    mustFail: "martial menu is exclusive of every caster tradition",
    find: 'category:["arcane"],range:"self",targets:"self",duration:"4 hours or until dismissed"',
    replace: 'category:["arcane","martial"],range:"self",targets:"self",duration:"4 hours or until dismissed"'
  }]
}));
