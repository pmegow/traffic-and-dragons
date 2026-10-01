// dev/sabotage-503-npc-kept-apart.js — proves the #503 guards are guarded. Field case (The Princess, t85 and t89):
// [NPC:King Underbough|…] with [NPC_PRONOUN:King Underbough|he/him] landed on "Wilhelmina Underbough" — a stop-word title
// left only the family's surname, she was the one Underbough on file, and her mood and pronouns were overwritten in silence.
// ONE veto in the consolidation scan (npcKeptApart, memory.js) now keeps a name apart from a candidate it CONTRADICTS — by
// sex (a title, or the pronouns the reply states), by age, or by a crown's generation — and the two tag handlers say so once.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-503-npc-kept-apart.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#503"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var FIELD = "the field case", SEX = "a title that states the other sex", PRON = "the record's pronouns answer", SUR = "a title word that is the person's SURNAME",
    RANK = "old and young are two people", REV = "the reverse order", FLIP = "a pronoun tag never flips", END = "forgotten when the reply ends",
    TWO = "two candidates stay ambiguous", PURE = "npcNameSays is pure";
prove("memory.js", [
  { label: "the veto is gone (the reported fusion)",
    find: "    if(w){apart=k;why=w;}else match=k;", replace: "    match=k;",
    mustFail: FIELD },
  { label: "a ruled-out candidate stops counting, so the name is steered onto the survivor",
    find: "    cnt++;if(cnt>1)break;\n    var w=npcKeptApart(name,k,shortT,longT);\n    if(w){apart=k;why=w;}else match=k;",
    replace: "    var w=npcKeptApart(name,k,shortT,longT);\n    if(w){apart=k;why=w;continue;}\n    match=k;cnt++;if(cnt>1)break;",
    mustFail: TWO },
  { label: "the record's own pronouns are not read",
    find: "  var px=npcSexOfPronouns((w&&w.pronouns)||m.pronouns);if(px)s.sex=px;\n", replace: "",
    mustFail: PRON },
  { label: "pronouns that state no sex count as a claim",
    find: "  return (m&&!f&&!o)?\"m\":(f&&!m&&!o)?\"f\":null;", replace: "  return (m&&!f&&!o)?\"m\":\"f\";",
    mustFail: PRON },
  { label: "a surname reads as a title (Marla King is a man)",
    find: "    if(i===last&&i>0&&!_NPC_KIN_NOUNS[t]){var p=ws[i-1];if(p!==\"the\"&&!_NPC_SEX_WORDS[p]&&!_NPC_RANK_WORDS[p])continue;}\n", replace: "",
    mustFail: SUR },
  { label: "a kin noun closing a description reads as a surname (the Scarred Man is the Scarred Woman)",
    find: "if(i===last&&i>0&&!_NPC_KIN_NOUNS[t]){", replace: "if(i===last&&i>0){",
    mustFail: SEX },
  { label: "'the Elder' closing a name reads as a surname",
    find: "if(p!==\"the\"&&!_NPC_SEX_WORDS[p]&&!_NPC_RANK_WORDS[p])continue;", replace: "if(!_NPC_SEX_WORDS[p]&&!_NPC_RANK_WORDS[p])continue;",
    mustFail: RANK },
  { label: "a title after a title reads as a surname",
    find: "if(p!==\"the\"&&!_NPC_SEX_WORDS[p]&&!_NPC_RANK_WORDS[p])continue;", replace: "if(p!==\"the\")continue;",
    mustFail: PURE },
  { label: "someone else's title (a possessive) reads as the person's own",
    find: "var w=raw[i].replace(/[^a-z]/g,\"\");if(w)ws.push(w);", replace: "var w=raw[i].replace(/['\\u2019]s$/,\"\").replace(/[^a-z]/g,\"\");if(w)ws.push(w);",
    mustFail: SUR },
  { label: "a parenthetical titles the person",
    find: "  var raw=String(name||\"\").toLowerCase().replace(/\\(.*?\\)/g,\" \").split(/\\s+/),ws=[],i;", replace: "  var raw=String(name||\"\").toLowerCase().split(/\\s+/),ws=[],i;",
    mustFail: SUR },
  { label: "a name that states both sexes states the last one",
    find: "    if(sx)out.sex=(out.sex&&out.sex!==sx)?\"?\":(out.sex||sx);", replace: "    if(sx)out.sex=sx;",
    mustFail: PURE },
  { label: "old and young are one person",
    find: "  if(a.age&&b.age&&a.age!==b.age)return a.age+\", not \"+b.age;\n", replace: "",
    mustFail: RANK },
  { label: "a king and his son are one person (the crown clause is gone)",
    find: "  if(a.crown&&b.crown&&a.crown!==b.crown&&shortT.length===1&&longT.length>1&&longT[longT.length-1]===shortT[0])return a.crown+\", not \"+b.crown;\n", replace: "",
    mustFail: RANK },
  { label: "a crowned prince becomes a stranger (the surname-only condition is dropped)",
    find: "a.crown!==b.crown&&shortT.length===1&&longT.length>1&&longT[longT.length-1]===shortT[0])return", replace: "a.crown!==b.crown)return",
    mustFail: RANK },
  { label: "the rank a record's aliases state is not read",
    find: "  for(i=0;i<al.length;i++){var x=npcNameSays(al[i]);", replace: "  for(i=0;i<0;i++){var x=npcNameSays(al[i]);",
    mustFail: RANK },
  { label: "the pronouns the reply states are not read",
    find: "  if(said)a.sex=said;\n", replace: "",
    mustFail: REV },
  { label: "the pronoun operand of [NPC:] is not read",
    find: "if(p&&!out[n])out[n]=p;}", replace: "}",
    mustFail: FLIP },
  { label: "the end of a reply wipes an outer reply's statements instead of restoring them",
    find: "function npcEndResponse(prev){_npcSaid=prev||null;}", replace: "function npcEndResponse(prev){_npcSaid=null;}",
    mustFail: END },
  { label: "the receipt repeats on every later tag of the new person",
    find: "  if(!memory.npcs||memory.npcs[raw])return \"\";", replace: "  if(!memory.npcs)return \"\";",
    mustFail: FIELD }
]);
prove("api.js", [
  { label: "applyMuts never reads what the reply states",
    find: "var _npcSaidPrev=(typeof npcBeginResponse===\"function\")?npcBeginResponse(text):null;", replace: "var _npcSaidPrev=null;",
    mustFail: REV },
  { label: "what a reply stated outlives the reply",
    find: "  if(typeof npcEndResponse===\"function\")npcEndResponse(_npcSaidPrev);/* #503", replace: "  /* #503",
    mustFail: END }
]);
prove("tag_table.js", [
  { label: "the [NPC:] handler files the new person without a word",
    find: "if(_npApart){R.muts.push(\"⚠ \"+_npApart);", replace: "if(_npApart){",
    mustFail: FIELD },
  { label: "the pronoun handler files the new person without a word",
    find: "if(_pnApart){R.muts.push(\"⚠ \"+_pnApart);", replace: "if(_pnApart){",
    mustFail: FLIP }
]);
process.exit(code ? 1 : 0);
