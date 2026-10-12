// dev/sabotage-481-d7-sale-floor.js — #481 D7 ruled a floor under a sale worth less than half a gold piece; #598 (owner ruling
// 2026-10-03) put the purse in copper, so the floor is gone and this battery proves what replaced it: a 3 sp sale pays 3 sp,
// exactly, in silver. Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-481-d7-sale-floor.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#481 D7"]], cases: cases }); }
prove("helpers.js", [
  { label: "the sale side is rounded to whole gold again (a 3 sp whistle sells for nothing)",
    find: "lines.push(sl);sellCp+=sl.cp;}", replace: "lines.push(sl);sellCp+=Math.round(sl.cp/100)*100;}",/* #577 re-anchor: the sell line is built as `sl` (it carries the want's identity); acceptance 2026-10-12 re-anchor: the total sums the line's own cp (a wanted line is priced by wantedPayCp) */
    mustFail: "a lone 3 sp whistle sells for 3 sp" },
  { label: "a line under a gold piece is dropped from the plan",
    find: "var q=ms[k]|0;if(q<=0||r.equipped||r.sellCp==null)continue;", replace: "var q=ms[k]|0;if(q<=0||r.equipped||r.sellCp==null||r.sellCp*q<100)continue;",
    mustFail: "a lone 3 sp whistle sells for 3 sp" }
]);
prove("game.js", [
  { label: "the purse moves in whole gold (the copper of a sale is lost)",
    find: "  if(net){c.coin=(Number(c.coin)||0)-net;", replace: "  if(net){c.coin=(Number(c.coin)||0)-Math.round(net/100)*100;",
    mustFail: "a mixed plan with a tiny line lands whole" }
]);
process.exit(code);
