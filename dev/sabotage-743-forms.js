// dev/sabotage-743-forms.js — proves the #743 step-1 guards (two forms: DOC/DESIGN_743_forms.md): the starting form, the
// individual's own form, what each form may show, the label that follows the form, the enemy card, and the blueprint
// doors (validation, caps, the roster seed through the image gate, the export). Each clause plants one regression; the
// named test of dev/tests-743-forms.js must fail (each clause runs its own test through --only).
//   node dev/sabotage-743-forms.js
var sabotage = require("./sabotage.js");
var P = "FAIL #743 ", CMD = ["node", ["dev/tests-743-forms.js"]];
var helpers = [
  { label: "a public name alone no longer starts alternate (a legacy disguise shows its true form)",
    find: "return rec&&typeof rec.displayName===\"string\"&&rec.displayName.trim()?\"alternate\":\"true\";",
    replace: "return \"true\";", mustFail: P + "the starting form is the author's choice, and a public name alone still starts alternate" },
  { label: "the author's starting form is ignored",
    find: "  if(s===\"true\"||s===\"alternate\"||s===\"story\")return s;\n",
    replace: "", mustFail: P + "the starting form is the author's choice, and a public name alone still starts alternate" },
  { label: "the individual's stated form is ignored",
    find: "  if(f===\"true\"||f===\"alternate\")return f;\n",
    replace: "", mustFail: P + "the individual's own form wins, and as-serves-the-story is undeclared until stated" },
  { label: "an as-serves-the-story individual is guessed to be alternate",
    find: "f=formStart(rec);return f===\"story\"?\"\":f;",
    replace: "f=formStart(rec);return f===\"story\"?\"alternate\":f;", mustFail: P + "the individual's own form wins, and as-serves-the-story is undeclared until stated" },
  { label: "the alternate image is ignored (the true image is shown)",
    find: "if(rec.altPortrait)out.portrait=rec.altPortrait;else if(rec.portrait){",
    replace: "if(rec.portrait){", mustFail: P + "each form shows its own portrait and description" },
  { label: "the stand-in is not marked",
    find: "out.portrait=rec.portrait;out.standIn=true;}",
    replace: "out.portrait=rec.portrait;}", mustFail: P + "a called-for alternate with no image is the true image marked as a stand-in" },
  { label: "the true description stands in for a missing alternate description",
    find: "out.desc=rec.altDesc||(maskDesc?rec.desc||\"\":\"\");",
    replace: "out.desc=rec.altDesc||rec.desc||\"\";", mustFail: P + "the true description never stands in for a missing alternate description" },
  { label: "a legacy mask's description is shown on the true form",
    find: "out.desc=maskDesc?\"\":rec.desc||\"\";}",
    replace: "out.desc=rec.desc||\"\";}", mustFail: P + "a legacy disguised creature's one description is read as the alternate's" },
  { label: "an undeclared form shows the true form",
    find: "  if(!rec||!form)return out;\n  var maskDesc",
    replace: "  if(!rec)return out;if(!form)form=\"true\";\n  var maskDesc", mustFail: P + "an undeclared form shows nothing" },
  { label: "the label ignores the form (always the public name)",
    find: "return formOf(foe,rec)===\"true\"?String(rec.name):pub;",
    replace: "return pub;", mustFail: P + "the on-screen label follows the form" },
  { label: "an NPC's stated form is ignored",
    find: "return formView(rec,formOf(n,rec));",
    replace: "return formView(rec,formOf(null,rec));", mustFail: P + "a blueprint NPC carries its alternate form onto the roster through the image gate" }
];
var card = [
  { label: "the card shows the private classification on an alternate form",
    find: "if(view.form===\"true\")[{key:\"kind\",label:\"Type\"}",
    replace: "if(true)[{key:\"kind\",label:\"Type\"}", mustFail: P + "the card shows the alternate form: its image, its description, the public name, no private classification" },
  { label: "the card ignores the foe's stated form",
    find: "view=formView(record,formOf(foe,record));",
    replace: "view=formView(record,formOf(null,record));", mustFail: P + "the card shows the true form: its image, its description, the canonical name and classification" },
  { label: "an undeclared form is not said on the console",
    find: "if(record&&view.undeclared&&typeof console!==\"undefined\")console.warn(",
    replace: "if(0)console.warn(", mustFail: P + "an as-serves-the-story individual shows no portrait and no description until its form is stated" }
];
var doors = [
  { label: "an unknown starting form is accepted",
    find: "if(fe.startsAs!==undefined&&FORM_STARTS.indexOf(fe.startsAs)<0)return",
    replace: "if(0)return", mustFail: P + "a blueprint that states an unknown starting form or non-text alternate fields is refused" },
  { label: "non-text form fields are accepted",
    find: "for(var fk=0;fk<FORM_TEXT_FIELDS.length;fk++)if(",
    replace: "for(var fk=0;fk<0;fk++)if(", mustFail: P + "a blueprint that states an unknown starting form or non-text alternate fields is refused" },
  { label: "the alternate prose escapes the caps",
    find: "[\"altDesc\",\"altWhen\"].forEach(function(k){if(o&&o[k]!==undefined)add(",
    replace: "[].forEach(function(k){if(o&&o[k]!==undefined)add(", mustFail: P + "the alternate prose is capped like the other authored fields" },
  { label: "the alternate image skips the image gate",
    find: "if(k===\"altPortrait\"&&!safeImgSrcOk(src[k])){",
    replace: "if(0){", mustFail: P + "a blueprint NPC carries its alternate form onto the roster through the image gate" },
  { label: "the alternate form never reaches the roster",
    find: "      npcFormSeed(_seedN,n);/* #743: the alternate form rides the roster row */\n",
    replace: "", mustFail: P + "a blueprint NPC carries its alternate form onto the roster through the image gate" },
  { label: "a re-applied blueprint overwrites a form field the row already holds",
    find: "if(src[k]===undefined||src[k]===\"\"||row[k]!==undefined)return;",
    replace: "if(src[k]===undefined||src[k]===\"\")return;", mustFail: P + "a blueprint NPC carries its alternate form onto the roster through the image gate" },
  { label: "the export drops the NPC's forms",
    find: "    NPC_FORM_FIELDS.forEach(function(k){if(n[k]!==undefined)npcs[npcs.length-1][k]=n[k];});",
    replace: "", mustFail: P + "a campaign exported back to a blueprint keeps both forms" }
];
// ── step 2: the [FORM:] tag and what the GM is told ──
var T_FOE = P + "[FORM:] switches a foe either way, and the label and the engine's own words follow";
var T_REF = P + "[FORM:] is refused loudly: an unknown form, an unknown target, a look-alike, a target with no alternate";
var T_STRIP = P + "the tag never reaches the story, and the standing tag list is unchanged";
var T_GM = P + "the GM is told a creature's forms, its cue and the tag — only where an alternate exists";
var T_LINE = P + "the combat line states each foe's form and asks for an unstated one every turn";
var tag = [
  { label: "a form is filed on a look-alike foe (a name that only contains the tag's)",
    find: "rows=formFoeRows(function(x){return String(x.name).toLowerCase()===t;});",
    replace: "rows=formFoeRows(function(x){return String(x.name).toLowerCase().indexOf(t)>=0;});", mustFail: T_REF },
  { label: "a foe with no alternate takes a form",
    find: "if(row){rec=bestiaryRecord(row.name);if(rec&&formHasAlternate(rec))return",
    replace: "if(row){rec=bestiaryRecord(row.name);if(rec)return", mustFail: T_REF },
  { label: "a character with no alternate takes a form",
    find: "return n&&formHasAlternate(n)?{individual:n,rec:n,foe:false}:null;",
    replace: "return n?{individual:n,rec:n,foe:false}:null;", mustFail: T_REF },
  { label: "an unknown form is accepted",
    find: "if(want!==\"true\"&&want!==\"alternate\"){",
    replace: "if(0){", mustFail: T_REF },
  { label: "the tag is parsed and changes nothing",
    find: "var was=formOf(target.individual,target.rec);target.individual.form=want;",
    replace: "var was=formOf(target.individual,target.rec);", mustFail: T_FOE },
  { label: "a form change is silent",
    find: "if(was&&was!==want)R.muts.push(\"Form: \"",
    replace: "if(0)R.muts.push(\"Form: \"", mustFail: T_FOE },
  { label: "a form already showing is announced again",
    find: "if(was&&was!==want)R.muts.push(\"Form: \"",
    replace: "if(1)R.muts.push(\"Form: \"", mustFail: T_FOE },
  { label: "a foe started under the public name is not in its alternate form",
    find: "foe.form=\"alternate\";/* #743: a foe started",
    replace: ";/* #743: a foe started", mustFail: P + "a foe started under the public name is in its alternate form, and a group splits into rows" },
  { label: "the tag leaves the strip vocabulary: it leaks into the story",
    find: "\"COMBAT_GROUP\",\"FORM\",\"LOCATION_DESC\"",
    replace: "\"COMBAT_GROUP\",\"LOCATION_DESC\"", mustFail: T_STRIP },
  { label: "the tag leaves the engine-only tier: the standing list teaches it to every campaign",
    find: "\"SHOP_KEEPER\",\"FORM\"];",
    replace: "\"SHOP_KEEPER\"];", mustFail: T_STRIP }
];
var prompt = [
  { label: "the bestiary no longer tells the GM about the forms",
    find: "        if(formHasAlternate(_bc))_detail+=formGmNote(_bc);",
    replace: "", mustFail: T_GM },
  { label: "the label is pinned for the whole encounter again",
    find: " It is the label while the creature is in its alternate form.\";",
    replace: " Keep the public label throughout the encounter, even if its nature is exposed.\";", mustFail: T_GM },
  { label: "the characters' block lists characters with no alternate",
    find: "if(!n||n.dead||!formHasAlternate(n))continue;",
    replace: "if(!n||n.dead)continue;", mustFail: T_GM },
  { label: "the combat line no longer states the form",
    find: "with how many are up\":\"\")+foeFormLine(cf));}",
    replace: "with how many are up\":\"\"));}", mustFail: T_LINE },
  { label: "an unstated form is not asked for",
    find: "emit \"+formTagPair(foe.name));",
    replace: "\");", mustFail: T_LINE },
  { label: "a foe with no alternate gets a form clause (the line is no longer byte-identical)",
    find: "var rec=bestiaryRecord(foe&&foe.name);if(!rec||!formHasAlternate(rec))return \"\";",
    replace: "var rec=bestiaryRecord(foe&&foe.name);if(!rec)return \"\";", mustFail: T_LINE },
  { label: "the GM is no longer told a character's forms",
    find: "    +buildNpcFormsBlock()/* #743",
    replace: "    +\"\"/* #743", mustFail: P + "the GM is told an NPC's forms in the volatile half" }
];
var words = [
  { label: "the engine's words ignore the live foe's form",
    find: "  for(i=0;i<f.length;i++)if(f[i]&&String(f[i].name).toLowerCase()===t)return foePublicName(f[i]);\n",
    replace: "", mustFail: T_FOE }
];
// ── the independent review of 2026-11-14 ──
var R1 = P + "review: the tag the GM is taught names the row — the entry's other name finds its one living row";
var R_AMB = P + "review: two living rows of one entry under other names are ambiguous and refused";
var R_NPCFOE = P + "review: a character fighting as a foe changes form on its roster row";
var R_SLAIN = P + "review: a second foe under a slain one's name is the one spoken of and the one a tag reaches";
var R_SILENT = P + "review: the first statement of a form is silent, and a refusal does not hint at a hidden form";
var R_MERGE = P + "review: an accepted merge keeps the form and the alternate with the portrait";
var R_TT = P + "review: Table Talk names a foe as the tracker does";
var R_ED = P + "review: the sheet's portrait editor is held while a character is not in its true form";
var revTag = [
  { label: "the entry's other name no longer reaches its row (the GM is taught a tag the parser refuses)",
    find: "      if(rows.up.length===1)return {individual:rows.up[0],rec:rec,foe:true};\n", replace: "", mustFail: R1 },
  { label: "an ambiguous entry name lands on the first of two rows",
    find: "if(rows.up.length===1)return {individual:rows.up[0]", replace: "if(rows.up.length>=1)return {individual:rows.up[0]", mustFail: R_AMB },
  { label: "a character fighting as a foe is refused (no fall-through to the roster)",
    find: "return {individual:row,rec:rec,foe:true};}\n  else{", replace: "return {individual:row,rec:rec,foe:true};return null;}\n  else{", mustFail: R_NPCFOE },
  { label: "a tag reaches the corpse before the living row",
    find: "row=rows.up[0]||rows.fallen[0];", replace: "row=rows.fallen[0]||rows.up[0];", mustFail: R_SLAIN },
  { label: "the first statement of an unstated form is announced to the player",
    find: "if(was&&was!==want)R.muts.push(", replace: "if(was!==want)R.muts.push(", mustFail: R_SILENT },
  { label: "a merge drops the form and the alternate",
    find: "[\"form\"].concat(NPC_FORM_FIELDS).forEach(function(k){if(_mgCanN[k]===undefined&&_mgDupN[k]!==undefined)_mgCanN[k]=_mgDupN[k];});", replace: "", mustFail: R_MERGE },
  { label: "a merge overwrites the survivor's own alternate",
    find: "if(_mgCanN[k]===undefined&&_mgDupN[k]!==undefined)_mgCanN[k]=_mgDupN[k];});/* #743", replace: "if(_mgDupN[k]!==undefined)_mgCanN[k]=_mgDupN[k];});/* #743", mustFail: R_MERGE }
];
var revPrompt = [
  { label: "the combat line prints the entry's name, not the row's own tag",
    find: "to change it emit [FORM:\"+foe.name+\"|\"", replace: "to change it emit [FORM:\"+rec.name+\"|\"", mustFail: R1 },
  { label: "a row in its true form is still said to have a public name",
    find: "\" | Shown to the player as: \":\" | Public name: \"", replace: "\" | Public name: \":\" | Public name: \"", mustFail: R1 },
  { label: "the GM is asked to state a creature's form before a row exists",
    find: "+\" once it is in a fight\":", replace: "+\" when the individual appears\":", mustFail: R_SILENT }
];
var revWords = [
  { label: "the engine names the slain row's form for a living namesake",
    find: "===t&&!(f[i].down||f[i].hp<=0))return foePublicName(f[i]);", replace: "===t&&0)return foePublicName(f[i]);", mustFail: R_SLAIN },
  { label: "the portrait editor opens on an alternate form",
    find: "return !!(n&&formHasAlternate(n)&&npcFormView(n).form!==\"true\");}", replace: "return false;}", mustFail: R_ED }
];
var revTalk = [
  { label: "Table Talk is given the canonical name of a disguised foe",
    find: "fo.push(foePublicName(f)+\" \"+f.hp", replace: "fo.push(f.name+\" \"+f.hp", mustFail: R_TT }
];
var revSheet = [
  { label: "the avatar click opens the editor whatever the form",
    find: "if(npcPortraitEditorHeld(wsNpc)){showToast(", replace: "if(0){showToast(", mustFail: R_ED }
];
var failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: helpers.concat(words, revWords) });
if (!failed) failed = sabotage.prove({ file: "tag_table.js", command: CMD, only: P, cases: tag.concat(revTag) });
if (!failed) failed = sabotage.prove({ file: "api.js", command: CMD, only: P, cases: prompt.concat(revPrompt) });
if (!failed) failed = sabotage.prove({ file: "table-talk.js", command: CMD, only: P, cases: revTalk });
if (!failed) failed = sabotage.prove({ file: "ui-sheets.js", command: CMD, only: P, cases: revSheet });
if (!failed) failed = sabotage.prove({ file: "ui-mobile.js", command: CMD, only: P, cases: card });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: doors });
process.exit(failed ? 1 : 0);
