// dev/sabotage-489-ability-sections.js — proves the #489 guards are guarded: the sheet's ability list is grouped under
// Racial / Class / Archetype / Story, decided by the name alone, in a fixed order, each ability once. Each mutation runs
// in a disposable clone.
//   node dev/sabotage-489-ability-sections.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-489-ability-sections.js"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the racial prefix is no longer a group (everything racial reads as story)",
    find: "  if(/^\\s*\\[racial\\]/i.test(p.nm))return \"racial\";\n", replace: "",
    mustFail: "each ability falls under one heading" },
  { label: "a class ability is filed as story (the reported confusion comes back another way)",
    find: "  return row?row.group:\"story\";", replace: "  return \"story\";",
    mustFail: "each ability falls under one heading" },
  { label: "any archetype's row counts as this character's",
    find: "    if(archs[j].id!==c.archetype)continue;\n", replace: "",
    mustFail: "another archetype's row" },
  { label: "the headings follow the stored order instead of the fixed one",
    find: "var order=[[\"racial\",\"Racial\"],[\"class\",\"Class\"+(d?\" — \"+d.nm:\"\")],", replace: "var order=[[\"story\",\"Story\"],[\"racial\",\"Racial\"],[\"class\",\"Class\"+(d?\" — \"+d.nm:\"\")],",
    mustFail: "fixed order" },
  { label: "an empty group still prints its heading",
    find: "if(by[order[i][0]].length)out.push({key:order[i][0],label:order[i][1],items:by[order[i][0]]});", replace: "out.push({key:order[i][0],label:order[i][1],items:by[order[i][0]]});",
    mustFail: "fixed order" }
]);
prove("ui-sheets.js", [
  { label: "the sheet prints no headings (the flat list comes back)",
    find: "    abilHtml+='<div class=\"cs-abil-grp\" data-grp=\"'+_abGs[_abG].key+'\"", replace: "    if(false)abilHtml+='<div class=\"cs-abil-grp\" data-grp=\"'+_abGs[_abG].key+'\"",
    mustFail: "prints the headings in order" },
  { label: "the racial name repeats its heading",
    find: "_abShow=_abGs[_abG].key===\"racial\"?_abP.nm.replace(/^\\s*\\[racial\\]\\s*/i,\"\"):_abP.nm,", replace: "_abShow=_abP.nm,",
    mustFail: "prints the headings in order" },
  { label: "an old 'LvN' entry prints its label as the name",
    find: "_abShow=_abGs[_abG].key===\"racial\"?_abP.nm.replace(/^\\s*\\[racial\\]\\s*/i,\"\"):_abP.nm,", replace: "_abShow=_abRec.nm,",
    mustFail: "prints the headings in order" },
  { label: "a heading is drawn as a bordered pill",
    find: "style=\"font-size:10px;text-transform:uppercase;color:var(--t1);letter-spacing:.12em;margin:'", replace: "style=\"border:1px solid var(--brd);border-radius:12px;font-size:11px;color:var(--t2);letter-spacing:.06em;margin:'",
    mustFail: "plain text, never a pill" }
]);
process.exit(code);
