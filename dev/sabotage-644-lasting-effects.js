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
    find: "spellSelfConditionFile(worldState.character,sp,text,R,\"\");/* #644 */", replace: "",
    mustFail: "files itself as a condition" },
  { label: "the same-response skip is gone — an effect-named GM entry is doubled (a spell-named one still folds through the merge)",
    find: "for(i=0;i<tags.length;i++)if(conditionMentionsSpell(tags[i],name)){", replace: "for(i=0;i<tags.length;i++)if(false){",
    mustFail: "the GM's entry stands alone" },
  { label: "the doc line loses the lasting-effect sentence",
    find: "A LASTING EFFECT ON THE PLAYER IS A CONDITION TOO: ", replace: "",
    mustFail: "doc line teaches" }
]);
prove("tag_table.js", [
  { label: "a later GM filing of the same effect no longer merges (two entries again)",
    find: "_ownCause.indexOf(OWN_SPELL_CAUSE)===0&&ccause.toLowerCase().indexOf(_ownCause.slice(OWN_SPELL_CAUSE.length).toLowerCase())>=0", replace: "false",
    mustFail: "merges into the engine's entry" },
  { label: "the long rest no longer sweeps the engine's self-spell conditions",
    find: "var _faded=(typeof restClearPartyOwnSpellConditions===\"function\")?restClearPartyOwnSpellConditions():[];/* #649: party-wide */", replace: "var _faded=[];",
    mustFail: "a long rest sweeps" }
]);
prove("helpers.js", [
  { label: "an overlay's 'Instantaneous.' passes as lasting again (the trailing period)",
    find: ".trim().replace(/[.\\s]+$/,\"\")", replace: ".trim()",
    mustFail: "overlay durations" },
  { label: "a one-round spell becomes a sheet condition",
    find: "  if(/^(1|one|a|single)\\s+(round|turn)\\b/i.test(d)||/^until (the (start|end) of )?your next turn\\b/i.test(d))return null;", replace: "",
    mustFail: "capabilityLastingSelf" },
  { label: "a 'self or someone' target counts as the player",
    find: "if(!/^(self|you)\\b/i.test(t)||/\\bor\\b/i.test(t))return null;", replace: "if(!/^(self|you)\\b/i.test(t))return null;",
    mustFail: "capabilityLastingSelf" }
]);
process.exit(code);
