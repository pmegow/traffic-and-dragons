// sabotage-788-import-level.js - prove the #788 guards are not decorative.
// #788 (owner 2026-11-27): an imported character whose Review level was raised reaches "Assign level perks" instead of
// starting the campaign at its old level. sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-788-import-level.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#788 an imported character raised at Review"]];
var RAISE="#788 sheetRaiseLevel raises a sheet the way a fresh high-level start is built";
var OWED="#788 statBumpsOwed counts only the bump levels past the level the character arrived at";
var WIRED="#788 wiring: the import branch raises the sheet and enters the perk flow before startGame";
rc|=sabotage.prove({file:"helpers.js",command:CMD,cases:[
  {label:"#788 the raise gives no hit points",find:"  c.maxHp=(Number(c.maxHp)||0)+out.hp;c.hp=(Number(c.hp)||0)+out.hp;c.level=to;out.to=to;",replace:"  c.level=to;out.to=to;",mustFail:RAISE},
  {label:"#788 the level is not written",find:"out.hp;c.level=to;out.to=to;",replace:"out.hp;out.to=to;",mustFail:RAISE},
  {label:"#788 a row the sheet holds is added again",find:"if(!has(rows[i].nm)){c.abilities.push({nm:rows[i].nm,ds:rows[i].ds,gained:0});out.gained.push(rows[i].nm);}",replace:"{c.abilities.push({nm:rows[i].nm,ds:rows[i].ds,gained:0});out.gained.push(rows[i].nm);}",mustFail:RAISE},
  {label:"#788 a lower level lowers the sheet",find:"to=parseInt(to,10)||0;if(!c||to<=from)return out;",replace:"to=parseInt(to,10)||0;if(!c||to===from)return out;",mustFail:RAISE},
  {label:"#788 the XP stays under the new level's floor",find:"if(!(Number(c.xp)>=floor))c.xp=floor;",replace:"",mustFail:RAISE},
  {label:"#788 an import is asked for bumps it already took",find:"STAT_BUMP_LEVELS[i]<=level&&STAT_BUMP_LEVELS[i]>(floor||0))n++;",replace:"STAT_BUMP_LEVELS[i]<=level)n++;",mustFail:OWED}
]});
rc|=sabotage.prove({file:"char-creation.js",command:CMD,cases:[
  {label:"#788 the Review level is ignored again - the campaign starts at the old level",find:"    if(_wantL>_fromL){",replace:"    if(false){",mustFail:WIRED},
  {label:"#788 the sheet is not raised before the perk flow",find:"      sheetRaiseLevel(ic,_wantL);\n",replace:"",mustFail:WIRED},
  {label:"#788 the flow forgets what the sheet already has",find:"      pendingBumpFloor=_fromL;pendingArchKept=!!ic.archetype;\n",replace:"",mustFail:WIRED},
  {label:"#788 a wizard character inherits the last import's floor",find:"  pendingBumpFloor=0;pendingArchKept=false;/* #788",replace:"  /* #788",mustFail:WIRED},
  {label:"#788 an import with its archetype is shown the pick again",find:"  if(!archs.length||pendingArchKept||c.level<3){",replace:"  if(!archs.length){",mustFail:WIRED},
  {label:"#788 the archetype path counts every bump for an import",find:"  var bumpsNeeded=statBumpsOwed(c.level,pendingBumpFloor);",replace:"  var bumpsNeeded=statBumpsOwed(c.level,0);",mustFail:WIRED}
]});
process.exit(rc);
