// sabotage-793-roll-once.js - prove the #793 guards are not decorative.
// #793 (owner 2026-11-28): the card that asked for a roll becomes its result, and the reply drew the result again under it.
// sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-793-roll-once.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#793 the roll result is on the page once"]];
var PURE="#793 when the roll's own card already shows the result, the reply is painted without its copy";
var WIRED="#793 wiring: the roll's card is remembered when it is put on the page";
rc|=sabotage.prove({file:"helpers.js",command:CMD,cases:[
  {label:"#793 the reply always paints its copy - the result shows twice again",find:"  return diceTxt(rollEchoDrop(resp,rollTag).text);",replace:"  return diceTxt(resp);",mustFail:PURE},
  {label:"#793 the copy is left out with no card above - the result shows nowhere",find:"  if(!above||!rollTag)return diceTxt(resp);",replace:"  if(!rollTag)return diceTxt(resp);",mustFail:PURE}
]});
rc|=sabotage.prove({file:"game.js",command:CMD,cases:[
  {label:"#793 the roll's card is not remembered",find:"paint();_rollReveal={tag:r.diceTag,el:holder};}}",replace:"paint();}}",mustFail:WIRED},
  {label:"#793 the commit is not told which roll the reply answers",find:"      _rollReply=(opts&&opts.rollTag)||null;",replace:"      ",mustFail:WIRED},
  {label:"#793 any earlier roll's card counts - a roll with no card of its own loses its result",find:"_rollReveal&&_rollReveal.tag===_rollFor&&_rollReveal.el&&",replace:"_rollReveal&&_rollReveal.el&&",mustFail:WIRED},
  {label:"#793 the reply is painted with every card",find:"  if(_rollUp)dice=rollReplyDiceHtml(resp,_rollFor,true);",replace:"  ",mustFail:WIRED}
]});
rc|=sabotage.prove({file:"game.js",command:CMD,cases:[
  {label:"#793 the roll is not cleared - a later reply to nothing is painted as a roll's",find:"  var _rollFor=_rollReply;_rollReply=null;",replace:"  var _rollFor=_rollReply;",mustFail:WIRED}
]});
process.exit(rc);
