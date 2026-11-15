// dev/sabotage-759-dice-reveal.js — proves the #759 guards (the dice reveal the roll): what the card shows at each stage,
// the reveal's state, the click's sequence (the turn first, the d20, the damage dice after it), every way a reveal ends
// without dice, and the reply's wait. Each clause runs its own test of dev/tests-759-dice-reveal.js through --only.
//   node dev/sabotage-759-dice-reveal.js
var sabotage = require("./sabotage.js");
var P = "FAIL #759 ", CMD = ["node", ["dev/tests-759-dice-reveal.js"]];
var T1 = P + "the card shows no number while the dice are in the air, the d20 alone once it lands, everything at the end",
  T2 = P + "one reveal at a time: a stale one is refused, the reply waits, and \"all\" lets it through",
  T3 = P + "a hit: the turn is sent at the click, the d20 lands, leaves by itself, the damage dice land, and only then is all shown",
  T4 = P + "a miss and a plain check end when the d20 lands; a damage-only roll ends when its dice land",
  T5 = P + "nothing is ever held for good: no dice, dice that refuse, a d20 dismissed early, and dice that never rest",
  T6 = P + "the wiring: the reply to a roll waits on the reveal before it is committed, and the dice report when they rest";
var api = [
  { label: "the card prints every number while the dice are in the air", find: 'if(!p||stage==="all")return diceTxt(diceTag);', replace: "if(true)return diceTxt(diceTag);", mustFail: T1 },
  { label: "the damage is on the card as soon as the d20 lands", find: 'if(stage==="d20"&&p.length>3)return diceTxt("[DICE:"+p.slice(0,3).join("|")+"]")', replace: 'if(stage==="d20"&&p.length>3)return diceTxt(diceTag)', mustFail: T1 },
  { label: "the landed d20 does not say damage is to come", find: '" &middot; <em class=\\"roll-to-come\\">damage dice to come</em></div>"', replace: '"</div>"', mustFail: T1 },
  { label: "the cast card paints its label unescaped", find: "'+escHtml(p[0])+'</span><em class=\"roll-to-come\">the dice are cast</em>", replace: "'+p[0]+'</span><em class=\"roll-to-come\">the dice are cast</em>", mustFail: T1 }
];
var helpers = [
  { label: "a stale reveal can advance the one in force", find: "if(!rev||rev!==_diceReveal)return false;", replace: "if(!rev)return false;", mustFail: T2 },
  { label: "reaching the end does not let the reply through", find: 'rev.stage=stage;if(stage==="all")diceRevealFinish();return true;', replace: "rev.stage=stage;return true;", mustFail: T2 },
  { label: "a new roll leaves the old reply waiting", find: "function diceRevealBegin(result,live){diceRevealFinish();", replace: "function diceRevealBegin(result,live){", mustFail: T2 },
  { label: "a page with no dice holds the numbers back", find: 'stage:live?"cast":"all",waiters:[]};if(live)_diceReveal=rev;', replace: 'stage:"cast",waiters:[]};_diceReveal=rev;', mustFail: T5 },
  { label: "the wait resolves while a reveal is in force", find: "if(!_diceReveal)done();else _diceReveal.waiters.push(done);", replace: "done();", mustFail: T2 }
];
var game = [
  { label: "the damage dice are thrown with the d20, not after it", find: "autoClose:DICE_DAMAGE_AFTER_MS,onClose:damage})))end();", replace: "autoClose:DICE_DAMAGE_AFTER_MS,onClose:damage})))end();damage();", mustFail: T3 },
  { label: "the landed d20 waits for a click before the damage dice come", find: "autoClose:DICE_DAMAGE_AFTER_MS,onClose:damage", replace: "onClose:damage", mustFail: T3 },
  { label: "the d20 landing ends the reveal of a hit: the damage is shown before its dice", find: 'showDiceRoll(r.roll,{onSettle:function(){if(diceRevealAdvance(rev,"d20"))paint();},', replace: "showDiceRoll(r.roll,{onSettle:end,", mustFail: T3 },
  { label: "the damage dice landing does not end the reveal", find: "showDamageRoll(r.damage.sides,r.damage.faces,{onSettle:end,onClose:end})", replace: "showDamageRoll(r.damage.sides,r.damage.faces,{onClose:end})", mustFail: T3 },
  { label: "a plain check's d20 landing does not end the reveal", find: "showDiceRoll(r.roll,{onSettle:end,onClose:end})))end();return;}", replace: "showDiceRoll(r.roll,{onClose:end})))end();return;}", mustFail: T4 },
  { label: "a damage-only roll throws a d20", find: "if(r.dmgOnly){damage();return;}", replace: "", mustFail: T4 },
  { label: "a page with no dice still waits on them", find: "  if(!live)return;\n", replace: "", mustFail: T5 },
  { label: "dice that refuse to roll leave the reveal open", find: "showDiceRoll(r.roll,{onSettle:end,onClose:end})))end();return;}", replace: "showDiceRoll(r.roll,{onSettle:end,onClose:end})));return;}", mustFail: T5 },
  { label: "damage dice that refuse leave the reveal open", find: "{onSettle:end,onClose:end})))end();}/* a hit's dice", replace: "{onSettle:end,onClose:end})));}/* a hit's dice", mustFail: T5 },
  { label: "dice that never rest are waited on for ever", find: 'if(diceRevealAdvance(rev,"all")){paint();if(typeof console!=="undefined")console.warn(', replace: 'if(false){paint();if(typeof console!=="undefined")console.warn(', mustFail: T5 },
  { label: "the reply to a roll is shown before the dice rest", find: 'if(opts&&opts.silent&&opts.rollTag&&typeof diceRevealWait==="function")await diceRevealWait();', replace: "", mustFail: T6 },
  { label: "the turn waits on the dice before it is sent", find: "  sendAction(r.note,{silent:true,rollTag:r.diceTag});\n  if(!live)return;", replace: "  if(!live){sendAction(r.note,{silent:true,rollTag:r.diceTag});return;}", mustFail: T6 }
];
var dice = [
  { label: "the dice never say they have come to rest", find: 'if(opts&&typeof opts.onSettle==="function")opts.onSettle();if(opts&&opts.autoClose>0)', replace: "if(opts&&opts.autoClose>0)", mustFail: T6 },
  { label: "a roll a newer one took over still reports", find: "if(r&&token===_diceLive.token){if(opts&&typeof opts.onSettle", replace: "if(r){if(opts&&typeof opts.onSettle", mustFail: T6 },
  { label: "a roll that failed to play never settles", find: '{roll:label});if(opts&&typeof opts.onSettle==="function")opts.onSettle();diceLiveClose(token,null);', replace: "{roll:label});diceLiveClose(token,null);", mustFail: T6 },
  { label: "dice that never started never settle", find: 'diceLiveStartFailed(e,{roll:label},true);if(opts&&typeof opts.onSettle==="function")opts.onSettle();', replace: "diceLiveStartFailed(e,{roll:label},true);", mustFail: T6 },
  { label: "a page whose dice failed is still called live", find: 'return diceRollEnv()&&_diceLive.state!=="failed"&&!diceLivePageRefusal();', replace: "return diceRollEnv();", mustFail: T6 }
];
var failed = sabotage.prove({ file: "api.js", command: CMD, only: P, cases: api });
if (!failed) failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: helpers });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "ui-dice.js", command: CMD, only: P, cases: dice });
process.exit(failed ? 1 : 0);
