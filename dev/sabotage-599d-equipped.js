// dev/sabotage-599d-equipped.js — proves #599 release (d) is guarded: the EQUIPPED handler and its permanent WORN alias, the
// equip/unequip words, the receipts' stems, the strip entry, the doc line, the Equipped: prompt label, the counter's wording
// (decision 7) and the ◆ mark (§3.5).
//   node dev/sabotage-599d-equipped.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (d"]];/* matches "#599 (d)" and "#599 (d2)" — the d2 closures ride this battery */
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
    find: "{t:\"EQUIPPED\",apply:function(text,R){__tagNearMiss(", replace: "{t:\"WORN\",apply:function(text,R){__tagNearMiss(",
    mustFail: G3 },
  { label: "the EQUIPPED near-miss is no longer registered (a two-field tag vanishes again)",
    find: "__tagNearMiss(text,R,\"EQUIPPED\",\"^\\\\[EQUIPPED:[^|\\\\]]+\\\\|[^|\\\\]]+\\\\|[^\\\\]]+\\\\]$\",\"[EQUIPPED:Name|item|on/off]\");", replace: "",
    mustFail: "#599d2 review 6" },
  { label: "an uncarried item is refused without a ⚠ line again",
    find: "if(wr.reason===\"not carried\")R.muts.push(", replace: "if(false)R.muts.push(",
    mustFail: "#599d2 review 6" },
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
prove("inventory.js", [
  { label: "the READ resolver (_invEntryFind: invHolds, isWorn, resolveInventoryName) loses its unique base-name step (d2 review 4b)",
    find: "  if(hits.length===1)return hits[0];\n  _invLastMiss=", replace: "  _invLastMiss=",
    mustFail: "#599d2 review 4b" },
  { label: "wornSet forgets the spelling the GM used (the console says WORN for an [EQUIPPED:] refusal)",
    find: "function wornSet(cs,item,on,who,tag){tag=tag||\"EQUIPPED\";", replace: "function wornSet(cs,item,on,who,tag){tag=\"WORN\";",
    mustFail: "#599d2 review 6" }
]);
prove("dev/battery-targets.js", [
  { label: "the sweep stops reading the prove(\"file\", …) wrapper (78 batteries go invisible again)",
    find: "  while ((m = wrapped.exec(src))) add(m[2]);", replace: "",
    mustFail: "#599d2 review 4" }
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
  { label: "the panel drops the small (equipped) word after the name (owner 2026-10-10)",
    find: "+invItemHtml(row.name,row.qty)+(eqp?invEquippedTailHtml():'')+'</div>'", replace: "+invItemHtml(row.name,row.qty)+'</div>'",
    mustFail: "#599d3" },
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
  { label: "the sheet's category headings shrink back to the size that got lost (owner 2026-10-10)",
    find: ".cs-inv-cat{margin:9px 0 3px;font-size:16px;", replace: ".cs-inv-cat{margin:9px 0 3px;font-size:10.5px;",
    mustFail: "#599d3" },
  { label: "the equipped name loses its bright tone",
    find: ".ii.eqp,.inv-name.eqp{color:var(--t0)}", replace: ".ii.eqp,.inv-name.eqp{color:var(--t1)}",
    mustFail: MARK },
  { label: "the .eqp rule moves ahead of .ii.gear (an equipped weapon reads in the gear accent, not --t0)",
    find: ".ii.gear{border-color:var(--blue);color:var(--acc)}\n.ii.eqp,.inv-name.eqp{color:var(--t0)}", replace: ".ii.eqp,.inv-name.eqp{color:var(--t0)}\n.ii.gear{border-color:var(--blue);color:var(--acc)}",
    mustFail: MARK }
]);
process.exit(code);
