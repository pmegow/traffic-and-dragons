// dev/sabotage-534-provisional-key.js — proves the #534 guards are guarded. Found by the independent review of #504/#530: a
// provisional's own key ("Queen Underbough °t85") took part in name resolution. Counted as a consolidation candidate it made
// the family name ambiguous (forks while a question was open; a short SAME answer read as a free name and landed as a twin);
// only the exact called name reached it; after the answer the key resolved to the wrong person or to a new record; and the
// gate judged the resolved canonical while the handler created the raw one. Each mutation runs in a disposable clone.
//   node dev/sabotage-534-provisional-key.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#534"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var OPEN = "#534 while the question is open", SAME = "#534 the SAME answer under a short or loose form", UNCLEAR = "#534 an answer the names cannot settle",
  AFTER = "#534 after the answer", HERO = "#534 nobody is merged into the hero", PROPOSAL = "#534 a proposal names real records";
prove("memory.js", [
  { label: "a provisional's key counts as a second family member (the reported forks)",
    find: 'if(memory.npcs[k].provisional)continue;/* #534', replace: '/* #534',
    mustFail: OPEN },
  { label: "only the exact called name finds the open question",
    find: '  var open=npcOpenQuestion(name);if(open)return open;\n', replace: '',
    mustFail: OPEN },
  { label: "a leading article makes it another name",
    find: 'if(ws[i]!=="the"&&ws[i]!=="a"&&ws[i]!=="an")out.push(ws[i]);', replace: 'out.push(ws[i]);',
    mustFail: OPEN },
  { label: "any open question answers to any name",
    find: 'if(want&&npcCalledKey(p.called)===want)return k;}', replace: 'if(want)return k;}',
    mustFail: OPEN },
  { label: "a folded provisional's key is forgotten (the new person's tags land on the established one)",
    find: '  if(typeof npcIsProvisional==="function"&&npcIsProvisional(name))return npcFormerKey(name);\n', replace: '',
    mustFail: AFTER },
  { label: "the merge archive is not read",
    find: 'nx=npcFoldedInto(to);if(!nx||nx===to)break;', replace: 'nx=null;if(!nx||nx===to)break;',
    mustFail: AFTER },
  { label: "a ° suffix nothing was filed under makes a record of its own",
    find: '  if(to===name)to=name.slice(0,name.lastIndexOf(" °t"));\n', replace: '',
    mustFail: AFTER },
  { label: "an ambiguous name reads as nobody's",
    find: '  out.count=cnt;/* #534', replace: '  /* #534',
    mustFail: UNCLEAR }
]);
prove("identity.js", [
  { label: "the fold-back lands under the name as written (a twin)",
    find: 'return c!==of?{key:c,how:"other"}:{key:of,how:"same"};', replace: 'return c!==of?{key:c,how:"other"}:{key:canonical,how:"same"};',
    mustFail: SAME },
  { label: "another title on the family name is taken for the same person",
    find: 'if(npcTitleAsk(canonical))return {key:canonical,how:"unclear"};', replace: 'if(false)return {key:canonical,how:"unclear"};',
    mustFail: UNCLEAR },
  { label: "a title on ANOTHER person's family name becomes a proposal to fuse into them",
    find: 'if(npcTitleAsk(canonical))return {key:canonical,how:"unclear"};', replace: 'if(c===of&&npcTitleAsk(canonical))return {key:canonical,how:"unclear"};',
    mustFail: UNCLEAR },
  { label: "a provisional may be merged into itself",
    find: 'if(t.how==="unclear"||t.how==="player"||t.how==="self")return {allow:false,propose:null,why:t.how};', replace: 'if(t.how==="unclear"||t.how==="player")return {allow:false,propose:null,why:t.how};',
    mustFail: UNCLEAR },
  { label: "a self-merge is read as an ordinary merge (the handler deletes the record)",
    find: '  if(canonical===duplicate)return {key:canonical,how:"self"};', replace: '  if(false)return {key:canonical,how:"self"};',
    mustFail: AFTER },
  { label: "a refused answer leaves no trace in the ring",
    find: 'else{_w2RefuseLog(tag);if(typeof console', replace: 'else{if(typeof console',
    mustFail: UNCLEAR },
  { label: "a proposal carries the operand as written (it can never be confirmed)",
    find: 'return {allow:false,propose:[key,duplicate]};', replace: 'return {allow:false,propose:[canonical,duplicate]};',
    mustFail: PROPOSAL },
  { label: "after an alias, the called name no longer finds the provisional",
    find: 'return npcOpenQuestion(name)||name;/* #534', replace: 'return name;/* #534',
    mustFail: PROPOSAL },
  { label: "the note offers the hero as a merge target",
    find: 'var isHero=(typeof memoryNpcIsPlayer==="function")&&memoryNpcIsPlayer(of);', replace: 'var isHero=false;',
    mustFail: HERO }
]);
prove("tag_table.js", [
  { label: "the handler ignores the reading and files under the name as written",
    find: 'mgCanon=_mgT.key;', replace: '',
    mustFail: SAME },
  { label: "a repeated answer prints a second, false receipt",
    find: 'if(!memory.npcs[mgDupe]&&!wsNpcByName(mgDupe)&&npcIsProvisional(mgDupe))continue;', replace: '',
    mustFail: AFTER },
  { label: "the handler runs a self-merge (and deletes the record)",
    find: 'if(_mgT.how==="self"){if(typeof console', replace: 'if(false){if(typeof console',
    mustFail: AFTER },
  { label: "the handler merges into the hero",
    find: 'if(_mgT.how==="player"||_mgT.how==="unclear"){', replace: 'if(_mgT.how==="unclear"){',
    mustFail: HERO },
  { label: "the handler files an answer the names cannot settle",
    find: 'if(_mgT.how==="player"||_mgT.how==="unclear"){', replace: 'if(_mgT.how==="player"){',
    mustFail: UNCLEAR },
  { label: "an alias for the called name makes a record that shadows the provisional",
    find: 'var alCanon=npcProvisionalOperand(alp[1].trim()),', replace: 'var alCanon=alp[1].trim(),',
    mustFail: PROPOSAL }
]);
process.exit(code ? 1 : 0);
