// dev/sabotage-754-damage-only.js — proves the #754 guards (the damage-only roll: an effect the targets save against has
// no d20 of the hero's): the parse, the result and its note, the modal, the summary line, the story cards, the click, the
// ready die, and the two prompt lines. Each clause runs its own test of dev/tests-754-damage-only.js through --only.
//   node dev/sabotage-754-damage-only.js
var sabotage = require("./sabotage.js");
var P = "FAIL #754 ", CMD = ["node", ["dev/tests-754-damage-only.js"]];
var T1 = P + "dice where the modifier sits and no DC is a damage-only roll; every older shape is still a d20",
  T2 = P + "the result is the damage alone: no face, outcome \"damage\", a note that leaves the saves to the GM",
  T3 = P + "the turn: the tag arms it, the modal and the card show the dice and no d20, the click files the damage and plays the damage dice",
  T4 = P + "the GM is taught the form only while the player rolls, on the MECHANICS line and the tag's doc line";
var helpers = [
  { label: "a modifier then dice is taken for damage only", find: "dmgOnly:!!(dmg&&dc===null&&parseDamageExpr(p[1]))", replace: "dmgOnly:!!(dmg&&dc===null)", mustFail: T1 },
  { label: "an attack with a DC is taken for damage only", find: "dmgOnly:!!(dmg&&dc===null&&parseDamageExpr(p[1]))", replace: "dmgOnly:!!(dmg&&parseDamageExpr(p[1]))", mustFail: T1 },
  { label: "a damage-only check is resolved as a d20", find: "if(chk&&chk.dmgOnly&&chk.dmg)return resolveDamageOnly(chk,faces);", replace: "", mustFail: T2 },
  { label: "the record calls the damage a success", find: 'outcome:"damage",dmgOnly:true', replace: 'outcome:"success",dmgOnly:true', mustFail: T2 },
  { label: "the note no longer leaves the saves to the GM", find: "This is the damage BEFORE any saving throw: roll each target's save yourself, ", replace: "", mustFail: T2 },
  { label: "the modal shows a d20 for a damage-only roll", find: 'only?chk.dmg.text+" damage":"d20"', replace: 'false?chk.dmg.text+" damage":"d20"', mustFail: T3 },
  { label: "the modal still says \"on a hit\"", find: "chk.dmg&&chk.dmg.text&&!only?", replace: "chk.dmg&&chk.dmg.text?", mustFail: T3 }
];
var tags = [
  { label: "the summary line says d20", find: '(chk.dmgOnly?chk.dmg.text+" damage"/* #754 */:"d20"', replace: '(false?chk.dmg.text+" damage"/* #754 */:"d20"', mustFail: T3 },
  { label: "the doc line stops teaching the form", find: "emit the damage dice alone, no modifier and no DC", replace: "emit the dice", mustFail: T4 }
];
var prompt = [
  { label: "the story card shows a d20", find: "(ck.dmgOnly?ck.dmg.text+' damage'/* #754 */:'d20'", replace: "(false?ck.dmg.text+' damage'/* #754 */:'d20'", mustFail: T3 },
  { label: "a lapsed damage-only check reads as a d20", find: "(ck.dmgOnly?ck.dmg.text:'d20')+' &middot; unrolled", replace: "('d20')+' &middot; unrolled", mustFail: T3 },
  { label: "the rolled card prints the damage as a d20", find: "if(dm)return escHtml(dm[1])+'<strong>'+dm[2]+'</strong>';", replace: "", mustFail: T3 },
  { label: "the MECHANICS line stops teaching the form", find: "emit the damage dice ALONE", replace: "emit the dice", mustFail: T4 }
];
var game = [
  { label: "the click throws a d20 that was never rolled", find: 'if(r.dmgOnly){if(typeof showDamageRoll==="function")showDamageRoll(r.damage.sides,r.damage.faces);}', replace: "if(false){}", mustFail: T3 }
];
var modal = [
  { label: "a d20 lies ready under a damage-only modal", find: 'if(!chk.dmgOnly&&typeof diceLivePresent==="function")', replace: 'if(typeof diceLivePresent==="function")', mustFail: T3 }
];
var failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: helpers });
if (!failed) failed = sabotage.prove({ file: "tag_table.js", command: CMD, only: P, cases: tags });
if (!failed) failed = sabotage.prove({ file: "api.js", command: CMD, only: P, cases: prompt });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "ui-modals.js", command: CMD, only: P, cases: modal });
process.exit(failed ? 1 : 0);
