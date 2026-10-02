// dev/sabotage-540-reserved-names.js — proves the #540 guards are guarded. #536 closed the tag door for names that are
// JavaScript's built-in object keys; the same names still arrived without a tag: the summary's extraction (npcUpdates named
// __proto__ wrote its fields on Object.prototype) and a blueprint (a starting place named "constructor" made every prompt
// build throw from turn one). The extraction now drops such entries and both validators refuse such a file. Each mutation
// runs in a disposable clone.
//   node dev/sabotage-540-reserved-names.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#540"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#540 the repro", LISTS = "#540 every list of the extraction", EXACT = "#540 the drop is exact", BP = "#540 a blueprint that uses a reserved word", SKEL = "#540 a generated skeleton";
prove("memory.js", [
  { label: "the extraction is filed unchecked (the reported write on Object.prototype)",
    find: '  summaryDropReserved(extracted);/* #540:', replace: '  /* #540:',
    mustFail: REPRO },
  { label: "a dropped entry is not said on the console",
    find: 'if(typeof console!=="undefined")console.warn("[memory] #540: summary extraction "+k+', replace: 'if(false)console.warn("[memory] #540: summary extraction "+k+',
    mustFail: REPRO },
  { label: "an entry's own text fields are not checked",
    find: 'for(f in e){if(typeof e[f]==="string"){w=reservedKeyWord(e[f]);if(w)break;}}', replace: 'for(f in e){}',
    mustFail: REPRO },
  { label: "a list of sentences is not checked",
    find: 'if(typeof e==="string")w=reservedKeyWord(e);', replace: 'if(false)w=reservedKeyWord(e);',
    mustFail: LISTS },
  { label: "the drop is not counted",
    find: 'list.splice(i,1);n++;', replace: 'list.splice(i,1);',
    mustFail: EXACT },
  { label: "a prose tier that is exactly a reserved word is deleted too",
    find: 'list=extracted[k];if(!Array.isArray(list))continue;', replace: 'list=extracted[k];if(!Array.isArray(list)){if(typeof list==="string"&&reservedKeyWord(list))delete extracted[k];continue;}',
    mustFail: EXACT }
]);
prove("game.js", [
  { label: "a blueprint with a reserved word validates",
    find: '  if(_bpRw)return "Blueprint uses the reserved word', replace: '  if(false)return "Blueprint uses the reserved word',
    mustFail: BP }
]);
prove("campaign_generator.js", [
  { label: "a skeleton with a reserved name passes",
    find: '  if(_skRw)throw new Error(', replace: '  if(false)throw new Error(',
    mustFail: SKEL }
]);
prove("helpers.js", [
  { label: "a reserved KEY is not checked",
    find: 'if(reservedKeyWord(k))return {word:k.trim(),path:', replace: 'if(false)return {word:k.trim(),path:',
    mustFail: BP },
  { label: "lists inside the file are not walked",
    find: 'if(Array.isArray(v)){for(i=0;i<v.length;i++){r=reservedWordIn(v[i],(path||"")+"["+i+"]");if(r)return r;}return null;}', replace: 'if(Array.isArray(v))return null;',
    mustFail: BP },
  { label: "the refusal does not say where the word is",
    find: 'return r?{word:r,path:path||"the value"}:null;', replace: 'return r?{word:r,path:"somewhere"}:null;',
    mustFail: BP }
]);
process.exit(code ? 1 : 0);
