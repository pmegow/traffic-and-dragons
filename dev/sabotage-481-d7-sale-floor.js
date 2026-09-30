// dev/sabotage-481-d7-sale-floor.js — proves the #481 D7 guard is guarded: a counter sale LINE worth under half a gold
// piece is refused with its reason (nothing moves), while two of the same sell for 1 gp. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-481-d7-sale-floor.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "helpers.js", command: ["node", ["dev/run-tests.js", "#481 D7"]], cases: [
  { label: "a line worth nothing sells for nothing again (the item leaves, 0 gp)",
    find: "if(Math.round(r.sellGp*q)===0){under.push(", replace: "if(false){under.push(",
    mustFail: "a lone 3 sp whistle is refused" },
  { label: "the floor judges one unit, not the line (two whistles are refused too)",
    find: "if(Math.round(r.sellGp*q)===0){under.push(", replace: "if(Math.round(r.sellGp)===0){under.push(",
    mustFail: "two whistles are one line" },
  { label: "a refused line lets the rest of the plan through",
    find: "ok=lines.length>0&&goldAfter>=0&&!under.length;", replace: "ok=lines.length>0&&goldAfter>=0;",
    mustFail: "a lone 3 sp whistle is refused" },
  { label: "the refusal gives no reason",
    find: "var why=under.length?\"the keeper pays nothing for \"+under.join(\", \")+\" — under half a gold piece; mark more of it, or keep it\":", replace: "var why=under.length?\"nothing marked\":",
    mustFail: "a lone 3 sp whistle is refused" }
]}));
