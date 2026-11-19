// sabotage-777-turn.js — retained proof for audit 2026-11-19 (TODO #777), batch 7: the turn's edges.
//   game.js       U1 whenTurnSettles (Death's arrival, the denouement) · U2 restFromButton · U3 a refusal's replacement is
//                 committed · U8 the check lapse · U12 the folder banner · V1 Car Mode's retry arm
//   helpers.js    C3 checkModField · U13 a null faction · U11 toastLifeMs · ui-shell.js   U6 the console's door, U11
//   item-kinds.js C4 the item's own key · ui-panels.js   U2 the button
// Each clause runs ONE named case of dev/tests-777-turn.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-turn.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  "U1A": "U1: Death's arrival waits for the turn that is still running, then is sent once",
  "U1B": "U1: what a commit schedules is dropped out loud when another campaign is opened first",
  "U2": "U2: the Rest button does nothing while a turn is in flight",
  "U3": "U3: re-rolling a refused turn commits the replacement",
  "U6": "U6, U11: a notice raised under an open modal pops up",
  "U8": "U8, U12, V1: a check lapses only to a story action",
  "U13": "U13: the World State panel survives a null faction entry",
  "C3": "C3: a check's modifier is the field's leading signed number",
  "C4": "C4: an item with a very long name is filed under its own key"
};

prove("game.js", [
  { label: "U1: Death's arrival is scheduled by a bare timer",
    find: "whenTurnSettles(\"Death's arrival\",function(){sendAction(deathArrivalDirective(),{silent:true});});", replace: "setTimeout(function(){sendAction(deathArrivalDirective(),{silent:true});},0);", mustFail: ONLY + T.U1A },
  { label: "U1: a scheduled step does not wait for the turn",
    find: "      if(typeof busy!==\"undefined\"&&busy){\n        if(Date.now()-t0>AFTER_TURN_MAX_MS)", replace: "      if(false){\n        if(Date.now()-t0>AFTER_TURN_MAX_MS)", mustFail: ONLY + T.U1A },
  { label: "U1: a step scheduled in one campaign runs in another",
    find: "      if(mark&&typeof campaignStill===\"function\"&&!campaignStill(mark,what))return;\n", replace: "", mustFail: ONLY + T.U1B },
  { label: "U1: a step that never runs is dropped in silence",
    find: "if(Date.now()-t0>AFTER_TURN_MAX_MS){console.error(", replace: "if(Date.now()-t0>AFTER_TURN_MAX_MS){return;console.error(", mustFail: ONLY + T.U1B },
  { label: "U1: a step waits for ever without a word",
    find: "        if(Date.now()-t0>AFTER_TURN_MAX_MS){", replace: "        if(false){", mustFail: ONLY + T.U1B },
  { label: "U2: the Rest button works in the middle of a turn",
    find: "  if(typeof busy!==\"undefined\"&&busy){if(typeof showToast===\"function\")showToast(\"Finish the current turn first — then rest.\");return;}\n", replace: "", mustFail: ONLY + T.U2 },
  { label: "U3: a refusal's replacement is swapped in with no tags applied",
    find: "    if(_rrLast&&_rrLast.r===\"gm\"&&_rrLast.rf&&!(", replace: "    if(false&&!(", mustFail: ONLY + T.U3 },
  { label: "U3: the replacement counts the turn a second time",
    find: "  if(!o.isOpening&&!o.replacesRefusal){", replace: "  if(!o.isOpening){", mustFail: ONLY + T.U3 },
  { label: "U8: a Table Talk question lapses a pending check",
    find: "  if(!isTT&&worldState.pendingCheck&&!(opts&&opts.silent))checkLapseToAction(txt);", replace: "  if(worldState.pendingCheck&&!(opts&&opts.silent))checkLapseToAction(txt);", mustFail: ONLY + T.U8 },
  { label: "V1: a committed turn arms the car's tap-to-retry",
    find: "carNotify(\"warn\",\"Turn applied, but display failed\");", replace: "carNotify(\"error\",\"Turn applied, but display failed\");", mustFail: ONLY + T.U8 },
  { label: "V1: a failed Table Talk question arms a retry of the last story action",
    find: "carNotify(isTT?\"warn\":\"error\",isTT?\"Question failed\":\"Turn failed — tap to retry\");", replace: "carNotify(\"error\",\"Turn failed — tap to retry\");", mustFail: ONLY + T.U8 },
  { label: "U12: the folder banner can be added twice",
    find: "  if(document.getElementById(\"folder-banner\"))return;", replace: "  ", mustFail: ONLY + T.U8 }
]);
prove("helpers.js", [
  { label: "C3: every digit of the modifier field is glued into one number",
    find: "checkModField(p[1]);for(i=1;", replace: "(parseInt(String(p[1]||\"\").replace(/[^-+\\d]/g,\"\"),10)||0);for(i=1;", mustFail: ONLY + T.C3 },
  { label: "C3: an absurd modifier is kept",
    find: "  return Math.max(-CHECK_MOD_MAX,Math.min(CHECK_MOD_MAX,v));", replace: "  return v;", mustFail: ONLY + T.C3 },
  { label: "U13: a null faction entry throws",
    find: ".filter(function(e){return !!e&&typeof e===\"object\"&&!!e.faction;}):[];/* audit 2026-11-19, U13", replace: ":[];/* audit 2026-11-19, U13", mustFail: ONLY + T.U13 },
  { label: "U11: a Car Mode notice stays until tapped",
    find: "(typeof ms===\"number\"&&ms>0)?ms:(car?CAR_TOAST_MS:0);}", replace: "(typeof ms===\"number\"&&ms>0)?ms:0;}", mustFail: ONLY + T.U6 }
]);
prove("ui-shell.js", [
  { label: "U6: the console's door reads as open under a modal",
    find: "  if(typeof modalTopOpen===\"function\"&&modalTopOpen()&&!document.getElementById(\"console-modal\"))return false;", replace: "  ", mustFail: ONLY + T.U6 },
  { label: "U11: the toast ignores its life",
    find: "  if(_life>0)setTimeout(dismiss,_life);", replace: "  if(typeof ms===\"number\"&&ms>0)setTimeout(dismiss,ms);", mustFail: ONLY + T.U6 }
]);
prove("ui-panels.js", [
  { label: "U2: the panel's button calls the rest directly",
    find: "<button onclick='restFromButton()'", replace: "<button onclick='restSpells()'", mustFail: ONLY + T.U2 }
]);
prove("item-kinds.js", [
  { label: "C4: the answer is filed under the key of the cut name",
    find: "  var key=ownKey||itemBaseName(name);", replace: "  var key=itemBaseName(name);", mustFail: ONLY + T.C4 },
  { label: "C4: the asker does not pass the item's own key",
    find: ",ws.turn,owed[i].key);if(r.ok){", replace: ",ws.turn);if(r.ok){", mustFail: ONLY + T.C4 },
  { label: "C4: the line announces what was asked",
    find: "var _line=itemKindsSaidFiled(_said);if(_line&&", replace: "var _line=itemKindsSaid(owed,read.kinds);if(_line&&", mustFail: ONLY + T.C4 }
]);

process.exit(failed ? 1 : 0);
