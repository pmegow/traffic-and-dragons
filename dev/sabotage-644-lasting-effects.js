// dev/sabotage-644-lasting-effects.js — proves #644's guards (a lasting effect on the player is a condition): the engine's own
// filing of a lasting self-targeted spell, the one-round exclusion, the GM-named-it-first rule and the doc sentence must each
// turn the mana-pool section red.
//   node dev/sabotage-644-lasting-effects.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "mana pool"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "the cast no longer files its own condition",
    find: "spellSelfConditionFile(sp,text,R);/* #644 */", replace: "",
    mustFail: "files itself as a condition" },
  { label: "the GM's same-response [CONDITION:] no longer stands alone (the engine doubles it)",
    find: "  for(i=0;i<tags.length;i++)if(tags[i].toLowerCase().indexOf(low)>=0)return;\n", replace: "",
    mustFail: "the engine never doubles it" },
  { label: "the doc line loses the lasting-effect sentence",
    find: "A LASTING EFFECT ON THE PLAYER IS A CONDITION TOO: ", replace: "",
    mustFail: "doc line teaches" }
]);
prove("helpers.js", [
  { label: "a one-round spell becomes a sheet condition",
    find: "  if(/^1 round$/i.test(d))return null;\n", replace: "",
    mustFail: "capabilityLastingSelf" },
  { label: "a 'self or someone' target counts as the player",
    find: "if(!/^self\\b/i.test(t)||/\\bor\\b/i.test(t))return null;", replace: "if(!/^self\\b/i.test(t))return null;",
    mustFail: "capabilityLastingSelf" }
]);
process.exit(code);
