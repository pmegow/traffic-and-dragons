// dev/sabotage-751-ability-uses.js — proves the #751 guards (limited ability uses): the recharge table, the one writer and
// the one restorer, the two tags and their refusals, the rest and new-fight restores, the roll that spends, what the GM is
// told, the panel and the sheet, the portable copy. Each clause plants one regression; the named test of
// dev/tests-751-ability-uses.js must fail (each clause runs its own test through --only).
//   node dev/sabotage-751-ability-uses.js
var sabotage = require("./sabotage.js");
var P = "FAIL #751 ", CMD = ["node", ["dev/tests-751-ability-uses.js"]];
var T1 = P + "the recharge table reads the name's own limit first, then the bible cost, and knows nothing of an ability with neither",
  T2 = P + "the status says Passive, Ready or Not Ready, and nothing for an ability whose cost is unknown",
  T3 = P + "each event brings back only what its row names",
  T4 = P + "a once-per-fight use reads spent only while a fight is open",
  T5 = P + "the tags: [ABILITY_USED:] spends the hero's, the companion twin spends theirs, and every refusal is said",
  T6 = P + "rests and a new fight bring uses back through the real handlers, party-wide",
  T7 = P + "a use that waits on the player's roll is spent at the die, never at the ask, and Hold back spends nothing",
  T8 = P + "the GM is told: a spent ability is EXPENDED on the sheet line and its canon line, a limited one carries its tag, and nothing moves while nothing is limited",
  T9 = P + "the panel and the sheet show the status beside the name, and a spent ability is not offered to the input",
  T10 = P + "a use survives a save and a load";
var helpers = [
  { label: "the limit on the name is not read: the bible's cost decides", find: "if(m)return m[1];var e=(typeof capabilityLookup", replace: "var e=(typeof capabilityLookup", mustFail: T1 },
  { label: "a pool is tracked as one use", find: '{key:"open",test:/^pool|^at-will|', replace: '{key:"open",test:/^at-will|', mustFail: T1 },
  { label: "an ability of unknown cost is given a status", find: "if(!cost)return null;for(i=0", replace: "if(!cost)return ABILITY_RECHARGE_OPEN;for(i=0", mustFail: T1 },
  { label: "a 1/day comes back on a short rest instead of a night's", find: 'until:"until dawn",on:["long"]}', replace: 'until:"until dawn",on:["short"]}', mustFail: T3 },
  { label: "a per-rest ability no longer comes back on a short rest", find: 'until:"until a rest",on:["long","short"]}', replace: 'until:"until a rest",on:["long"]}', mustFail: T3 },
  { label: "a once-per-fight use is not back when a fight opens", find: 'on:["long","short","fight"]}', replace: 'on:["long","short"]}', mustFail: T3 },
  { label: "a once-per-campaign use returns with a night's rest", find: 'back:"",until:"",on:[]}', replace: 'back:"",until:"",on:["long"]}', mustFail: T3 },
  { label: "a once-per-fight use reads spent after the fight", find: 'if(r.key==="fight"&&!(typeof worldState!=="undefined"&&worldState&&worldState.combat))return false;', replace: "", mustFail: T4 },
  { label: "an at-will ability is marked used", find: 'if(!r||!r.on)return {status:"free",ab:ab};', replace: 'if(!r)return {status:"free",ab:ab};', mustFail: T2 },
  { label: "a second use of a spent ability is not noticed", find: 'if(abilitySpent(ab))return {status:"already",ab:ab,row:r};', replace: "", mustFail: T2 },
  { label: "the record loses the turn it was spent", find: 'ab.used=(typeof turn==="number")?turn:true;', replace: "ab.used=true;", mustFail: T2 },
  { label: "a spent ability reads Ready", find: 'label:"Not Ready"', replace: 'label:"Ready"', mustFail: T2 },
  { label: "a restore names the ability and leaves it spent", find: "{delete ab.used;out.push(", replace: "{out.push(", mustFail: T3 },
  { label: "a rest forgets the companions", find: "var f=abilitiesRestore(p[i].charSheet,event);", replace: "var f=[];", mustFail: T6 },
  { label: "a check's label names an ability by a substring", find: "if(k&&nameContains(label,k)){if(hit)return null;hit=ab;}", replace: "if(k&&String(label).toLowerCase().indexOf(k)>=0){if(hit)return null;hit=ab;}", mustFail: T7 },
  { label: "two abilities in one label: the first is taken", find: "{if(hit)return null;hit=ab;}", replace: "{if(!hit)hit=ab;}", mustFail: T7 },
  { label: "the GM's name list never marks a spent ability", find: "if(!abilitySpent(ab))return nm;var r=abilityRecharge(ab);", replace: "return nm;var r=abilityRecharge(ab);", mustFail: T8 },
  { label: "a portable copy carries the use into another campaign", find: "delete copy.abilities[k].used;", replace: ";", mustFail: T10 }
];
var tags = [
  { label: "a use that waits on the roll is spent at the ask", find: "if(pc&&abilityFind(sheet,nm)&&", replace: "if(false&&abilityFind(sheet,nm)&&", mustFail: T7 },
  { label: "an ability that is not on the sheet is refused in silence", find: 'if(r.status==="unknown"){R.muts.push(', replace: 'if(r.status==="unknown"){[].push(', mustFail: T5 },
  { label: "a use the sheet could not pay is not said", find: 'if(r.status==="already"){R.muts.push(', replace: 'if(r.status==="already"){[].push(', mustFail: T5 },
  { label: "the companion's tag spends the hero's ability", find: "abilityUseFile(cs,m[2].trim(),who,R);", replace: "abilityUseFile(worldState.character,m[2].trim(),who,R);", mustFail: T5 },
  { label: "a new fight opens with last fight's uses still spent", find: 'var _abBack=abilitiesRestoreParty("fight");', replace: "var _abBack=[];", mustFail: T6 },
  { label: "a short rest brings nothing back", find: 'var _shAb=abilitiesRestoreParty("short");', replace: "var _shAb=[];", mustFail: T6 }
];
var game = [
  { label: "a night's rest brings nothing back", find: 'var _abBack=abilitiesRestoreParty("long");', replace: "var _abBack=[];", mustFail: T6 },
  { label: "the roll made for an ability does not spend it", find: "var _abUse=abilityMarkUsed(worldState.character,abilityParts(_abFor).nm,worldState.turn);", replace: 'var _abUse={status:"free"};', mustFail: T7 }
];
var prompt = [
  { label: "the hero's sheet line lists a spent ability as usable", find: "as2.push(abilityPromptName(c.abilities[i]));", replace: "as2.push(c.abilities[i].nm);", mustFail: T8 },
  { label: "the canon line of a spent ability is not marked", find: 'lines.push((abilitySpent(ab)?"[EXPENDED', replace: 'lines.push((false?"[EXPENDED', mustFail: T8 },
  { label: "an ability that is never spent is taught the use tag", find: 'if(!r||!r.on)return "";var nm=abilityParts(ab).nm', replace: 'if(!r)return "";var nm=abilityParts(ab).nm', mustFail: T8 },
  { label: "a spent ability is still asked for its tag", find: '+((_abAsk&&!abilitySpent(ab))?" LIMITED USE', replace: '+((_abAsk)?" LIMITED USE', mustFail: T8 },
  { label: "a companion's limited ability is taught no tag", find: '((_paAsk&&!abilitySpent(pcs.abilities[pai]))?" (limited: emit "+_paAsk+" when used)":"")', replace: '""', mustFail: T8 }
];
var panel = [
  { label: "a spent ability is still offered to the input", find: "q=spent?null:capabilityQuickText(p.nm,p.ds);", replace: "q=capabilityQuickText(p.nm,p.ds);", mustFail: T9 },
  { label: "the status label is painted unescaped", find: "> ('+escHtml(st.label)+')</span>'", replace: "> ('+st.label+')</span>'", mustFail: T9 },
  { label: "a spent status is not set apart by colour", find: '(st.key==="spent"?"--warn":"--t2")', replace: '("--t2")', mustFail: T9 }
];
var sheet = [
  { label: "the character sheet shows no status", find: '+(typeof abilityStatusHtml==="function"?abilityStatusHtml(abilityStatus(_abRec)):"")/* #751 */', replace: "/* #751 */", mustFail: T9 }
];
var talk = [
  { label: "Table Talk lists a spent ability as usable", find: "ab.push(abilityPromptName(c.abilities[i]));", replace: "ab.push(c.abilities[i].nm);", mustFail: T10 }
];
var failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: helpers });
if (!failed) failed = sabotage.prove({ file: "tag_table.js", command: CMD, only: P, cases: tags });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "api.js", command: CMD, only: P, cases: prompt });
if (!failed) failed = sabotage.prove({ file: "ui-panels.js", command: CMD, only: P, cases: panel });
if (!failed) failed = sabotage.prove({ file: "ui-sheets.js", command: CMD, only: P, cases: sheet });
if (!failed) failed = sabotage.prove({ file: "table-talk.js", command: CMD, only: P, cases: talk });
process.exit(failed ? 1 : 0);
