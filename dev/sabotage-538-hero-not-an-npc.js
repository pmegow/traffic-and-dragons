// dev/sabotage-538-hero-not-an-npc.js — proves the #538 guards are guarded. [NPC:] and [NPC_DEATH_REPORTED:] always refused the
// hero's name; the note, correction, pronoun, party, merge and alias tags did not, and each filed the hero as an NPC or handed
// the hero's name (or an NPC's name) to the other side. Each mutation runs in a disposable clone.
//   node dev/sabotage-538-hero-not-an-npc.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#538"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#538 the repro", PARTY = "#538 the hero cannot join their own party", MERGE = "#538 a merge that names the hero",
  ALIAS = "#538 the hero's own name or epithet", EPITHET = "#538 the hero cannot take an epithet", RESOLVE = "#538 a name that only resolves", WRITER = "#538 the note writer itself";
prove("tag_table.js", [
  { label: "a note for the hero is refused without a word in the summary",
    find: 'if(nnp&&!npcTagRefusesPlayer(nnp[1],"NPC note",R))fileNpcEvent(', replace: 'if(nnp)fileNpcEvent(',
    mustFail: REPRO },
  { label: "a correction files the hero as an NPC",
    find: 'if(npcTagRefusesPlayer(spp[1],"NPC correction",R))continue;', replace: '',
    mustFail: REPRO },
  { label: "a pronoun files the hero as an NPC",
    find: 'if(pnp&&!npcTagRefusesPlayer(pnp[1],"NPC pronoun",R)){', replace: 'if(pnp){',
    mustFail: REPRO },
  { label: "the hero joins their own party",
    find: 'if(npcTagRefusesPlayer(pmp[1],"Party join",R))continue;', replace: '',
    mustFail: PARTY },
  { label: "a merge with the hero as the survivor runs",
    find: 'if(npcTagRefusesPlayer(mgCanon,"NPC merge",R)||npcTagRefusesPlayer(mgDupe,"NPC merge",R))continue;', replace: 'if(npcTagRefusesPlayer(mgDupe,"NPC merge",R))continue;',
    mustFail: MERGE },
  { label: "a merge with the hero as the duplicate runs",
    find: 'if(npcTagRefusesPlayer(mgCanon,"NPC merge",R)||npcTagRefusesPlayer(mgDupe,"NPC merge",R))continue;', replace: 'if(npcTagRefusesPlayer(mgCanon,"NPC merge",R))continue;',
    mustFail: MERGE },
  { label: "the hero's name becomes an NPC's alias",
    find: '  if(npcTagRefusesPlayer(alAlias,"NPC alias",R))continue;', replace: '',
    mustFail: ALIAS },
  { label: "an epithet that is an NPC's name is earned",
    find: 'if(_epOwner){if(typeof console', replace: 'if(false){if(typeof console',
    mustFail: EPITHET },
  { label: "a refusal leaves no line in the turn's summary",
    find: '  R.muts.push("⚠ "+what+" refused (player): "+nm);\n', replace: '',
    mustFail: REPRO },
  { label: "a refusal leaves no line on the console",
    find: '  if(typeof console!=="undefined")console.warn("[tags] "+what+" for the player \'"+nm+"\' refused: the hero is not an NPC record (#538)");\n', replace: '',
    mustFail: REPRO },
  { label: "the on-file check skips memory names",
    find: 'for(k in memory.npcs){if(eq(k))return k;a=', replace: 'for(k in memory.npcs){a=',
    mustFail: EPITHET },
  { label: "the on-file check skips memory aliases",
    find: 'a=memory.npcs[k].aliases||[];for(i=0;i<a.length;i++)if(eq(a[i]))return k;}', replace: '}',
    mustFail: EPITHET },
  { label: "the on-file check skips roster names",
    find: 'if(eq(ns[j].name))return ns[j].name;a=', replace: 'a=',
    mustFail: EPITHET },
  { label: "the on-file check skips roster aliases",
    find: 'a=ns[j].aliases||[];for(i=0;i<a.length;i++)if(eq(a[i]))return ns[j].name;}', replace: '}',
    mustFail: EPITHET },
  { label: "the on-file check is case-sensitive",
    find: 'function eq(v){return String(v||"").trim().toLowerCase()===low;}', replace: 'function eq(v){return String(v||"").trim()===String(name||"").trim();}',
    mustFail: EPITHET }
]);
prove("memory.js", [
  { label: "the note writer files the hero when called directly",
    find: 'function fileNpcEvent(name,note,turn){if(memoryNpcNamesPlayer(name)){', replace: 'function fileNpcEvent(name,note,turn){if(false){',
    mustFail: WRITER },
  { label: "only the name as written is checked (an alias of an old hero record passes)",
    find: '  return memoryNpcIsPlayer(nm)||memoryNpcIsPlayer(resolveNpcName(nm));', replace: '  return memoryNpcIsPlayer(nm);',
    mustFail: RESOLVE },
  { label: "only the resolved name is checked (the hero's name passes where an old alias points it elsewhere)",
    find: '  return memoryNpcIsPlayer(nm)||memoryNpcIsPlayer(resolveNpcName(nm));', replace: '  return memoryNpcIsPlayer(resolveNpcName(nm));',
    mustFail: RESOLVE }
]);
process.exit(code ? 1 : 0);
