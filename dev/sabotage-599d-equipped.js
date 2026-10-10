// dev/sabotage-599d-equipped.js — proves #599 release (d) is guarded: the EQUIPPED handler and its permanent WORN alias, the
// equip/unequip words, the receipts' stems, the strip entry, the doc line, the Equipped: prompt label, the counter's wording
// (decision 7) and the ◆ mark (§3.5).
//   node dev/sabotage-599d-equipped.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (d)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var G3 = "#599d gate 3", STRIP = "#599d the strip and the scan", LINE = "#599d the prompt line", COUNTER = "#599d the counter and the chest", MARK = "#599d §3.5 the equipped mark";
prove("tag_table.js", [
  { label: "the WORN alias is dropped from the handler's match (a [WORN:] reply loses its equip in silence)",
    find: "text.match(/\\[(?:WORN|EQUIPPED):([^|\\]]+)\\|([^|\\]]+)\\|([^\\]]+)\\]/g)", replace: "text.match(/\\[(?:EQUIPPED):([^|\\]]+)\\|([^|\\]]+)\\|([^\\]]+)\\]/g)",
    mustFail: G3 },
  { label: "'equip' is no longer an on-word",
    find: "/^(on|donned|worn|wear|equipped|equip|true|yes)$/i", replace: "/^(on|donned|worn|wear|equipped|true|yes)$/i",
    mustFail: G3 },
  { label: "'unequip' is no longer an off-word",
    find: "/^(off|doffed|removed|remove|unequipped|unequip|false|no)$/i", replace: "/^(off|doffed|removed|remove|unequipped|false|no)$/i",
    mustFail: G3 },
  { label: "the receipts go back to 'wears' / 'removes'",
    find: "(wOn?\" equips \":\" takes off \")", replace: "(wOn?\" wears \":\" removes \")",
    mustFail: G3 },
  { label: "the handler re-registers under WORN (the taught name has no handler of record)",
    find: "{t:\"EQUIPPED\",apply:function(text,R){var wt=", replace: "{t:\"WORN\",apply:function(text,R){var wt=",
    mustFail: G3 },
  { label: "EQUIPPED leaves the strip registry (the tag would print in the story)",
    find: "\"WORN\",\"EQUIPPED\",\"OUTFIT\"", replace: "\"WORN\",\"OUTFIT\"",
    mustFail: STRIP },
  { label: "the doc teaches WORN again",
    find: "\"[EQUIPPED:Name|item|on] / [EQUIPPED:Name|item|off] -- ", replace: "\"[WORN:Name|item|on] / [WORN:Name|item|off] -- ",
    mustFail: STRIP },
  { label: "the doc line ends 'as Wearing:' again",
    find: "serves both back on the sheet as Equipped: -- keep", replace: "serves both back on the sheet as Wearing: -- keep",
    mustFail: STRIP }
]);
prove("api.js", [
  { label: "the prompt label reverts to Wearing:",
    find: "return \"Equipped: \"+(w.length?w.join(\", \"):\"no gear\")", replace: "return \"Wearing: \"+(w.length?w.join(\", \"):\"no gear\")",
    mustFail: LINE }
]);
prove("helpers.js", [
  { label: "the counter's row says 'Worn — take it off first' again",
    find: "offReason:r.worn?\"Equipped \\u2014 unequip it first\":(r.sellCp==null?", replace: "offReason:r.worn?\"Worn \\u2014 take it off first\":(r.sellCp==null?",
    mustFail: COUNTER },
  { label: "the chest's row says 'Worn — take it off first' again",
    find: "offReason:r.worn?\"Equipped \\u2014 unequip it first\":\"\",tag:\"\",hint:\"Stow it in the house\"", replace: "offReason:r.worn?\"Worn \\u2014 take it off first\":\"\",tag:\"\",hint:\"Stow it in the house\"",
    mustFail: COUNTER },
  { label: "the mark loses its screen-reader word",
    find: "role=\"img\" aria-label=\"'+INV_EQUIPPED_WORD.toLowerCase()+'\"", replace: "role=\"img\"",
    mustFail: MARK },
  { label: "the mark prints the word in the row instead of the glyph",
    find: "+INV_EQUIPPED_GLYPH+'</span> ';", replace: "+'equipped</span> ';",
    mustFail: MARK }
]);
prove("ui-panels.js", [
  { label: "the panel drops the mark",
    find: "+(eqp?invEquippedMarkHtml():'')+invItemHtml(row.name,row.qty)", replace: "+invItemHtml(row.name,row.qty)",
    mustFail: MARK },
  { label: "the panel drops the .eqp class (an equipped name stays dim)",
    find: "+(eqp?' eqp':'')+'\" data-item=\"'+escHtml(row.text)", replace: "+'\" data-item=\"'+escHtml(row.text)",
    mustFail: MARK },
  { label: "the panel's tooltip loses the word",
    find: "+(eqp?\"\\n\"+INV_EQUIPPED_WORD:\"\"))+'\">'", replace: ")+'\">'",
    mustFail: MARK }
]);
prove("ui-sheets.js", [
  { label: "the sheet drops the mark",
    find: "+(_eqp?invEquippedMarkHtml():'')+invItemHtml(_row.name,_row.qty)", replace: "+invItemHtml(_row.name,_row.qty)",
    mustFail: MARK },
  { label: "the sheet drops the .eqp class",
    find: "+(_marked?' inv-marked':'')+(_eqp?' eqp':'')+'\"", replace: "+(_marked?' inv-marked':'')+'\"",
    mustFail: MARK }
]);
prove("index.html", [
  { label: "the equipped name loses its bright tone",
    find: ".ii.eqp,.inv-name.eqp{color:var(--t0)}", replace: ".ii.eqp,.inv-name.eqp{color:var(--t1)}",
    mustFail: MARK },
  { label: "the .eqp rule moves ahead of .ii.gear (an equipped weapon reads in the gear accent, not --t0)",
    find: ".ii.gear{border-color:var(--blue);color:var(--acc)}\n.ii.eqp,.inv-name.eqp{color:var(--t0)}", replace: ".ii.eqp,.inv-name.eqp{color:var(--t0)}\n.ii.gear{border-color:var(--blue);color:var(--acc)}",
    mustFail: MARK }
]);
process.exit(code);
