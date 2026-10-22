// dev/sabotage-654-damage-roll.js — proves the #654 guards (the damage roll on a hit): the damage grammar (never a
// d20), the modifier seat read as dice, the fourth field in any position, a miss dropping the faces, the [DICE:] record's
// fourth field, the note's "never roll it again", the dice log's damage, the mut, the two cards (the rolled card's
// field is model text and escaped; the pending card prints canonical text the grammar rebuilt, so there is nothing to escape),
// the MECHANICS and CHECK doc teaching, and the wiring in rollPendingCheck (the faces rolled from the check, filed, sent,
// and played only through the d20 overlay's close) must each turn the #654 section red.
//   node dev/sabotage-654-damage-roll.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#654"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "a d20 becomes a damage die",
    find: "var DAMAGE_DICE_SIDES=[4,6,8,10,12],", replace: "var DAMAGE_DICE_SIDES=[4,6,8,10,12,20],",
    mustFail: "never the d20" },
  { label: "a miss keeps the damage it did not deal",
    find: 'var hit=outcome!=="failed"&&outcome!=="fumble",', replace: "var hit=true,",
    mustFail: "miss:" },
  { label: "the [DICE:] record loses its fourth field",
    find: '(damage?"|"+damage.text:"")', replace: '""',
    mustFail: "tag:" },
  { label: "the note stops telling the GM the damage is rolled",
    find: "the damage is rolled too, never roll it again.", replace: "the damage is rolled too.",
    mustFail: "note:" },
  { label: "dice in the modifier's seat parse as +14",
    find: "var mod=parseDamageExpr(p[1])?0:parseInt(", replace: "var mod=parseInt(",
    mustFail: "modifier's seat" },
  { label: "the fourth field is never read",
    find: "else if(!dmg)dmg=parseDamageExpr(p[i]);", replace: "",
    mustFail: "fourth field:" },
  { label: "the dice log forgets the damage",
    find: 'if(e.dmg&&typeof e.dmg.total==="number")rec.dmg=', replace: "if(false)rec.dmg=",
    mustFail: "record:" },
  { label: "the record text drops the total",
    find: '((faces.length>1||d.mod)?" = "+damageTotal(d,faces):"")', replace: '""',
    mustFail: "text:" }
]);
prove("tag_table.js", [
  { label: "the CHECK doc line stops teaching the damage field",
    find: " -- never roll damage for a check you emitted\\n\",", replace: "\\n\",",
    mustFail: "CHECK doc line" },
  { label: "the mut stops naming the damage",
    find: '(chk.dmg?", "+chk.dmg.text+" on a hit":"")', replace: '""',
    mustFail: "the mut does not name" }
]);
prove("api.js", [
  { label: "the MECHANICS line stops teaching the damage field",
    find: ' and never roll damage yourself for a check you emitted."+diceStakeText()+diceFloorText(true)', replace: '."+diceStakeText()+diceFloorText(true)',
    mustFail: "MECHANICS line does not teach" },
  { label: "the pending card hides the dice",
    find: "(ck.dmg?' &middot; '+ck.dmg.text+' on a hit':'')", replace: "''",
    mustFail: "pending card:" },
  { label: "the rolled card hides the damage",
    find: '(p[3]?" &middot; damage "+escHtml(p[3]):"")', replace: '""',
    mustFail: "rolled card:" },
  { label: "the rolled card prints the field unescaped",
    find: 'escHtml(p[3])', replace: 'p[3]',
    mustFail: "the fourth field is model text" }
]);
prove("game.js", [
  { label: "the faces are never rolled",
    find: 'var faces=(chk.dmg&&typeof rollDamageFaces==="function")?rollDamageFaces(chk.dmg):null;', replace: "var faces=null;",
    mustFail: "the faces must be rolled" },
  { label: "the record drops the damage",
    find: "dmg:r.damage}", replace: "dmg:null}",
    mustFail: "the record must carry the damage" },
  { label: "the damage dice play on a miss too",
    find: "var after=r.damage?{onClose:", replace: "var after=chk.dmg?{onClose:",
    mustFail: "only when the hit rolled them" },
  { label: "the damage dice never play",
    find: 'showDiceRoll(r.roll,after);', replace: 'showDiceRoll(r.roll);',
    mustFail: "only when the hit rolled them" }
]);
prove("ui-dice.js", [
  { label: "the overlay closes without telling its caller",
    find: 'if(opts&&typeof opts.onClose==="function")opts.onClose();', replace: "",
    mustFail: "the overlay must call onClose" }
]);
process.exit(code);
