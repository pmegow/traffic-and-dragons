// dev/sabotage-6-village-hall.js — proves the #6 phase C/D/G/H clauses are guarded: the return observer and its note,
// the state recap, the village rung and its alternation with commerce, the resident exchange, roaming by the clock, the
// measure, the fate stamp, the Hall seed and its one key, the close, the player's line, and "the village pays nothing".
// Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-6-village-hall.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#6 the village"]], cases: cases }); }
prove("data.js", [
  { label: "the village never greets a return",
    find: 'returnGreeting:true,villageRung:true,', replace: 'returnGreeting:false,villageRung:true,',
    mustFail: "#6C1 the return is observed" },
  { label: "the village rung is off (the ladder falls through to commerce)",
    find: 'returnGreeting:true,villageRung:true,', replace: 'returnGreeting:true,villageRung:false,',
    mustFail: "#6D1 the village rung sits ABOVE buy" },
  { label: "residents never exchange",
    find: 'residentExchange:true,roam:true,', replace: 'residentExchange:false,roam:true,',
    mustFail: "#6D2 one exchange between two residents" },
  { label: "residents stay home",
    find: 'residentExchange:true,roam:true,', replace: 'residentExchange:true,roam:false,',
    mustFail: "#6D3 residents roam by the clock" },
  { label: "the village has no Hall",
    find: 'hall:true,xp:"none",', replace: 'hall:false,xp:"none",',
    mustFail: "#6G2 the Hall seeds from the library" },
  { label: "the village pays XP like an adventure",
    find: 'hall:true,xp:"none",', replace: 'hall:true,xp:"gm",',
    mustFail: "#6H1 the village pays nothing" },
  { label: "Car Mode recaps a chapter in the village",
    find: 'recap:"state",closable:false,', replace: 'recap:"chapter",closable:false,',
    mustFail: "#6C3 Car Mode speaks STATE" },
  { label: "the village can be closed like an adventure",
    find: 'recap:"state",closable:false,', replace: 'recap:"state",closable:true,',
    mustFail: "#6G4 close this campaign" }
]);
prove("game.js", [
  { label: "the same absence arms the greeting every turn",
    find: 'if(ms<thr||worldState.returnSeenAt===last)return null;', replace: 'if(ms<thr)return null;',
    mustFail: "#6C1 the return is observed" },
  { label: "the change is never chosen from the shelf",
    find: 'if(typeof w.min==="number"&&now-w.min>=win)return w.item+" is gone from "', replace: 'if(false)return w.item+" is gone from "',
    mustFail: "#6C1 the return is observed" },
  { label: "the village rung offers the resident already in the scene",
    find: 'if(!n.resident||npcIsDead(n)||local.indexOf(String(n.name).toLowerCase())>=0)continue;res.push(n);', replace: 'if(!n.resident||npcIsDead(n))continue;res.push(n);',
    mustFail: "#6D1 the village rung sits ABOVE buy" },
  { label: "the village rung always wins, commerce starves",
    find: 'if(_vr&&(!_commerce||(worldState.turn||0)%2===0))return _vr;', replace: 'if(_vr)return _vr;',
    mustFail: "#6D1 the village rung sits ABOVE buy" },
  { label: "the fated resident gets a wall entry too (no memento)",
    find: 'if(s.fate){var obj=', replace: 'if(false){var obj=',
    mustFail: "#6G2 the Hall seeds from the library" },
  { label: "the player's line never reaches the sheet",
    find: 'if(t.length>200)t=t.slice(0,200);n.charSheet.hallLine=t;', replace: 'if(t.length>200)t=t.slice(0,200);',
    mustFail: "#6G5 one player-authored line" },
  { label: "closeCampaign closes an already ended campaign again",
    find: 'if(typeof campaignEnded==="function"&&campaignEnded())return {action:"refused",reason:"already ended"};', replace: '',
    mustFail: "#6G4 close this campaign" },
  { label: "the fate forgets the unresolved threads",
    find: 'sheet.fate={campaign:camp,turn:turn,cause:cause,line:line(sheet.name),unresolved:open.slice(0,3)};', replace: 'sheet.fate={campaign:camp,turn:turn,cause:cause,line:line(sheet.name),unresolved:[]};',
    mustFail: "#6G1 fates are stamped at the ending" },
  { label: "import stops seeding the Hall",
    find: 'if(typeof villageHallSeed==="function"&&kindDef().hall)villageHallSeed();/* #6 G2: the Hall seeds from the library on day one, and re-seeds on every move-in */', replace: '',
    mustFail: "#6G2 the Hall seeds from the library" }
]);
prove("helpers.js", [
  { label: "residents roam at night too",
    find: 'if(hour>=22||hour<6)return "at home";', replace: '',
    mustFail: "#6D3 residents roam by the clock" },
  { label: "a resident never moves through the day",
    find: 'return list[(h+Math.floor(hour/3))%list.length];', replace: 'return list[h%list.length];',
    mustFail: "#6D3 residents roam by the clock" },
  { label: "the recap forgets the house",
    find: 's+=st.length?" Your house holds "', replace: 's+=false?" Your house holds "',
    mustFail: "#6C3 Car Mode speaks STATE" },
  { label: "the close row shows before the first turn",
    find: '&&!campaignEnded()&&(worldState.turn||0)>=1);}', replace: '&&!campaignEnded());}',
    mustFail: "#6G4 close this campaign" }
]);
prove("api.js", [
  { label: "the return note drops the fact",
    find: '+(q.fact?", and let it name ONE fact from the hero\'s own record: \\""+q.fact+"\\"":"")', replace: '',
    mustFail: "#6C2 the greeting reaches the GM" },
  { label: "the exchange asks with one resident",
    find: 'if(res.length<2)return "";', replace: 'if(res.length<1)return "";',
    mustFail: "#6D2 one exchange between two residents" },
  { label: "the exchange never cools down",
    find: 'if(ask&&(worldState.turn-ask.turn)<every)return "";', replace: '',
    mustFail: "#6D2 one exchange between two residents" },
  { label: "residents in the scene are listed as about",
    find: 'if(_local.some(function(x){return String(x).toLowerCase()===_rlow;}))continue;', replace: '',
    mustFail: "#6D3 residents roam by the clock" },
  { label: "the Hall is served everywhere",
    find: '&&_activeKey===locResolve(villageHallKey())){var _hn=memory.map.nodes[_activeKey]||{}', replace: '){var _hn=memory.map.nodes[locResolve(villageHallKey())]||{}',
    mustFail: "#6G3 the Hall reaches the GM only in the Hall" }
]);
prove("tag_table.js", [
  { label: "the village pays XP after all",
    find: 'if(xpTags.length&&typeof kindDef==="function"&&kindDef().xp==="none"){', replace: 'if(false){',
    mustFail: "#6H1 the village pays nothing" },
  { label: "the GM's naming mints a twin Hall",
    find: 'if(_sln!==_hl){R.muts.push("Sub: "+_sln+" → "+_hl+" (the Hall)");_sln=_hl;}', replace: '',
    mustFail: "#6G6 the Hall has ONE key" }
]);
prove("dev/village-measure.js", [
  { label: "the measure never counts a refusal",
    find: 'if(hits)out.refusals+=hits.length;', replace: '',
    mustFail: "#6D4 the refusal count is a measure" }
]);
process.exit(code);
