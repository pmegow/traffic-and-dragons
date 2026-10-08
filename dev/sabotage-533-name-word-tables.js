// dev/sabotage-533-name-word-tables.js — proves the #533 guards are guarded. Tables and sets keyed by words the GM writes were
// plain objects, so the word "constructor" ("Malrik the Constructor") looked up Object's own constructor: dropped from the
// name as a stop word, read as a rank (a throw in npcNameSays that lost the [NPC:] handler's tags and threw a death tag out
// of applyMuts), matched as a word that was not there. Each is now null-prototype. Each mutation runs in a disposable clone.
//   node dev/sabotage-533-name-word-tables.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#533"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#533 the repro", READ = "#533 the name readers treat it as a plain name word", WIDER = "#533 the same class outside the name code";
prove("memory.js", [
  { label: "word tables inherit Object.prototype again (the reported throw)",
    find: 'function npcWordTable(o){return keyedDict(o);}', replace: 'function npcWordTable(o){return o;}',
    mustFail: REPRO },
  { label: "the rank table alone is a plain object (the throw's own line)",
    find: 'var _NPC_RANK_WORDS=npcWordTable({king:"crown:monarch",', replace: 'var _NPC_RANK_WORDS=({king:"crown:monarch",',
    mustFail: REPRO },
  { label: "the sex table alone is a plain object (the word states a sex)",
    find: 'var _NPC_SEX_WORDS=npcWordTable({king:"m",', replace: 'var _NPC_SEX_WORDS=({king:"m",',
    mustFail: READ },
  { label: "the stop-word table alone is a plain object (the word vanishes from the name)",
    find: 'var _NPC_STOP=npcWordTable({sheriff:1,', replace: 'var _NPC_STOP=({sheriff:1,',
    mustFail: READ },
  { label: "the variant scan's stop table is a plain object",
    find: 'var _VARIANT_STOP=npcWordTable({the:1,a:1,an:1,of:1,and:1,or:1});', replace: 'var _VARIANT_STOP=({the:1,a:1,an:1,of:1,and:1,or:1});',
    mustFail: READ },
  { label: "the variant scan's token sets are plain objects (a word that is not there matches)",
    find: 'set=Object.create(null),n=0,sub=false;', replace: 'set={},n=0,sub=false;',
    mustFail: READ },
  { label: "the retrieval stop table is a plain object (the word is dropped from every query)",
    find: 'var RAG_STOP=npcWordTable({"about":1,', replace: 'var RAG_STOP=({"about":1,',
    mustFail: WIDER },
  { label: "the retrieval term set is a plain object (the word counts as already seen)",
    find: '  var out=[],seen=Object.create(null),i;\n  var words=String(inputText', replace: '  var out=[],seen={},i;\n  var words=String(inputText',
    mustFail: WIDER },
  { label: "the future-event fingerprint's set is a plain object",
    find: 'var out=[],seen=Object.create(null),w=String(s||"")', replace: 'var out=[],seen={},w=String(s||"")',
    mustFail: WIDER }
]);
prove("identity.js", [
  { label: "the death gate's title table is a plain object (his distinctive word is dropped as a title)",
    find: 'var W2_TITLE_STOPSET=npcWordTable({brother:1,', replace: 'var W2_TITLE_STOPSET=({brother:1,',
    mustFail: READ },
  { label: "the death gate's operand set is a plain object (an exact match on a missing word)",
    find: 'var rset=Object.create(null),i;', replace: 'var rset={},i;',
    mustFail: READ }
]);
prove("game.js", [
  { label: "the button filter's stop table is a plain object",
    find: 'var SUGGESTION_NAME_STOP=npcWordTable({the:1,old:1,', replace: 'var SUGGESTION_NAME_STOP=({the:1,old:1,',
    mustFail: WIDER }
]);
process.exit(code ? 1 : 0);
