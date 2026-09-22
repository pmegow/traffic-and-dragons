// dev/sabotage-431-here-line.js — proves the #431 guards are guarded: the here line reads the CURRENT node (not the
// hero's house), excludes taken/emptied rows; mutsSummaryEmit appends the here line to the displayed line only and
// never into R.muts; commitGmTurn's path cannot bypass the one writer; the panel cannot grow its house group back.
// Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-431-here-line.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#431 here"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the here line lists rows the party took or emptied",
    find: 'if(!it||!it.name||it.taken||it.qty===0)continue;', replace: 'if(!it||!it.name)continue;',
    mustFail: "hereItemsLine" },
  { label: "the here line reads the hero's house instead of the current node",
    find: '  var key=(typeof currentNodeKey==="function")?currentNodeKey():null;if(!key)return "";\n  var rk=(typeof locResolve==="function")?locResolve(key):key,node=memory.map.nodes[rk];',
    replace: '  var key=(typeof villageHouseKey==="function"&&worldState.character)?villageHouseKey(worldState.character.name):null;if(!key)return "";\n  var rk=key,node=memory.map.nodes[rk];',
    mustFail: "hereItemsLine" }
]);
prove("tag_table.js", [
  { label: "the here line is written into R.muts (the provenance ring and every caller would see it)",
    find: 'var lines=(R&&R.muts)?R.muts.slice():[],here=', replace: 'var lines=(R&&R.muts)?R.muts:[],here=',
    mustFail: "mutsSummaryEmit appends" },
  { label: "the summary drops the here line",
    find: '  if(here)lines.push(here);\n', replace: '',
    mustFail: "mutsSummaryEmit appends" }
]);
prove("api.js", [
  { label: "commitGmTurn joins the summary line itself again, bypassing the one writer",
    find: 'mutsSummaryEmit(R);/* #431: the one writer of the turn\'s summary line (tag_table.js) — appends the HERE readout */',
    replace: 'if(R.muts.length)addMsg("system",escHtml(R.muts.join(" | ")));',
    mustFail: "#431 source" }
]);
prove("ui-panels.js", [
  { label: "the panel grows its house group back",
    find: '     the rows that DO something: the counter, the chest, the design surface. */\n',
    replace: '     the rows that DO something: the counter, the chest, the design surface. */\n  var hg=(typeof villageHouseGroup==="function")?villageHouseGroup():null;\n',
    mustFail: "#431 source" }
]);
process.exit(code);
