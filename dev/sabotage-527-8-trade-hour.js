// dev/sabotage-527-8-trade-hour.js — proves #527 lead (8) is guarded: the open=close hours, the hours judged at the coin's own
// clock (clockAtOffset, shopOpenNow's minute), and an arrival that is a CHANGE of place.
//   node dev/sabotage-527-8-trade-hour.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#527 (8)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var HOURS = "#527 (8) hours", CLOCK = "#527 (8) the hours are judged", ARRIVE = "#527 (8) a tag naming the place";
prove("helpers.js", [
  { label: "open=close reads as always closed again (the old <= rule back)",
    find: "if(h.open===h.close)return true;/* #527 (8): \"6-6\" opens at six and closes at six the next day — round the clock, never always closed */return (h.open<h.close)?", replace: "return (h.open<=h.close)?",
    mustFail: HOURS },
  { label: "shopOpenNow ignores the minute it is handed (the hours are judged now again)",
    find: "return nodeOpenAtHour(node,Math.floor(clockMinuteOfDay(min==null?undefined:min)/60))!==false;", replace: "return nodeOpenAtHour(node,Math.floor(clockMinuteOfDay()/60))!==false;",
    mustFail: CLOCK },
  { label: "the trade gate judges the hours at the clock now, not at the coin",
    find: "_kOpen=_kName?shopOpenNow(node,_kMin):true;", replace: "_kOpen=_kName?shopOpenNow(node):true;",
    mustFail: CLOCK },
  { label: "a tag naming the current place counts as an arrival again (the room is reset)",
    find: "&&(_e.kind===\"sub\"||(_e.kind===\"world\"&&!_e.twin))&&_eTo!==_eFrom)_arrived=true;", replace: "&&(_e.kind===\"sub\"||(_e.kind===\"world\"&&!_e.twin)))_arrived=true;",
    mustFail: ARRIVE }
]);
prove("clock.js", [
  { label: "clockAtOffset counts the advances AFTER the coin too",
    find: "if(off!=null&&m.index>=off)break;", replace: "",
    mustFail: CLOCK },
  { label: "clockAtOffset counts no advance at all",
    find: "add+=Math.max(0,parseDuration(m[1].trim()));", replace: "add+=0;",
    mustFail: CLOCK }
]);
process.exit(code);
