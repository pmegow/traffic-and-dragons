// dev/sabotage-6-village-mode.js — proves the #6 phase B (village prompt mode) clauses are guarded: the rule
// substitution in its slot, the preamble variant, the ONE mode gate on the note registry, the combat refusal and its doc
// line, the fourth-button rungs, the whispers resident pool. Disposable clones via sabotage.js; the working tree is
// never mutated.   node dev/sabotage-6-village-mode.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#6 the village"]], cases: cases }); }
prove("api.js", [
  { label: "the rule override is skipped — the village keeps the adventure DRIVE rule",
    find: 'if(_ov)all=all.map(function(r){var k;for(k in _ov)if(String(r).indexOf(k)===0)return _ov[k];return r;});', replace: 'if(false)all=all.map(function(r){return r;});',
    mustFail: "#6B the DRIVE rule is SUBSTITUTED" },
  { label: "the override DELETES the rule instead of filling the slot",
    find: 'if(String(r).indexOf(k)===0)return _ov[k];return r;});', replace: 'if(String(r).indexOf(k)===0)return null;return r;}).filter(function(r){return r!==null;});',
    mustFail: "#6B the DRIVE rule is SUBSTITUTED" },
  { label: "the preamble ignores the kind",
    find: '+(((typeof kindDef==="function")&&kindDef().preamble)||"You are the Game Master for Traffic and Dragons', replace: '+((false)||"You are the Game Master for Traffic and Dragons',
    mustFail: "#6B the stable preamble has a kind variant" },
  { label: "the mode gate is removed from the orchestrator",
    find: '    if(row[campaignKind()]==="silent")continue;', replace: '',
    mustFail: "#6B ONE mode gate" },
  { label: "the mode gate runs AFTER the builder (the latch is consumed by a note the GM never sees)",
    find: '    if(row[campaignKind()]==="silent")continue;/* #6 phase B: ONE mode gate — the kind\'s name is the registry axis; a silent note never runs, so its latch is untouched */\n    if(row.prepare)row.prepare();\n    var snap=snapshotNoteLatches(),n=fn();if(!n)continue;',
    replace: '    if(row.prepare)row.prepare();\n    var snap=snapshotNoteLatches(),n=fn();if(!n)continue;\n    if(row[campaignKind()]==="silent")continue;',
    mustFail: "#6B ONE mode gate" },
  { label: "the commitment observer fires in the village",
    find: 'buildCommitmentNudge:{shape:"one-shot-ask",latch:["commitmentPing"],combat:"silent",village:"silent"', replace: 'buildCommitmentNudge:{shape:"one-shot-ask",latch:["commitmentPing"],combat:"silent",village:"fires"',
    mustFail: "#6B ONE mode gate" },
  { label: "the residents' defining moments are dropped from the whisper pool",
    find: '(resFacts.length?"what the residents here lived through in their own campaigns — "+resFacts.join("; ")+". ":"")+', replace: '',
    mustFail: "#6B whispers in the village" }
]);
prove("tag_table.js", [
  { label: "combat starts in the village",
    find: 'if(typeof kindDef==="function"&&kindDef().noCombat){var _vcs=', replace: 'if(false){var _vcs=',
    mustFail: "#6B combat is refused in the village" },
  { label: "the refusal is silent (no mutation-log line, no warning)",
    find: 'if(_vcs.length){R.muts.push("Combat refused — "+kindDef().combatRefusal);if(typeof console!=="undefined")console.warn("[tags] COMBAT_START refused in the village (no dangers): "+_vcs[0]);}return;', replace: 'return;',
    mustFail: "#6B combat is refused in the village" },
  { label: "the STATE TAGS doc drops the village line",
    find: '+((typeof kindDef==="function"&&kindDef().tagDocNote)||"")', replace: '+""',
    mustFail: "#6B combat is refused in the village" }
]);
prove("game.js", [
  { label: "the montage rung ignores the kind",
    find: 'if(montageDue()){if(kindDef().montage)return', replace: 'if(montageDue()){if(true)return',
    mustFail: "#6B the fourth button in the village" },
  { label: "the wildcard rung ignores the kind",
    find: 'if(kindDef().wildcard&&typeof WILDCARD_EVERY==="number"', replace: 'if(typeof WILDCARD_EVERY==="number"',
    mustFail: "#6B the fourth button in the village" }
]);
process.exit(code);
