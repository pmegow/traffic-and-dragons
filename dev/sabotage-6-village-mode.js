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
  { label: "#6 D5 the small-talk note lets today's facts vanish (a resident present, no weather, no hour in the pool)",
    find: 'var _wph=(typeof clockPhaseLabelAt==="function")?clockPhaseLabelAt():"";if(_wph)resFacts.push("the hour — "+_wph);', replace: 'var _wph="";',
    mustFail: "#6B village whispers are about ANYONE here" }
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
    mustFail: "#6B combat is refused in the village" },
  /* the peace of Pax (owner, 2026-09-12) */
  { label: "Pax never intercedes — the harm helper always says no refusal",
    find: 'function __villageHarmRefused(R,label,sample){if(typeof kindDef!=="function"||!kindDef().noHarm)return false;', replace: 'function __villageHarmRefused(R,label,sample){if(true)return false;',
    mustFail: "#6B PAX" },
  { label: "the refusal is silent (no mutation-log line for the player)",
    find: 'R.muts.push("Harm refused — "+kindDef().harmRefusal);if(typeof console!=="undefined")console.warn("[tags] "+label+" refused in the village (Pax): "+sample);return true;', replace: 'return true;',
    mustFail: "#6B PAX" },
  { label: "hero HP loss lands in the village (the HP gate is removed)",
    find: 'return !(d<0&&__villageHarmRefused(R,"HP",h));', replace: 'return true;',
    mustFail: "#6B PAX" },
  { label: "a reported NPC death is not refused in the village",
    find: 'if(rdTags.length&&__villageHarmRefused(R,"NPC_DEATH_REPORTED",rdTags[0]))return;', replace: '',
    mustFail: "#6B PAX" }
]);
prove("identity.js", [
  { label: "a death envelope passes the W2 gate in the village",
    find: 'else if(meta.claim==="npc-death"&&typeof kindDef==="function"&&kindDef().noHarm)reason="the peace of Pax: "+kindDef().harmRefusal;', replace: '',
    mustFail: "#6B PAX" }
]);
prove("api.js", [
  { label: "village small talk is pointed back at the party (the D5 branch ignores the kind's subject)",
    find: 'pass a remark — "+kindDef().whisperSubject+_wsrc.join(" or ")', replace: 'pass a remark — "+"what is said about the party — "+_wsrc.join(" or ")',
    mustFail: "#6B village whispers are about ANYONE here" }
]);
prove("api.js", [
  { label: "#6 D5 the whisper facts fall back to the residents' defining moments",
    find: 'var resFacts=[];if(_wpool&&!_wsmall){', replace: 'var resFacts=[];if(_wpool){',
    mustFail: "#6B village whispers are about ANYONE here" },
  { label: "#6 D5 the small-talk note loses its Hall clause",
    find: 'that talk belongs to the Hall. Emit [WHISPER:one sentence of what was said]', replace: 'Emit [WHISPER:one sentence of what was said]',
    mustFail: "#6B village whispers are about ANYONE here" },
  { label: "#6 D5 the exchange seeds from the past again",
    find: 'if(kindDef().smallTalk){/* #6 D5', replace: 'if(false){/* #6 D5',
    mustFail: "#6D2 one exchange between two residents" }
]);
prove("data.js", [
  { label: "#6 D5 the DRIVE rule drops NEIGHBOURS TALK SMALL",
    find: ' NEIGHBOURS TALK SMALL: a resident who meets the hero', replace: ' NEIGHBOURS: a resident who meets the hero',
    mustFail: "#6 D5 neighbours talk small" }
]);
prove("game.js", [
  { label: "the village rung branch is skipped — the village falls through to the adventure's montage/wildcard ladder (v1.914 made the two old clauses dead: the rung branch returns before those lines run)",
    find: 'if(typeof kindDef==="function"&&kindDef().villageRung){', replace: 'if(false){',
    mustFail: "#6D1 the village rung sits ABOVE buy" }
]);
process.exit(code);
