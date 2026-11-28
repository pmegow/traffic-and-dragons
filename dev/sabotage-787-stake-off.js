// sabotage-787-stake-off.js - prove the #787 guards are not decorative.
// #787 (owner 2026-11-27): with "Name the stake before a roll" off, the [CHECK:] line does not teach the stake field and
// a stake the GM wrote anyway is dropped. sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-787-stake-off.js
var sabotage=require("./sabotage.js");
var T="#787 with 'Name the stake before a roll' off";
process.exit(sabotage.prove({file:"tag_table.js",command:["node",["dev/run-tests.js","#787 the stake setting off means no stake"]],cases:[
  {label:"#787 the doc teaches the stake field with the setting off",find:"{out.push(tagDocCheckNoStake(TAG_DOC_LINES[i]));continue;}",replace:"{out.push(TAG_DOC_LINES[i]);continue;}",mustFail:T},
  {label:"#787 the whole [CHECK:] line is cut, not the one sentence",find:"return at<0?s:s.slice(0,at)+\"\\n\";}",replace:"return at<0?s:\"\";}",mustFail:T},
  {label:"#787 a stake the GM wrote anyway is still shown",find:"  if(!(typeof diceStakeClause!==\"undefined\"&&diceStakeClause))delete chk.stake;",replace:"  ",mustFail:T},
  {label:"#787 the stake is dropped with the setting ON",find:"  if(!(typeof diceStakeClause!==\"undefined\"&&diceStakeClause))delete chk.stake;",replace:"  delete chk.stake;",mustFail:T}
]}));
