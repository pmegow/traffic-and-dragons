// dev/sabotage-481-b6-whereabouts.js — proves the #481 B6 guards are guarded: a resident's whereabouts are said once and
// right ({place, home} through ONE "is at" renderer), a shop closed at the hour holds nobody, a resident in the scene gets
// no whereabouts, and the RESIDENTS note waits while the player travels (the player's own action). Each mutation runs in a
// disposable clone.
//   node dev/sabotage-481-b6-whereabouts.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B6"]];
function prove(file, cases, cmd) { if (!code) code = sabotage.prove({ file: file, command: cmd || CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the renderer joins a name and a place with a bare is again",
    find: "function residentWhereText(name,wh){if(!wh)return \"\";return name+\" is \"+(wh.home?\"at home\":\"at \"+wh.place);}",
    replace: "function residentWhereText(name,wh){if(!wh)return \"\";return name+\" is \"+(wh.home?\"at home\":wh.place);}",
    mustFail: "ONE renderer says" },
  { label: "a shop closed at the hour takes residents again",
    find: "if(nodeOpenAtHour(nd,hour)!==false)return {place:place,home:false};", replace: "if(true)return {place:place,home:false};",
    mustFail: "a shop closed at the hour is nobody" },
  { label: "the recap gives whereabouts for residents in the scene",
    find: "if(w&&!(typeof scenePresentNow===\"function\"&&scenePresentNow(n.name)))about.push(residentWhereText(n.name,w));", replace: "if(w)about.push(residentWhereText(n.name,w));",
    mustFail: "a present resident gets no whereabouts" },
  { label: "the travel parse loses \"head back to\"",
    find: "|head (?:back )?(?:to|for|toward|towards)|travel (?:back )?to|return to", replace: "|travel (?:back )?to|return to",
    mustFail: "waits while the player travels" }
]);
prove("api.js", [
  { label: "the RESIDENTS note fires while the player walks away",
    find: "  if(typeof lastAction!==\"undefined\"&&lastAction&&typeof travelActionTarget===\"function\"&&travelActionTarget(lastAction))return \"\";", replace: "",
    mustFail: "waits while the player travels" }
]);
/* the geo block's OPEN/CLOSED line reads the same predicate; its own tests (#207, the class bible section) pin it */
prove("api.js", [
  { label: "the geo block's hours line leaves the one predicate",
    find: "mn=mins%60,open=nodeOpenAtHour(node,hr);", replace: "mn=mins%60,open=true;",
    mustFail: "midnight at a shop filed 8" }
], ["node", ["dev/run-tests.js", "class bible"]]);
process.exit(code);
