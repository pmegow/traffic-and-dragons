// dev/sabotage-481-a7-refusal-glyph.js — proves the #481 A7 guards are guarded: a refusal is marked with a leading ⚠ where
// it is WRITTEN, everything that sorts refusals keys on that glyph (never the words), the renderer changes only glyph
// lines, and an arrival prints one "Sub:" line. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-a7-refusal-glyph.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 A7"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the predicate keys on the words again",
    find: "function mutLineWarns(line){return line!=null&&String(line).indexOf(MUT_WARN_GLYPH)===0;}", replace: "function mutLineWarns(line){return line!=null&&/refused|kept|SKIPPED/i.test(String(line));}",
    mustFail: "the renderer marks a glyph line" },
  { label: "a glyph anywhere counts (a clamped receipt reads as a refusal)",
    find: "function mutLineWarns(line){return line!=null&&String(line).indexOf(MUT_WARN_GLYPH)===0;}", replace: "function mutLineWarns(line){return line!=null&&String(line).indexOf(MUT_WARN_GLYPH)>=0;}",
    mustFail: "the renderer marks a glyph line" },
  { label: "the renderer draws a refusal like routine news",
    find: "    if(mutLineWarns(line)){out.push(\"<span class=\\\"sum-warn\\\">\"+escHtml(line)+\"</span>\");continue;}/* #481 A7: only a glyph line changes */\n", replace: "",
    mustFail: "the renderer marks a glyph line" }
]);
prove("tag_table.js", [
  { label: "a stash refusal loses its glyph",
    find: "R.muts.push(\"⚠ Stash refused — \"+_lnm+\" (\"", replace: "R.muts.push(\"Stash refused — \"+_lnm+\" (\"",
    mustFail: "#481 A7 source" },
  { label: "the village XP refusal loses its glyph (the runtime test sees it too)",
    find: "R.muts.push(\"⚠ XP refused — the village pays nothing (kind: village)\");", replace: "R.muts.push(\"XP refused — the village pays nothing (kind: village)\");",
    mustFail: "the village's refusals and the adventure's lead with the glyph" },
  { label: "an arrival prints its Sub line twice again",
    find: "      fileSubLocation(e.name,R.turn,e.world);\n      R.muts.push(", replace: "      fileSubLocation(e.name,R.turn,e.world);R.muts.push(\"Sub: \"+e.name);\n      R.muts.push(",
    mustFail: "one Sub line per arrival" }
]);
prove("identity.js", [
  { label: "the same-turn bond duplicate loses its glyph",
    find: "R.muts.push(\"⚠ Bond change NOT confirmed (same-response duplicate): \"", replace: "R.muts.push(\"Bond change NOT confirmed (same-response duplicate): \"",
    mustFail: "#481 A7 source" }
]);
prove("api.js", [
  { label: "the duplicate-grant warning is pushed bare (a push with no words of its own)",
    find: "if(R&&R.muts)R.muts.push(\"⚠ \"+msg);", replace: "if(R&&R.muts)R.muts.push(msg);",
    mustFail: "#481 A7 source" }
]);
prove("game.js", [
  { label: "the chest reaches the parser again (#597: the player's hand never does)",
    find: "  var R=ledgerApply(plan,{key:cat.key}),muts=R.muts,refused=R.ok?[]:[R.reason];/* #597 */", replace: "  var R=ledgerApply(plan,{key:cat.key}),muts=R.muts,refused=R.ok?[]:[R.reason];if(false)applyMuts(\"\");",
    mustFail: "the consumers that sort refusals" }
]);
prove("ui-modals.js", [
  { label: "the sheet sync collects only lines that shout REFUSED",
    find: "if(mutLineWarns(_lm[_li]))notes.push(String(_lm[_li]));}/* #481 A7: the glyph marks a refusal */", replace: "if(/REFUSED/i.test(String(_lm[_li])))notes.push(String(_lm[_li]));}",
    mustFail: "the consumers that sort refusals" }
]);
process.exit(code);
