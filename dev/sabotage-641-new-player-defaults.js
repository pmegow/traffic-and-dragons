// dev/sabotage-641-new-player-defaults.js — proves the new-player defaults are guarded (#641, owner 2026-10-16): each load
// fallback is mutated back toward the old default — prose to the house voice, dice to OFF, large text to the iOS carve-out —
// and the wizard's seed from the device default is removed; the #641 test must name each.
//   node dev/sabotage-641-new-player-defaults.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "class bible (#72)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var T = "#641 new-player defaults";
prove("ui-modals.js", [
  { label: "prose style falls back to the house voice again",
    find: 'proseAuthor=(typeof v==="string")?v:"leguin";', replace: 'proseAuthor=(typeof v==="string")?v:"";',
    mustFail: T },
  { label: "player rolls own dice falls back to OFF again",
    find: 'playerRollsDice=(v===null||v===undefined)?true:v==="1";', replace: 'playerRollsDice=v==="1";',
    mustFail: T },
  { label: "large text comes back ON by default (the carve-out returns)",
    find: 'var large=saved!==null?(saved==="1"):false;', replace: 'var large=saved!==null?(saved==="1"):true;',
    mustFail: T }
]);
prove("char-creation.js", [
  { label: "the wizard no longer seeds its prose picker from the device default (a new campaign starts in the house voice)",
    find: 'if(cs.author==null)cs.author=(typeof proseAuthor==="string")?proseAuthor:"";', replace: "",
    mustFail: T }
]);
process.exit(code);
