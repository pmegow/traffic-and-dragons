// sabotage-791-roll-echo.js - prove the #791 guards are not decorative.
// #791 (owner 2026-11-27): the reply to a player's roll repeated the roll's own [DICE:] record, so its card printed twice.
// sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-791-roll-echo.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#791 the roll card is shown once"]];
var FIELD="#791 the FIELD reply: the GM repeats the roll's own [DICE:] record";
var WIRED="#791 wiring: sendAction takes the echo out before the roll's record is put in front";
rc|=sabotage.prove({file:"helpers.js",command:CMD,cases:[
  {label:"#791 the echo stays - the card prints twice again",find:"if(lab.trim().toLowerCase()!==label)return tag;out.dropped++;return \"\";",replace:"return tag;",mustFail:FIELD},
  {label:"#791 every [DICE:] in the reply is dropped - a foe's save loses its card",find:"if(lab.trim().toLowerCase()!==label)return tag;out.dropped++;return \"\";",replace:"out.dropped++;return \"\";",mustFail:FIELD},
  {label:"#791 the label is matched case-sensitively",find:"  var label=m[1].trim().toLowerCase();if(!label)return out;",replace:"  var label=m[1].trim();if(!label)return out;",mustFail:FIELD}
]});
rc|=sabotage.prove({file:"game.js",command:CMD,cases:[
  {label:"#791 sendAction no longer takes the echo out",find:"var _re=rollEchoDrop(resp,opts.rollTag);if(_re.dropped){resp=_re.text;",replace:"var _re={dropped:0};if(_re.dropped){resp=_re.text;",mustFail:WIRED}
]});
process.exit(rc);
