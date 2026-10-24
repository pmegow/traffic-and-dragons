// dev/sabotage-667-stance.js — proves the #667 guards: the scene-render brief's STANCE clause (every pose clause places both
// feet and both hands; a crouch, kneel or lean names the knee and the weight-bearing foot), and the #208 ① exact-count
// sentence as ONE function read by the reference legend and appended to every text-only party render. Each reversal must
// turn the #667 section red.
//   node dev/sabotage-667-stance.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#667"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("game.js", [
  { label: "the STANCE clause loses its name (the writer is told nothing it can find)",
    find: "+\"STANCE: every pose clause PLACES the body's four contacts", replace: "+\"POSE: every pose clause PLACES the body's four contacts" },
  { label: "the four contacts go vague again",
    find: "both feet and both hands — in words", replace: "the feet and the hands — in words" },
  { label: "a crouch no longer names the knee and the weight-bearing foot",
    find: "names which knee is down and which foot carries the weight", replace: "is described" },
  { label: "the clause turns into a negation (#209d: the encoder keeps the forbidden word)",
    find: "An unplaced crouch or lean is read two ways at once; placed contacts fix one.", replace: "Never leave a crouch or lean unplaced." },
  { label: "the legend grows its own copy of the count sentence",
    find: 's+=" "+renderBodyCount(total)+', replace: 's+=" The scene contains EXACTLY "+total+" "+(total===1?"person":"people")+": one body per named character, never the same face twice"+' },
  { label: "the text-only party render gets no count again",
    find: 'else if(sc.textOnly)falPrompt+=" "+renderBodyCount(party.length+1)+".";', replace: 'else if(false)falPrompt+=" "+renderBodyCount(party.length+1)+".";' }
]);
process.exit(code);
