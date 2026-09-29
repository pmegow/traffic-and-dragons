// dev/sabotage-481-a4-place-sequencer.js — proves the #481 A4 place sequencer is guarded: ONE timeline per applyMutsTable
// call, read in TEXT order, and every node-scoped handler asks it where its own tag happened. Fable's named clause: "placeAt
// returns the end state". Each other clause sends one handler back to the reply's end (or the live pointer) and the matching
// "#481 A4 the place sequencer" test must fail. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-a4-place-sequencer.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 A4"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "placeAt returns the end state (Fable's named clause)",
    find: "R.placeAt=function(off){return R.places?placeStateAt(R.places,off):null;};", replace: "R.placeAt=function(off){return R.places?placeStateAt(R.places,null):null;};",
    mustFail: "place-then-leave files the item" },
  { label: "two moves end at the first",
    find: "fileLocation(e.name,\"\",R.turn,e.fromWorld);endWorld=e.name;", replace: "fileLocation(e.name,\"\",R.turn,e.fromWorld);endWorld=(endWorld===null)?e.name:endWorld;",
    mustFail: "two moves in one reply end at the second" },
  { label: "the moves no longer chain their roads",
    find: "fileLocation(e.name,\"\",R.turn,e.fromWorld);", replace: "fileLocation(e.name,\"\",R.turn);",
    mustFail: "two moves in one reply end at the second" },
  { label: "a sub-location named before a world move files under the new world",
    find: "fileSubLocation(e.raw,R.turn,e.world);", replace: "fileSubLocation(e.raw,R.turn,ev[lastWorld]?ev[lastWorld].name:e.world);",
    mustFail: "belongs to the OLD world" },
  { label: "the hours file where the reply ends (an answered ask lands outside)",
    find: "var key=rPlaceAt(R,lh.index).key;", replace: "var key=rPlaceAt(R,null).key;",
    mustFail: "a pending hours ask keeps answering to its own node" },
  { label: "the hours file where the reply began (table order again: the settlement gets the shop's hours)",
    find: "var key=rPlaceAt(R,lh.index).key;", replace: "var key=rPlaceAt(R,-1).key;",
    mustFail: "arrive-then-hours files on the shop" },
  { label: "the item files where the reply ends",
    find: "fileLocationItem(_lnm,_lact,R.turn,_lplace,_lroom,rPlaceAt(R,liOff[lii]));", replace: "fileLocationItem(_lnm,_lact,R.turn,_lplace,_lroom);",
    mustFail: "place-then-leave files the item" },
  { label: "the fight anchors where the reply ends",
    find: "node:rPlaceAt(R,csOff[csi]).key};", replace: "node:rPlaceAt(R,null).key};",
    mustFail: "fight-then-ride anchors the aftermath" },
  { label: "the gain takes from where the party stood before the reply",
    find: "autoTakeLocationItem(igq.base,null,igq.n,rPlaceAt(R,igOff[igi]).key)", replace: "autoTakeLocationItem(igq.base,null,igq.n,null)",
    mustFail: "arrive-then-take takes from where the hero arrived" },
  { label: "wares file where the reply ends",
    find: "_wat=rPlaceAt(R,wtOff[wi]);", replace: "_wat=rPlaceAt(R,null);",
    mustFail: "wares and a state note filed before a leave" },
  { label: "a state note files where the reply ends",
    find: "fileLocationState(lsm[1].trim(),R.turn,rPlaceAt(R,lsOff[lsi]))", replace: "fileLocationState(lsm[1].trim(),R.turn,rPlaceAt(R,null))",
    mustFail: "wares and a state note filed before a leave" }
]);
prove("helpers.js", [
  { label: "the trade gate judges the reply's end",
    find: "_st=placeStateAt(_tl,_go>=0?_go:null)", replace: "_st=placeStateAt(_tl,null)",
    mustFail: "pay-then-leave lands" }
]);
prove("identity.js", [
  { label: "the timeline mints the places it reads",
    find: "  if(world)world=locResolve(world);\n", replace: "  if(world)world=locResolve(world);if(typeof fileSubLocation===\"function\"&&/SUBLOCATION:/.test(String(text)))fileSubLocation(\"minted by the timeline\",0);\n",
    mustFail: "the timeline is pure" },
  { label: "a leave keeps the sub-location",
    find: "    else{ev.kind=\"leave\";sub=null;}", replace: "    else{ev.kind=\"leave\";}",
    mustFail: "pay-then-leave lands" }
]);
process.exit(code);
