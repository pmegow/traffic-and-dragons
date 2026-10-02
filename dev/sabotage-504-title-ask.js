// dev/sabotage-504-title-ask.js — proves the #504 guards are guarded (owner ruling 2026-10-01: ask the GM). A kin or rank
// title plus a surname only ("Queen Underbough"), landing on the one record that has a given name and does not carry that
// title ("Wilhelmina Underbough"), used to merge in silence — the residue of #503. The scan now reports the question, the
// [NPC:] boundary files the name provisionally under the name as called, and the #156 note asks "the same person, or
// another?". Offices, carried titles, given names and registered aliases keep merging. Each mutation runs in a disposable clone.
//   node dev/sabotage-504-title-ask.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#504"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#504 the repro", NOTE = "#504 the note asks", OTHER = "#504 ANOTHER person", NOT = "#504 who is NOT asked",
  TABLE = "#504 the table", OPEN = "#504 while the question is open", READ = "#504 readers are unchanged", CALLED = "#504 the answer may name her as she was called";
prove("memory.js", [
  { label: "the scan never reports the question (the reported merge)",
    find: 'if(match)out.ask=npcTitleQuestion(name,match,inCore);', replace: '',
    mustFail: REPRO },
  { label: "a title with a GIVEN name is asked about",
    find: 'if(inCore.length!==1||kCore.length<2||kCore[kCore.length-1]!==inCore[0])return "";', replace: 'if(inCore.length!==1||kCore.length<2)return "";',
    mustFail: NOT },
  { label: "a name of two distinctive words counts as a bare family name",
    find: 'if(inCore.length!==1||kCore.length<2||kCore[kCore.length-1]!==inCore[0])return "";', replace: 'if(kCore.length<2||kCore[kCore.length-1]!==inCore[0])return "";',
    mustFail: READ },
  { label: "a record with no given name is asked about",
    find: 'if(inCore.length!==1||kCore.length<2||kCore[kCore.length-1]!==inCore[0])return "";', replace: 'if(inCore.length!==1||kCore[kCore.length-1]!==inCore[0])return "";',
    mustFail: NOT },
  { label: "a title word after the family name counts as a title",
    find: 'for(i=0;i<at;i++)if(_NPC_ASK_TITLES[ws[i]]===1&&!known[ws[i]])return ws[i];', replace: 'for(i=0;i<ws.length;i++)if(_NPC_ASK_TITLES[ws[i]]===1&&!known[ws[i]])return ws[i];',
    mustFail: READ },
  { label: "a title the record already carries is asked about",
    find: 'for(i=0;i<at;i++)if(_NPC_ASK_TITLES[ws[i]]===1&&!known[ws[i]])return ws[i];', replace: 'for(i=0;i<at;i++)if(_NPC_ASK_TITLES[ws[i]]===1)return ws[i];',
    mustFail: NOT },
  { label: "the record's memory aliases are not read",
    find: 'all=[k].concat(m.aliases||[],(w&&w.aliases)||[])', replace: 'all=[k].concat((w&&w.aliases)||[])',
    mustFail: NOT },
  { label: "the record's roster aliases are not read",
    find: 'all=[k].concat(m.aliases||[],(w&&w.aliases)||[])', replace: 'all=[k].concat(m.aliases||[])',
    mustFail: READ },
  { label: "a ruled title leaves the table",
    find: 'var _NPC_ASK_TITLES=npcWordTable({king:1,queen:1,prince:1,', replace: 'var _NPC_ASK_TITLES=npcWordTable({king:1,prince:1,',
    mustFail: REPRO },
  { label: "an office joins the table",
    find: 'var _NPC_ASK_TITLES=npcWordTable({king:1,queen:1,prince:1,', replace: 'var _NPC_ASK_TITLES=npcWordTable({sheriff:1,king:1,queen:1,prince:1,',
    mustFail: NOT },
  { label: "a title consolidation never drops joins the table (a dead entry)",
    find: 'var _NPC_ASK_TITLES=npcWordTable({king:1,queen:1,prince:1,', replace: 'var _NPC_ASK_TITLES=npcWordTable({duke:1,king:1,queen:1,prince:1,',
    mustFail: TABLE },
  { label: "an exact name is asked about on every tag",
    find: 'if(!memory.npcs||memory.npcs[name]||npcAliasOwner(name))return "";', replace: 'if(!memory.npcs||npcAliasOwner(name))return "";',
    mustFail: OTHER },
  { label: "a registered alias is asked about",
    find: 'if(!memory.npcs||memory.npcs[name]||npcAliasOwner(name))return "";', replace: 'if(!memory.npcs||memory.npcs[name])return "";',
    mustFail: NOT }
]);
prove("identity.js", [
  { label: "the [NPC:] boundary never asks",
    find: 'var title=(typeof npcTitleAsk==="function")?npcTitleAsk(rawName):"";', replace: 'var title="";',
    mustFail: REPRO },
  { label: "the #156 immunities shield a titled name (introduction-shaped tags only)",
    find: 'if(!title){/* the #156 predicate', replace: 'if(true){/* the #156 predicate',
    mustFail: REPRO },
  { label: "an open question is split again",
    find: 'if(mem.provisional)return resolved;/* #504', replace: '/* #504',
    mustFail: OPEN },
  { label: "the provisional is keyed by the relative's name, not the name as called",
    find: 'var key=(title?rawName:resolved)+" °t"+R.turn;', replace: 'var key=resolved+" °t"+R.turn;',
    mustFail: REPRO },
  { label: "the provisional does not carry the name it was called by",
    find: 'aliases:title?[rawName]:[],provisional:', replace: 'aliases:[],provisional:',
    mustFail: REPRO },
  { label: "the stamp forgets what she was called",
    find: 'provisional:title?{of:resolved,turn:R.turn,called:rawName}:{of:resolved,turn:R.turn}};', replace: 'provisional:{of:resolved,turn:R.turn}};',
    mustFail: REPRO },
  { label: "the summary does not name the person she may be",
    find: "+(title?\" may be \"+resolved+\" under a title, or another person —\":\"\")+", replace: "+",
    mustFail: REPRO },
  { label: "the merge gate does not hear the name she was called by",
    find: 'duplicate=npcProvisionalOperand(duplicate);/* #504', replace: '/* #504',
    mustFail: CALLED },
  { label: "an established person's alias is read as a provisional",
    find: 'return (own&&memory.npcs[own].provisional)?own:name;', replace: 'return own?own:name;',
    mustFail: CALLED },
  { label: "the note keeps the introduction wording for a title",
    find: '  if(pv.called)return "[ENGINE NOTE — NAME COLLISION', replace: '  if(!pv.called)return "[ENGINE NOTE — NAME COLLISION',
    mustFail: NOTE }
]);
prove("tag_table.js", [
  { label: "the merge handler does not hear the name she was called by",
    find: 'mgDupe=npcProvisionalOperand(mgp[2].trim());', replace: 'mgDupe=mgp[2].trim();',
    mustFail: CALLED },
  { label: "a record becomes its own alias",
    find: 'if(mgals[mgali]!==mgCanon&&memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)', replace: 'if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)',
    mustFail: OTHER }
]);
process.exit(code ? 1 : 0);
