var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
 file:"globals.js",command:["node",["dev/run-tests.js","#500 blueprint rule length"]],
 cases:[
  {label:"old 400-character cap clips the rule",find:"field:800,rule:1200",replace:"field:800,rule:400",mustFail:"#500 imported rules preserve 401 through 1200 characters and cap at 1200"},
  {label:"rule cap exceeds owner-requested boundary",find:"field:800,rule:1200",replace:"field:800,rule:1201",mustFail:"#500 the campaign prompt preserves the same 1200-character rule boundary"}
 ]
})?1:0);
