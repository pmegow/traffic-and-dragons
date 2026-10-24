// dev/sabotage-660-dice-record.js — proves the #660/#666 guards on the dice record. #660, its FILING: the DICE handler reads a
// stated form's total after its last "=" (never the digits mashed together), and the record the continuation carries —
// applied one turn after the click filed it — is the player's own roll, skipped with one turn's tolerance and the label's
// case, never a second faceless GM entry. #666, its SHAPE and the card: the player's record states its face ("d20 = 1 + 1 = 2",
// "d20 = 7" with nothing added), and the card prints a stated form as the natural roll in bold with the arithmetic after it,
// escaped. Each reversal must turn the #660/#666 section red.
//   node dev/sabotage-660-dice-record.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#660"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the total is the digits mashed together again (a stated form files 201922112)",
    find: 'm=(eq>=0?s.slice(eq+1):s).match(/-?\\d+/)', replace: 'm=s.replace(/[^-\\d]/g,"").match(/-?\\d+/)' },
  { label: "the record is a bare total again (the natural roll never reaches the card)",
    find: '"|"+stated+"|"+outcome', replace: '"|"+total+"|"+outcome' },
  { label: "a zero modifier states a phantom '= total'",
    find: '+Math.abs(chk.mod)+" = "+total:"");', replace: '+Math.abs(chk.mod):"")+" = "+total;' }
]);
prove("tag_table.js", [
  { label: "the echo skip demands the same turn again (the continuation's record files as a GM roll)",
    find: "R.turn-last.t>=0&&R.turn-last.t<=1", replace: "last.t===R.turn" },
  { label: "the echo skip is case-exact again",
    find: "String(last.label).toLowerCase()===label.toLowerCase()", replace: "last.label===label" }
]);
prove("api.js", [
  { label: "the card prints the field whole again (the total under a d20 label)",
    find: "return m?'d20: <strong>'+m[1]+'</strong>'+escHtml(m[2]):", replace: "return false?'d20: <strong>'+m[1]+'</strong>'+escHtml(m[2]):" },
  { label: "the arithmetic after the face is printed unescaped",
    find: "'</strong>'+escHtml(m[2]):", replace: "'</strong>'+m[2]:" }
]);
process.exit(code);
