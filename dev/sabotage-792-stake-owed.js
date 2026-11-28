// sabotage-792-stake-owed.js - prove the #792 guards are not decorative.
// #792 (owner 2026-11-28): with "Name the stake before a roll" on, a [CHECK:] that named no stake is reminded on its roll
// result. sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-792-stake-owed.js
var sabotage=require("./sabotage.js");
var T="#792 the FIELD case: with the setting on, a [CHECK:] that named no stake gets the reminder";
process.exit(sabotage.prove({file:"helpers.js",command:["node",["dev/run-tests.js","#792 a stake the GM left out is asked for"]],cases:[
  {label:"#792 the reminder never rides the result",find:"do not emit another [DICE:] for it.\"+checkStakeOwedText(chk)+\"]\";",replace:"do not emit another [DICE:] for it.]\";",mustFail:T},
  {label:"#792 a check that named its stake is reminded anyway",find:"||!chk||chk.stake)return \"\";",replace:"||!chk)return \"\";",mustFail:T},
  {label:"#792 the reminder rides with the setting off",find:"  if(!(typeof diceStakeClause!==\"undefined\"&&diceStakeClause)||!chk||chk.stake",replace:"  if(!chk||chk.stake",mustFail:T}
]}));
