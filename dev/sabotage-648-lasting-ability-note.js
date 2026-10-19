// dev/sabotage-648-lasting-ability-note.js — proves #648's guards (the LASTING ABILITY ask: an ability has no use tag, so the
// engine asks when one is NAMED and unfiled): the standing-condition silence, the presence gate, the last-narration trigger,
// the cooldown, the hyphen/long-word trigger, the companion-name-plus-stem rule and the ability-only scope must each turn the
// condition-audit section red.
//   node dev/sabotage-648-lasting-ability-note.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "condition audit"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "a condition already naming the ability no longer silences the ask (the GM is nagged into a double)",
    find: "      if(conditionStandsFor(sheets[i].sheet,nm))continue;", replace: "",
    mustFail: "fired beside a GM entry whose cause names it" },
  { label: "a companion split away is asked about as if present",
    find: "_laPc=presentCompanions();", replace: "_laPc=livingPartyCompanions();",
    mustFail: "split away" },
  { label: "the last narration is no longer read — a shift the GM named goes unasked",
    find: "if(sl[i]&&sl[i].role===\"assistant\"&&!sl[i].bk){last=String(sl[i].content||\"\");break;}", replace: "if(false){}",
    mustFail: "LAST NARRATION" },
  { label: "the cooldown is gone — the same ask every turn while the name lingers",
    find: "      if(asks[key]!=null&&worldState.turn-asks[key]<ABILITY_ASK_COOLDOWN)continue;", replace: "",
    mustFail: "re-asked within the cooldown" }
]);
prove("helpers.js", [
  { label: "a hyphenated or long word of the name no longer triggers — 'seventy-two faces' (the owner's case) goes unasked",
    find: "if(tok.indexOf(\"-\")>0||tok.length>=LASTING_ABILITY_TOKEN_MIN){", replace: "if(false){",
    mustFail: "silent on the owner's case" },
  { label: "a bare #644 stem fires without the companion's name beside it ('shape', 'sight' anywhere near a companion)",
    find: "  if(who&&lastingAbilityWhoNamed(s,who)){var st=ownSpellStems(nm),low=s.toLowerCase();", replace: "  if(who){var st=ownSpellStems(nm),low=s.toLowerCase();",
    mustFail: "bare short stems fired" },
  { label: "the sheet's SPELLS are read too — a lasting spell is asked about (the cast already files it — a double)",
    find: "var out=[],ab=(sheet&&sheet.abilities)||[],i;for(i=0;i<ab.length;i++){var nm=ab[i]&&ab[i].nm;", replace: "var out=[],ab=((sheet&&sheet.abilities)||[]).concat((sheet&&sheet.spells)||[]),i;for(i=0;i<ab.length;i++){var nm=ab[i]&&ab[i].nm;",
    mustFail: "a spell is the cast's business" }
]);
process.exit(code);
