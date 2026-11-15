// dev/sabotage-750-stake.js — proves the #750 stake-in-the-roll-modal guards: the [CHECK:] stake field's parse, the modal,
// the note a failed roll carries, the prompt clause per dice contract, the summary line, the story card and the read-aloud.
//   node dev/sabotage-750-stake.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#750"]];
var rc1 = sabotage.prove({
  file: "helpers.js", command: CMD,
  cases: [
    { label: "the modifier's seat is read as a stake",
      find: "if(i<2||!s||parseDamageExpr(s)", replace: "if(!s||parseDamageExpr(s)" },
    { label: "a stake that names a DC moves the DC",
      find: "if(sk){if(!stake)stake=sk;continue;}", replace: "if(sk){if(!stake)stake=sk;}" },
    { label: "one word is taken for a stake",
      find: "||!/[A-Za-z]{2,}\\s+\\S*[A-Za-z]{2,}/.test(s))return null;", replace: ")return null;" },
    { label: "the stake is not capped",
      find: "return s?s.slice(0,CHECK_STAKE_MAX):null;", replace: "return s?s:null;" },
    { label: "the modal paints the stake unescaped",
      find: '</span>"+escHtml(chk.stake)+"</div>"', replace: '</span>"+chk.stake+"</div>"' },
    { label: "the modal never shows the stake",
      find: "+(chk.stake?\"<div id='roll-modal-stake'", replace: "+(false?\"<div id='roll-modal-stake'" },
    { label: "a failed roll's note drops the stake",
      find: "((chk.stake&&!hit)?", replace: "((false)?" },
    { label: "a success is told a stake is owed",
      find: "((chk.stake&&!hit)?", replace: "((chk.stake)?" },
    { label: "the read-aloud tail doubles the full stop",
      find: '(/[.!?]$/.test(chk.stake)?"":".")', replace: '"."' }
  ]
});
var rc2 = sabotage.prove({
  file: "api.js", command: CMD,
  cases: [
    { label: "the player-rolls clause asks for prose, not the field",
      find: '(typeof playerRollsDice!=="undefined"&&playerRollsDice)?" name what failure', replace: '(false)?" name what failure' },
    { label: "the GM-rolls clause asks for a tag field it has no tag for",
      find: '(typeof playerRollsDice!=="undefined"&&playerRollsDice)?" name what failure', replace: '(true)?" name what failure' },
    { label: "the story card paints the stake unescaped",
      find: "' &middot; at stake: '+escHtml(ck.stake)", replace: "' &middot; at stake: '+ck.stake" }
  ]
});
var rc3 = sabotage.prove({
  file: "tag_table.js", command: CMD,
  cases: [
    { label: "the summary line drops the stake",
      find: '+chk.stake:"")/* #750 */', replace: '+"":"")/* #750 */' },
    { label: "the CHECK doc line stops naming the stake field",
      find: "A LAST field of plain words is the STAKE", replace: "A LAST field of plain words is extra" }
  ]
});
var rc4 = sabotage.prove({
  file: "game.js", command: CMD,
  cases: [
    { label: "the read-aloud never hears the stake",
      find: "TTS.speakResponse(clean+_stk,", replace: "TTS.speakResponse(clean," }
  ]
});
process.exit(rc1 || rc2 || rc3 || rc4);
