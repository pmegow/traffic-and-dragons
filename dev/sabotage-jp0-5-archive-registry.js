// sabotage-jp0-5-archive-registry.js — mutation proof for the memory.archive key registry
// (JP0-5, joint review 2026-08-27; Sol P0-03, Fable-verified).
//
// The defect class: FOUR separate hand-copied allowlists enumerated archive categories, and the
// .tnd import one silently destroyed a category four times over (attitudeSpec, eras, the #144A
// trio, npcDeathCorrections — plus relDowngrades, found at the fix). The "full archive" contract
// repeated the same stale list, so each loss shipped green.
//
// The close has two halves and the clauses below prove BOTH:
//   • one registry (MEMORY_ARCHIVE_KEYS, state.js) that blankMemory / healMemory / memArchive /
//     the import rebuild all derive from — no site can drift on its own again;
//   • archiveRebuild CARRYING UNKNOWN CATEGORIES VERBATIM, which is the actual class-closer: the
//     next category round-trips with zero edits anywhere, and today it is already what keeps the
//     dev repair tools' own categories (retconRepairs, repairBundles) inside a save.
//
// ui-files.js is not in the engine manifest, so every clause carries it in `also:` — without that
// the scratch clone would test the working state.js against the COMMITTED import and misattribute
// every result. Each clause must make dev/run-tests.js FAIL on its NAMED assertion; a mutation
// that changes no bytes is a hard failure.
// Usage: node dev/sabotage-jp0-5-archive-registry.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "state.js",
  also: ["ui-files.js"],
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the unknown-category carry is neutered — a future (or dev-tool-written) archive category is destroyed by every .tnd round-trip again",
      mustFail: "carried through VERBATIM",
      find: '    for(k in src){',
      replace: '    for(k in known){' },

    { label: "the registry drops npcDeathCorrections — the death-retraction pre-images lose their blank-shape default (the carry still saves the DATA, which is the design)",
      mustFail: "MEMORY_ARCHIVE_KEYS dropped archive.npcDeathCorrections",
      find: '"identityQuarantines","relDowngrades","npcDeathCorrections"];',
      replace: '"identityQuarantines","relDowngrades"];' },

    { label: "known categories stop being array-guarded — a junk import value becomes archive canon",
      mustFail: "a string survived into a known category",
      find: '      if(known[k]){if(Array.isArray(src[k]))out[k]=src[k];}',
      replace: '      if(known[k]){out[k]=src[k];}' },

    { label: "archiveHeal overwrites instead of filling — a heal wipes the archive it was meant to complete",
      mustFail: "an existing known category was reset by the heal",
      find: '  for(i=0;i<MEMORY_ARCHIVE_KEYS.length;i++){k=MEMORY_ARCHIVE_KEYS[i];if(!arc[k])arc[k]=[];}',
      replace: '  for(i=0;i<MEMORY_ARCHIVE_KEYS.length;i++){k=MEMORY_ARCHIVE_KEYS[i];arc[k]=[];}' },

    { label: "archiveRebuild stops being TOTAL — a save whose archive is missing or junk imports with no archive shape at all",
      mustFail: "produced no archive",
      find: '  var out=blankArchive(),known={},k,i;',
      replace: '  var out=(src&&typeof src==="object")?blankArchive():null,known={},k,i;' },

    { label: "blankMemory re-grows its own archive literal — the birth shape drifts off the registry (the state it was actually in before JP0-5)",
      mustFail: "blankMemory no longer builds its archive from the registry",
      find: 'archive:blankArchive()};',
      replace: 'archive:{lore:[],decisions:[],chapters:[],coreMemories:[],identityQuarantines:[]}};' },

    { label: "healMemory stops routing through the registry — imported and legacy saves lose the categories it used to fill",
      mustFail: "healMemory no longer heals its archive through the registry",
      find: '  memory.archive=archiveHeal(memory.archive);',
      replace: '  if(!memory.archive)memory.archive={lore:[],decisions:[],chapters:[]};' }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  also: ["ui-files.js"],
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "memArchive re-grows its own category list — the lazy-init site drifts off the registry (it was four categories behind before JP0-5)",
      mustFail: "memArchive no longer lazy-inits through the registry",
      find: 'function memArchive(){memory.archive=archiveHeal(memory.archive);return memory.archive;}',
      replace: 'function memArchive(){if(!memory.archive)memory.archive={lore:[],decisions:[],chapters:[]};if(!memory.archive.lore)memory.archive.lore=[];if(!memory.archive.decisions)memory.archive.decisions=[];if(!memory.archive.chapters)memory.archive.chapters=[];return memory.archive;}' }
  ]
});

rc |= sabotage.prove({
  file: "ui-files.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the .tnd import goes back to a hand-rolled rebuild — the exact shape that dropped a category four separate times",
      mustFail: "no longer rebuilds its archive through archiveRebuild",
      find: 'archive:archiveRebuild(mm.archive)};',
      replace: 'archive:mm.archive?{lore:mm.archive.lore||[],decisions:mm.archive.decisions||[],chapters:mm.archive.chapters||[]}:{lore:[],decisions:[],chapters:[]}};' },

    { label: "the import keeps archiveRebuild but starts hand-patching a category beside it — the whitelist creeping back in one key at a time",
      mustFail: "enumerates archive categories by hand again",
      find: 'archive:archiveRebuild(mm.archive)};',
      replace: 'archive:archiveRebuild(mm.archive)};if(mm.archive)memory.archive.lore=mm.archive.lore||[];' }
  ]
});

process.exit(rc ? 1 : 0);
