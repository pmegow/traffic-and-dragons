// dev/sabotage-538-hero-not-an-npc.js — proves the #538 guards are guarded. The player's exact name is the character
// sheet's. The note, correction, pronoun, party, merge and alias tags filed the hero as an NPC or handed the hero's name (or
// an NPC's name) to the other side; and the two older refusals ([NPC:], a reported death) asked the RESOLVED name only, so
// with "Tess's mother" on file the hero's own name was guessed onto her. After the independent review: the resolver never
// guesses the player's exact name onto anyone, a player-named record is never a candidate for someone else's name, an
// epithet first in an alias tag is the hero's, and a namesake companion can still leave. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-538-hero-not-an-npc.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#538"]];
var code = 0;
function prove(file, cases, cmd) { if (!code) code = sabotage.prove({ file: file, command: cmd || CMD, cases: cases }); }
var REPRO = "#538 the repro", PARTY = "#538 the hero cannot join their own party", MERGE = "#538 a merge that names the hero",
  ALIAS = "#538 the hero's own name or epithet", EPITHET = "#538 the hero cannot take an epithet", RESOLVE = "#538 a name that only resolves", WRITER = "#538 the note writer itself",
  KIN = "#538 the hero's exact name is never guessed onto a relative", FIRST = "#538 an alias tag whose FIRST name", SWAP = "#538 after a hero swap", TITLE = "#538 a title on a companion's sheet",
  NAMESAKE = "#538 a companion who shares the hero's name", TELLS = "#538 the note writer tells its caller";
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
    find: 'if((_pmJoin||!wsNpcByName(resolveNpcName(pmp[1].trim())))&&npcTagRefusesPlayer(pmp[1],_pmJoin?"Party join":"Party leave",R))continue;', replace: '',
    mustFail: PARTY },
  { label: "a namesake companion cannot leave the party",
    find: 'if((_pmJoin||!wsNpcByName(resolveNpcName(pmp[1].trim())))&&npcTagRefusesPlayer(', replace: 'if(npcTagRefusesPlayer(',
    mustFail: NAMESAKE },
  { label: "a refused leave is called a join",
    find: '_pmJoin?"Party join":"Party leave"', replace: '"Party join"',
    mustFail: NAMESAKE },
  { label: "a merge with the hero as the survivor runs",
    find: 'if(npcTagRefusesPlayer(mgCanon,"NPC merge",R)||npcTagRefusesPlayer(mgDupe,"NPC merge",R))continue;', replace: 'if(npcTagRefusesPlayer(mgDupe,"NPC merge",R))continue;',
    mustFail: MERGE },
  { label: "a merge with the hero as the duplicate runs",
    find: 'if(npcTagRefusesPlayer(mgCanon,"NPC merge",R)||npcTagRefusesPlayer(mgDupe,"NPC merge",R))continue;', replace: 'if(npcTagRefusesPlayer(mgCanon,"NPC merge",R))continue;',
    mustFail: MERGE },
  { label: "the hero's name becomes an NPC's alias",
    find: '  if(npcTagRefusesPlayer(alAlias,"NPC alias",R))continue;', replace: '',
    mustFail: ALIAS },
  { label: "an epithet first in an alias tag makes an NPC record",
    find: '  if(memoryNpcNamesPlayer(alCanon)){/* #538 review:', replace: '  if(/^player$/i.test(alCanon)||(_plNm&&alCanon.toLowerCase()===_plNm.toLowerCase())){/* #538 review:',
    mustFail: FIRST },
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
    find: 'if(memoryNpcIsPlayer(k))continue;if(eq(k))return k;', replace: 'if(memoryNpcIsPlayer(k))continue;',
    mustFail: EPITHET },
  { label: "the on-file check skips memory aliases",
    find: 'if(any(memory.npcs[k].aliases))return k;', replace: '',
    mustFail: EPITHET },
  { label: "the on-file check skips roster names",
    find: '    if(eq(ns[j].name))return ns[j].name;\n', replace: '',
    mustFail: EPITHET },
  { label: "the on-file check skips roster aliases",
    find: '    if(any(ns[j].aliases))return ns[j].name;\n', replace: '',
    mustFail: EPITHET },
  { label: "the on-file check is case-sensitive",
    find: 'function eq(v){return String(v||"").trim().toLowerCase()===low;}', replace: 'function eq(v){return String(v||"").trim()===String(name||"").trim();}',
    mustFail: EPITHET },
  { label: "a companion's sheet titles are not on file",
    find: 'if(sh&&(eq(sh.name)||any(sh.aliases)))return ns[j].name;', replace: 'if(sh&&eq(sh.name))return ns[j].name;',
    mustFail: TITLE },
  { label: "the name a companion's sheet is kept under is not on file",
    find: 'if(sh&&(eq(sh.name)||any(sh.aliases)))return ns[j].name;', replace: 'if(sh&&any(sh.aliases))return ns[j].name;',
    mustFail: TITLE },
  { label: "the hero's own older record reads as someone else's name",
    find: 'if(memoryNpcIsPlayer(k))continue;if(eq(k))return k;', replace: 'if(eq(k))return k;',
    mustFail: SWAP },
  { label: "a note written with spaces makes a record of its own",
    find: 'fileNpcEvent(nnp[1].trim(),nnp[2],R.turn)', replace: 'fileNpcEvent(nnp[1],nnp[2],R.turn)',
    mustFail: SWAP },
  { label: "a pronoun written with spaces makes a row of its own",
    find: 'var pname=resolveNpcName(pnp[1].trim()),', replace: 'var pname=resolveNpcName(pnp[1]),',
    mustFail: SWAP }
]);
prove("memory.js", [
  { label: "the hero's exact name is guessed onto the one record that shares a word with it",
    find: '  if(memoryNpcIsPlayer(name))return name;\n', replace: '',
    mustFail: KIN },
  { label: "a relative's name is guessed onto the hero's older record",
    find: 'if(k===name||memoryNpcIsPlayer(k))continue;', replace: 'if(k===name)continue;',
    mustFail: SWAP },
  { label: "the note writer files the hero when called directly",
    find: 'function fileNpcEvent(name,note,turn){if(memoryNpcNamesPlayer(name)){', replace: 'function fileNpcEvent(name,note,turn){if(false){',
    mustFail: WRITER },
  { label: "a filed note tells its caller nothing",
    find: 'never the void (#144A) */return true;}', replace: 'never the void (#144A) */}',
    mustFail: TELLS },
  { label: "only the name as written is the player's (an alias of an older hero record passes)",
    find: '  return memoryNpcIsPlayer(resolveNpcName(String(name||"").trim()));', replace: '  return memoryNpcIsPlayer(String(name||"").trim());',
    mustFail: RESOLVE }
]);
prove("dev/npc-merge-core.js", [
  { label: "the offline merge tool goes on after a refused or ignored merge",
    find: 'if(String(R.muts[nmcMi]).indexOf("Merged: ")===0)nmcMerged=true;', replace: 'nmcMerged=true;',
    mustFail: "a merge the handler REFUSES" }
], ["node", ["dev/tests-538-merge-tool-refusal.js"]]);
process.exit(code ? 1 : 0);
