// dev/sabotage-quartet-ledger.js — proves the ledger quartet (#511 #517 #518 #519, Astra's verification fixtures of
// 2026-10-02) is guarded: each side of the counter rounds on its own, plural coin words keep their unit, a gift is
// bounded by its loss half, the spoken undo refuses after a hero swap, and a same-world footer after an arrival is
// no move. Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-quartet-ledger.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "the ledger quartet"]], cases: cases }); }
prove("helpers.js", [
  { label: "#517 ① → #598 the net is rounded to whole gold again (the whistles are given away)",
    find: "  var netCp=buyCp-sellCp,coinAfter=cat.coin-netCp,ok=lines.length>0&&coinAfter>=0;", replace: "  var netCp=Math.round((buyCp-sellCp)/100)*100,coinAfter=cat.coin-netCp,ok=lines.length>0&&coinAfter>=0;",
    mustFail: "#517 ① → #598 a sale bundled" },
  { label: "#517 ② the plural coin word fails the boundary again ('3 coppers' reads as 3 gp)",
    find: "(gp|sp|cp|pp|gold|silver|copper|platinum)s?(?![a-z])", replace: "(gp|sp|cp|pp|gold|silver|copper|platinum)(?![a-z])",
    mustFail: "#517 ② plural coin words" }
]);
prove("tag_table.js", [
  { label: "#518 the gift is no longer bounded by what left the pack",
    find: "if(_gHits!==null&&_gHits<cIq.n){", replace: "if(false){",
    mustFail: "#518 a gift bounded" },
  { label: "#518 the cut is applied but not said",
    find: "{R.muts.push(\"⚠ Gift of \"", replace: "{void(\"⚠ Gift of \"",
    mustFail: "#518 a gift bounded" },
  { label: "#511 a re-stated world still counts as the last arrival (the tavern becomes passed-through)",
    find: "&&!ev[i].twin&&!ev[i].restate)lastWorld=i;", replace: "&&!ev[i].twin)lastWorld=i;",
    mustFail: "#511 a same-world footer" }
]);
prove("identity.js", [
  { label: "#511 the timeline never marks a re-statement (the footer clears the sub-location again)",
    find: "else if(nm===world&&subSeen)ev.restate=true;", replace: "else if(false)ev.restate=true;",
    mustFail: "#511 a same-world footer" },
  { label: "#511 a lone same-world footer with no arrival before it is treated as a re-statement too (the old reading is lost)",
    find: "else if(nm===world&&subSeen)ev.restate=true;", replace: "else if(nm===world)ev.restate=true;",
    mustFail: "#511 a same-world footer" }
]);
prove("game.js", [
  { label: "#519 the undo no longer refuses when the recorded actor is neither hero nor companion",
    find: "if(e.pack&&e.by&&e.by!==hero&&!(typeof findCompanionChar===\"function\"&&findCompanionChar(e.by)))return", replace: "if(false)return",
    mustFail: "#519 the spoken undo" },
  { label: "#519 the refusal no longer names who the item belonged to",
    find: "reason:e.by+\" is no longer the hero or in the party — \"+e.name+\" stays \"+(e.action===\"placed\"?\"in \"+leaf:\"where it is\")+\" until \"+e.by+\" plays again\"",
    replace: "reason:\"the one who moved it is no longer the hero or in the party — \"+e.name+\" stays \"+(e.action===\"placed\"?\"in \"+leaf:\"where it is\")",
    mustFail: "#519 the spoken undo" }
]);
process.exit(code);
