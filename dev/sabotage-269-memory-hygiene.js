// sabotage-269-memory-hygiene.js — mutation proof for the #269 memory-hygiene family
// (Fable f37+f38+f39+f42+f43, joint review 2026-08-27).
//
// The guards being proven: ① NPC knowledge files through ONE helper (fileNpcKnowledge) whose
// near-dup fold keeps the richer text (or the SUPERSEDING text in preferNew mode), archives the
// loser WITH its winner named, is loud, and still archives its cap eviction — the NPC_SUPERSEDE
// tag path included, whose old inline cap shift went to the VOID. ② The NPC graph suppresses a
// legacy player link edge when a live W7 bond exists for the pair (the #61 rival-claim class).
// ③ MEMORY DIRECTORY never serves raw storage keys — pipe paths render " — ", tombstoned keys
// resolve away. ④⑤ The futureEvents and lore folds are LOUD and archive what they swallow.
//
// Every clause breaks exactly one obligation and names the assertion that must catch it, so a
// mutation caught by an unrelated red reports MISATTRIBUTED rather than passing as coverage.
//
// Usage: node dev/sabotage-269-memory-hygiene.js
var sabotage = require("./sabotage.js");
var rc = 0;
var CMD = ["node", ["dev/run-tests.js"]];

rc |= sabotage.prove({
  file: "memory.js",
  command: CMD,
  cases: [
    { label: "the knowledge fold stops archiving its loser — a wrong fold on distinct facts becomes unrecoverable (#269①)",
      mustFail: "fileNpcKnowledge's fold no longer archives the losing fact",
      find: "      memArchive().npcKnowledge.push({npc:name,fact:lose,turn:turn,foldedInto:win.slice(0,200)});",
      replace: "" },

    { label: "the knowledge fold goes silent — paraphrase twins collapse with no console trace (#269①)",
      mustFail: "the fold was silent",
      find: "      if(typeof console!==\"undefined\")console.info(\"[memory] knowledge fold on \"",
      replace: "      if(false)console.info(\"[memory] knowledge fold on \"" },

    { label: "preferNew is inverted to richer-wins — a verbose stale claim beats the reveal that supersedes it (#269①)",
      mustFail: "richer-wins kept the STALE fact",
      find: "      var win=preferNew?f:(f.length>ex.length?f:ex),lose=(win===f)?ex:f;",
      replace: "      var win=(f.length>ex.length?f:ex),lose=(win===f)?ex:f;" },

    { label: "the graph bond precedence is dropped — the legacy edge serves beside the W7 bond as a rival claim again (#269②)",
      mustFail: "stale legacy edge still serves beside the bond",
      find: "    if((edges[i].a===player&&bonded[edges[i].b])||(edges[i].b===player&&bonded[edges[i].a]))continue;",
      replace: "    if(false)continue;" },

    { label: "TOC key resolution is dropped — a tombstoned key serves under its dead name again (#269③)",
      mustFail: "tombstoned key still served under its dead name",
      find: "      var _lkR=(typeof locResolve===\"function\")?locResolve(lk[_vk]):lk[_vk];",
      replace: "      var _lkR=lk[_vk];" },

    { label: "TOC pipe rendering is dropped — raw storage keys teach the GM key syntax again (#269③)",
      mustFail: "raw pipe key served to the GM",
      find: "      var _lkD=_lkP<0?_lkLeaf:_lkR.slice(0,_lkP).split(\"|\").join(\" — \")+\" — \"+_lkLeaf;",
      replace: "      var _lkD=_lkR;" },

    { label: "the pending-event fold stops archiving what it swallows — a distinct thread dies traceless again (#269④)",
      mustFail: "swallowed thread not archived",
      find: "      memArchive().futureEvents.push({when:when,who:who||\"\",what:what,setTurn:setTurn,foldedInto:String(ex.what).slice(0,200)});",
      replace: "" },

    { label: "the pending-event fold goes silent (#269④)",
      mustFail: "the fold stayed silent",
      find: "      if(typeof console!==\"undefined\")console.info(\"[memory] pending-event fold: \\\"\"",
      replace: "      if(false)console.info(\"[memory] pending-event fold: \\\"\"" },

    { label: "the lore fold is disabled — reworded twins evict distinct old lore into the dead archive again (#269⑤)",
      mustFail: "twin filed beside the original",
      find: "    if(feNearDup(fact,memory.lore[i])){",
      replace: "    if(false){" }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: CMD,
  cases: [
    { label: "NPC_SUPERSEDE reverts to its inline write — the cap shift sheds knowledge to the VOID again (#269①/#144A)",
      mustFail: "bare knowledge.shift() in tag_table.js",
      find: "  fileNpcKnowledge(spName,spNew,R.turn,true);",
      replace: "  if(!spNpc.knowledge)spNpc.knowledge=[];if(spNpc.knowledge.indexOf(spNew)<0){spNpc.knowledge.push(spNew);if(spNpc.knowledge.length>12)spNpc.knowledge.shift();}" }
  ]
});

process.exit(rc ? 1 : 0);
