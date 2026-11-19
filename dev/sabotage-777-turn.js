// sabotage-777-turn.js — retained proof for audit 2026-11-19 (TODO #777), batch 7: the turn's edges.
//   game.js       U1 whenTurnSettles (Death's arrival, the denouement; owed on the save, counted in polls, the send
//                 held) · U2 restFromButton · U8 the check lapse · U12 the folder banner · V1 Car Mode's retry arm
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
  "U1C": "U1: while a step is owed the player's own send waits",
  "U6": "U6, U11: a notice raised under an open modal pops up",
  "U8": "U8, U12, V1: a check lapses only to a story action",
  "U13": "U13: the World State panel survives a null faction entry",
  "C3": "C3: a check's modifier is the field's leading signed number",
  "C4": "C4: an item with a very long name is filed under its own key"
};

prove("game.js", [
  { label: "U1: Death's arrival is scheduled by a bare timer",
    find: "whenTurnSettles(\"Death's arrival\",deathArrivalSend);\n}", replace: "setTimeout(deathArrivalSend,0);\n}", mustFail: ONLY + T.U1A },
  { label: "U1: a scheduled step does not wait for the turn",
    find: "      if(typeof busy!==\"undefined\"&&busy){\n        if(++ticks", replace: "      if(false){\n        if(++ticks", mustFail: ONLY + T.U1A },
  { label: "U1 review: the arrival is not owed on the save",
    find: "  worldState.deathScene.arrivalOwed=true;", replace: "  ", mustFail: ONLY + T.U1A },
  { label: "U1 review: a load re-arms an arrival that is already in the book",
    find: "function deathArrivalRearm(){if(worldState&&worldState.deathScene&&worldState.deathScene.arrivalOwed&&typeof document", replace: "function deathArrivalRearm(){if(worldState&&worldState.deathScene&&typeof document", mustFail: ONLY + T.U1A },
  { label: "U1 review: a second armed step sends the arrival again",
    find: "function deathArrivalSend(){if(worldState&&worldState.deathScene&&worldState.deathScene.arrivalOwed)sendAction(", replace: "function deathArrivalSend(){sendAction(", mustFail: ONLY + T.U1A },
  { label: "U1 review: the arrival's commit leaves it owed",
    find: "      if(opts&&opts.deathArrival&&worldState.deathScene)delete worldState.deathScene.arrivalOwed;", replace: "      ", mustFail: ONLY + T.U1A },
  { label: "U1 review: the give-up is counted on the wall clock",
    find: "ticks=0;_turnSettleOwed++;\n  (function tick(){\n    setTimeout(function(){\n      if(typeof busy!==\"undefined\"&&busy){\n        if(++ticks*AFTER_TURN_POLL_MS>", replace: "ticks=0,t0=Date.now();_turnSettleOwed++;\n  (function tick(){\n    setTimeout(function(){\n      if(typeof busy!==\"undefined\"&&busy){\n        if(Date.now()-t0>", mustFail: ONLY + T.U1C },
  { label: "U1 review: a step is never counted as owed",
    find: "ticks=0;_turnSettleOwed++;", replace: "ticks=0;", mustFail: ONLY + T.U1C },
  { label: "U1 review: a step that ran stays owed",
    find: "      _turnSettleOwed--;\n      if(mark&&", replace: "      if(mark&&", mustFail: ONLY + T.U1C },
  { label: "U1 review: the player's send goes out before the owed step",
    find: "  if(!(opts&&opts.silent)&&typeof turnSettleOwed===\"function\"&&turnSettleOwed()){", replace: "  if(false){", mustFail: ONLY + T.U1C },
  { label: "U1: a step scheduled in one campaign runs in another",
    find: "      if(mark&&typeof campaignStill===\"function\"&&!campaignStill(mark,what))return;\n", replace: "", mustFail: ONLY + T.U1B },
  { label: "U1: a step that never runs is dropped in silence",
    find: ">AFTER_TURN_MAX_MS){_turnSettleOwed--;console.error(", replace: ">AFTER_TURN_MAX_MS){_turnSettleOwed--;return;console.error(", mustFail: ONLY + T.U1B },
  { label: "U1: a step waits for ever without a word",
    find: "        if(++ticks*AFTER_TURN_POLL_MS>AFTER_TURN_MAX_MS){", replace: "        if(false){", mustFail: ONLY + T.U1B },
  { label: "U2: the Rest button works in the middle of a turn",
    find: "  if(typeof busy!==\"undefined\"&&busy){if(typeof showToast===\"function\")showToast(\"Finish the current turn first — then rest.\");return;}\n", replace: "", mustFail: ONLY + T.U2 },
  { label: "U8: a Table Talk question lapses a pending check",
    find: "  if(!isTT&&worldState.pendingCheck&&!(opts&&opts.silent))checkLapseToAction(txt);", replace: "  if(worldState.pendingCheck&&!(opts&&opts.silent))checkLapseToAction(txt);", mustFail: ONLY + T.U8 },
  { label: "V1: a committed turn arms the car's tap-to-retry",
    find: "carNotify(\"say\",\"The turn was applied, but it could not be shown.\");", replace: "carNotify(\"error\",\"The turn was applied, but it could not be shown.\");", mustFail: ONLY + T.U8 },
  { label: "V1: a failed Table Talk question arms a retry of the last story action",
    find: "carNotify(isTT?\"warn\":\"error\",isTT?\"Question failed\":\"Turn failed — tap to retry\");", replace: "carNotify(\"error\",\"Turn failed — tap to retry\");", mustFail: ONLY + T.U8 },
  { label: "V1 review: a committed opening arms the car's tap-to-retry",
    find: "carNotify(\"say\",\"The opening could not be shown. Reload to continue.\");", replace: "carNotify(\"error\",\"The opening could not be shown. Reload to continue.\");", mustFail: ONLY + T.U8 },
  { label: "U12: the folder banner can be added twice",
    find: "  if(document.getElementById(\"folder-banner\"))return;", replace: "  ", mustFail: ONLY + T.U8 }
]);
prove("helpers.js", [
  { label: "C3: every digit of the modifier field is glued into one number",
    find: "checkModField(p[1]);for(i=1;", replace: "(parseInt(String(p[1]||\"\").replace(/[^-+\\d]/g,\"\"),10)||0);for(i=1;", mustFail: ONLY + T.C3 },
  { label: "C3: an absurd modifier is kept",
    find: "return isFinite(v)?Math.max(-CHECK_MOD_MAX,Math.min(CHECK_MOD_MAX,v)):0;}", replace: "return isFinite(v)?v:0;}", mustFail: ONLY + T.C3 },
  { label: "C3 review: the engine's own minus sign is no sign",
    find: ".replace(/[\\u2212\\u2013\\u2014]/g,\"-\").trim(),m;", replace: ".trim(),m;", mustFail: ONLY + T.C3 },
  { label: "C3 review: a DC in the modifier's seat is the modifier",
    find: "  if(!s||/^dc\\b/i.test(s))return 0;", replace: "  if(!s)return 0;", mustFail: ONLY + T.C3 },
  { label: "C3 review: the number after the dice is not read",
    find: "if(m)return m[2]?val(m[1],m[2]):0;", replace: "", mustFail: ONLY + T.C3 },
  { label: "C3 review: a lone number after a word is not read",
    find: "  if(nums.length===1){m=s.match(/([+-])?\\s*(\\d+)/);return val(m[1],m[2]);}\n", replace: "", mustFail: ONLY + T.C3 },
  { label: "U13: a null faction entry throws",
    find: ".filter(function(e){return !!e&&typeof e===\"object\"&&!!e.faction;}):[];/* audit 2026-11-19, U13", replace: ":[];/* audit 2026-11-19, U13", mustFail: ONLY + T.U13 },
  { label: "U11 review: an unread line is not counted as new",
    find: "  if(!e.popped||unread)_consoleNew++;", replace: "  if(!e.popped)_consoleNew++;", mustFail: ONLY + T.U6 },
  { label: "U11: a Car Mode notice stays until tapped",
    find: "(typeof ms===\"number\"&&ms>0)?ms:(car?CAR_TOAST_MS:0);}", replace: "(typeof ms===\"number\"&&ms>0)?ms:0;}", mustFail: ONLY + T.U6 }
]);
prove("ui-shell.js", [
  { label: "U6: the console's door reads as open under a modal",
    find: "  if(typeof modalTopOpen===\"function\"&&modalTopOpen()&&!document.getElementById(\"console-modal\"))return false;", replace: "  ", mustFail: ONLY + T.U6 },
  { label: "U11 review: a notice that faded in Car Mode is not marked new",
    find: "var _carFades=_pops&&typeof carMode!==\"undefined\"&&!!carMode;", replace: "var _carFades=false;", mustFail: ONLY + T.U6 },
  { label: "U11 review: the Console's dot is not painted for it",
    find: "  if(_carFades)consoleDotPaint();\n", replace: "", mustFail: ONLY + T.U6 },
  { label: "U11: the toast ignores its life",
    find: "  if(_life>0)setTimeout(dismiss,_life);", replace: "  if(typeof ms===\"number\"&&ms>0)setTimeout(dismiss,ms);", mustFail: ONLY + T.U6 }
]);
prove("ui-panels.js", [
  { label: "U2: the panel's button calls the rest directly",
    find: "<button onclick='restFromButton()'", replace: "<button onclick='restSpells()'", mustFail: ONLY + T.U2 }
]);
prove("ui-boot.js", [
  { label: "U1 review: the load never re-arms an owed arrival",
    find: "    if(typeof deathArrivalRearm===\"function\")deathArrivalRearm();", replace: "    ", mustFail: ONLY + T.U1A }
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
