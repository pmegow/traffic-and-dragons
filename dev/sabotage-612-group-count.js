// dev/sabotage-612-group-count.js — proves the #612 guards are guarded (owner 2026-10-12: "when we declare a pack or any
// grouping of enemies, we need to specify that in the combat UI … the text should be 'Blight Husk Pack (8)'"). The headcount
// is AUTHORED through [COMBAT_GROUP:N] / [COMBAT_GROUP:Name|N] (tag_table.js) and never inferred; foeLabel (helpers.js) is the
// ONE renderer the tracker row, the prompt's combat line and the enemy card read; the tag strips and is taught. Each rule is
// mutated back and the #612 engine test must go red.
//   node dev/sabotage-612-group-count.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var BROWSER = ["node", ["dev/tests-611-mobile-browser.js"]];
var CMD = ["node", ["dev/run-tests.js", "multi-enemy combat (UA26+UA2)"]];
var T = "#612 a group's headcount is authored";
var code = 0;
code |= sabotage.prove({ file: "tag_table.js", command: CMD, cases: [
  { label: "the bare form binds to the LAST foe instead of the preceding COMBAT_START (the pre-P3-F1 class)",
    find: "    var foe=nm?combatFoeByName(nm):combatAttrFoe(starts,m.index);", replace: "    var foe=nm?combatFoeByName(nm):worldState.combat.foes[worldState.combat.foes.length-1];",
    mustFail: T },
  { label: "the named form is dropped: a mid-fight update by name lands nowhere",
    find: "    var foe=nm?combatFoeByName(nm):combatAttrFoe(starts,m.index);", replace: "    var foe=nm?null:combatAttrFoe(starts,m.index);",
    mustFail: T },
  { label: "the headcount validation is dropped: zero and a word are accepted",
    find: "    if(!/^\\d{1,3}$/.test(ns)||parseInt(ns,10)<1){", replace: "    if(false){",
    mustFail: T },
  { label: "the update is no longer logged",
    find: "    foe.count=parseInt(ns,10);R.muts.push(\"Group: \"+foe.name+\" \\u00d7\"+foe.count);}}},", replace: "    foe.count=parseInt(ns,10);}}},",
    mustFail: T },
  { label: "the tag leaves the strip vocabulary: the count leaks into the story",
    find: "\"COMBAT_VULN\",\"COMBAT_GROUP\",\"LOCATION_DESC\"", replace: "\"COMBAT_VULN\",\"LOCATION_DESC\"",
    mustFail: T },
  { label: "the doc line is gone: the GM is never taught the tag",
    find: "\"[COMBAT_GROUP:N] or [COMBAT_GROUP:Name|N] -- for a pooled group", replace: "\"[COMBAT_GROUP_X:N] or [COMBAT_GROUP:Name|N] -- for a pooled group",
    mustFail: T }
] });
code |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "an unrecorded pack is no longer asked for its headcount (the predicate is always false)",
    find: "function foeGroupUnrecorded(foe){var n=String(foe&&foe.name||\"\");return /", replace: "function foeGroupUnrecorded(foe){var n=String(foe&&foe.name||\"\");return false&&/",
    mustFail: T },
  { label: "the predicate ignores a recorded count: a counted pack is asked forever",
    find: "&&!(foe&&typeof foe.count===\"number\");}", replace: ";}",
    mustFail: T },
  { label: "the label drops the count (the name alone, as before #612)",
    find: "function foeLabel(foe){return String(foe&&foe.name||\"\")+(foe&&typeof foe.count===\"number\"?\" (\"+foe.count+\")\":\"\");}",
    replace: "function foeLabel(foe){return String(foe&&foe.name||\"\");}",
    mustFail: T }
] });
code |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the prompt's combat line stops asking for an unrecorded headcount",
    find: "+(foeGroupUnrecorded(cf)?\" | Headcount: unrecorded", replace: "+(false?\" | Headcount: unrecorded",
    mustFail: T },
  { label: "the prompt's combat line names the foe without its count",
    find: "cbLines.push(\"Enemy: \"+foeLabel(cf)+", replace: "cbLines.push(\"Enemy: \"+cf.name+",
    mustFail: T }
] });
code |= sabotage.prove({ file: "ui-panels.js", command: CMD, cases: [
  { label: "the tracker row names the foe without its count",
    find: "+escHtml(foeLabel(f))+\"</span><div class='hbw'>", replace: "+escHtml(f.name)+\"</span><div class='hbw'>",
    mustFail: T }
] });
code |= sabotage.prove({ file: "ui-mobile.js", command: CMD, cases: [
  { label: "the enemy card shows 'Not recorded' over a recorded count",
    find: "  if(typeof foe.count===\"number\")row(\"Group size\",foe.count);/* #612: the authored headcount */\n  else if(", replace: "  if(",
    mustFail: T }
] });
// The tracker column, in a real browser (the mobile suite): measured from the rendered label, never capped.
code |= sabotage.prove({ file: "ui-panels.js", skip: !chrome.path, command: BROWSER, cases: [
  { label: "the name column is measured from the bare name again: a counted pack is cut to 'Pack (…'",
    find: "+foeLabel(ordered[_mi]));/* #612: the RENDERED label — the count rides it */", replace: "+ordered[_mi].name);",
    mustFail: "a counted pack: the full enemy name shows" },
  { label: "the 45% cap is back: a long name on a phone is cut",
    find: "      _cp.style.setProperty(\"--cnw\",(_mw+2)+\"px\");", replace: "      _cp.style.setProperty(\"--cnw\",Math.min(_mw+2,Math.floor(_cp.clientWidth*0.45)||_mw)+\"px\");",
    mustFail: "a long counted name on a phone: the full enemy name shows" }
] });
if (!chrome.path && !code) { verdict.reportSkip("sabotage-612-group-count.js", 2, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(code);
