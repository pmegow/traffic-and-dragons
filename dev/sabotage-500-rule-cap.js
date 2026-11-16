var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
 file:"globals.js",command:["node",["dev/run-tests.js","#500 blueprint rule length"]],
 cases:[
  {label:"previous 6000-character cap clips the rule",find:"field:20000,rule:30000",replace:"field:20000,rule:6000",mustFail:"#500 imported rules preserve 401 through 30000 characters and cap at 30000"},
  {label:"rule cap exceeds owner-requested boundary",find:"field:20000,rule:30000",replace:"field:20000,rule:30001",mustFail:"#500 the campaign prompt preserves the same 30000-character rule boundary"}
 ]
})?1:0);
