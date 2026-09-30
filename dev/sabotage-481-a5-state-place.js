// dev/sabotage-481-a5-state-place.js — proves the #481 A5 guards are guarded: a [LOCATION_STATE:note|place] operand is
// resolved by the one place resolver (or names the world node), and an unresolvable or malformed body is refused loudly
// with nothing stored. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-a5-state-place.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "tag_table.js", command: ["node", ["dev/run-tests.js", "#481 A5"]], cases: [
  { label: "the operand is text again (the t191 pipe is stored as the note)",
    find: "lsBar=lsm[1].split(\"|\"),", replace: "lsBar=[lsm[1]],",
    mustFail: "the place operand files the note where it names" },
  { label: "an unresolvable place files at the party's node instead of refusing",
    find: "    if(!lsKey){R.muts.push(\"⚠ [LOCATION_STATE:] refused — '\"", replace: "    if(!lsKey)lsKey=currentNodeKey();if(false){R.muts.push(\"⚠ [LOCATION_STATE:] refused — '\"",
    mustFail: "an unresolvable place is refused loudly" },
  { label: "the world node is no place (the t191 note is refused)",
    find: "((typeof locSame===\"function\"&&locSame(lsPl,lsW))?lsW:null)", replace: "null",
    mustFail: "the place operand files the note where it names" },
  { label: "a second pipe is accepted",
    find: "  if(lsBar.length>2||!lsNote||", replace: "  if(false||!lsNote||",
    mustFail: "an unresolvable place is refused loudly" },
  { label: "a house named by the note is minted without its owner",
    find: "    if(lsRp&&lsRp.via===\"house\"&&!memory.map.nodes[lsKey]&&typeof villageHouseEnsure===\"function\")villageHouseEnsure(lsRp.owner,lsW);", replace: "",
    mustFail: "the place operand files the note where it names" }
]}));
