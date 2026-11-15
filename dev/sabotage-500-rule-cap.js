var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
 file:"globals.js",command:["node",["dev/run-tests.js","#500 blueprint rule length"]],
 cases:[
  {label:"old 400-character cap clips the rule",find:"field:4000,rule:6000",replace:"field:4000,rule:400",mustFail:"#500 imported rules preserve 401 through 6000 characters and cap at 6000"},
  {label:"rule cap exceeds owner-requested boundary",find:"field:4000,rule:6000",replace:"field:4000,rule:6001",mustFail:"#500 the campaign prompt preserves the same 6000-character rule boundary"}
 ]
})?1:0);
