// dev/sabotage-767-no-narration-before-roll.js — proves the #767 guards: the GM's rule (a roll the player's own action
// needs carries no narration), the roll's answer, which rolls hold their prose, the hold at the commit (page and reader),
// the three reveals, and the reload. Each clause runs its own test through --only.
//   node dev/sabotage-767-no-narration-before-roll.js
var sabotage = require("./sabotage.js");
var P = "FAIL #767 ", CMD = ["node", ["dev/tests-767-no-narration-before-roll.js"]];
var T1 = P + "the GM is told: a roll the player's own action needs is the tag and nothing else; a forced save keeps its cause",
  T2 = P + "the roll's answer asks for the attempt and its outcome as one moment",
  T3 = P + "which rolls hold their prose: the hero's own attempts, never a save the world forces",
  T4 = P + "a reply that asks for the hero's roll shows the die and holds its prose off the page and out of the reader",
  T5 = P + "a forced save, a reply with no roll, and a drive are not held",
  T6 = P + "held prose is shown when the dice rest, on Hold back, and when the next turn lands",
  T7 = P + "a reload holds the prose of a waiting roll, and the page knows how to hide it";
var helpers = [
  { label: "a forced save hides its cause", find: "&&!CHECK_SAVE_RE.test(chk.label));}", replace: ");}", mustFail: T3 },
  { label: "\"saving throw\" is not read as a save", find: "var CHECK_SAVE_RE=/\\bsav(?:e|es|ing)\\b/i;", replace: "var CHECK_SAVE_RE=/\\bsave\\b/i;", mustFail: T3 },
  { label: "held prose is drawn like any other", find: "return held?'<div class=\"pre-roll pre-roll-held\">'+p+\"</div>\":p;}", replace: "return p;}", mustFail: T3 },
  { label: "the roll's answer asks for the outcome alone", find: " Narrate the attempt and its outcome now, as one moment", replace: " Narrate the outcome of that check now", mustFail: T2 }
];
var api = [
  { label: "the rule is not in the prompt", find: "the player's roll arrives in the next message.\"+CHECK_NO_NARRATION+\" For an effect", replace: "the player's roll arrives in the next message. For an effect", mustFail: T1 },
  { label: "the rule forgets the forced save", find: " Only a saving throw the world forces on the hero (a trap, a foe's spell) is led by the prose that causes it, stopped at the instant before the outcome.", replace: "", mustFail: T1 },
  { label: "the rule does not say where the attempt is narrated", find: " Narrate the attempt and its outcome together in your reply to the roll.", replace: "", mustFail: T1 }
];
var game = [
  { label: "the commit never holds", find: "var _held=!_refusal&&/\\[CHECK:/.test(String(resp))&&checkHoldsProse(worldState.pendingCheck);", replace: "var _held=false;", mustFail: T4 },
  { label: "held prose is read out", find: 'speakNarration(_heldSpeech?"":clean,_heldSpeech?null:_spMap);', replace: "speakNarration(clean,_spMap);", mustFail: T4 },
  { label: "a drive loses its narration", find: 'var _heldSpeech=_held&&!(typeof carMode!=="undefined"&&carMode);', replace: "var _heldSpeech=_held;", mustFail: T5 },
  { label: "Hold back leaves the prose hidden", find: "delete worldState.pendingCheck;preRollReveal();", replace: "delete worldState.pendingCheck;", mustFail: T6 },
  { label: "the next turn leaves the prose hidden", find: "  preRollReveal(narEl);", replace: "", mustFail: T6 },
  { label: "a new turn shows its own held prose at once", find: 'if(except&&typeof except.contains==="function"&&except.contains(els[i]))continue;', replace: "", mustFail: T6 },
  { label: "the roll never shows the prose", find: "  diceRevealWait().then(function(){preRollReveal();});", replace: "", mustFail: T6 },
  { label: "the reveal changes nothing", find: 'els[i].className="pre-roll";n++;', replace: "n++;", mustFail: T6 }
];
var boot = [{ label: "a reload shows the held prose", find: "preRollProseHtml(e.x,i===tr.length-1&&checkHoldsProse(worldState.pendingCheck))", replace: "preRollProseHtml(e.x,false)", mustFail: T7 }];
var page = [{ label: "the held state is not hidden", find: ".pre-roll-held{display:none;}", replace: ".pre-roll-held{}", mustFail: T7 }];
var failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: helpers });
if (!failed) failed = sabotage.prove({ file: "api.js", command: CMD, only: P, cases: api });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "ui-boot.js", command: CMD, only: P, cases: boot });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
process.exit(failed ? 1 : 0);
