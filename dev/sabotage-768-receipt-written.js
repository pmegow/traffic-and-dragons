// dev/sabotage-768-receipt-written.js — proves the #768 guards: a receipt the reply wrote itself beside its
// [MAP_REVEAL:] is not printed again, and nothing short of that line suppresses the engine's.
//   node dev/sabotage-768-receipt-written.js
var sabotage = require("./sabotage.js");
var P = "FAIL #768 ", CMD = ["node", ["dev/tests-768-receipt-written.js"]];
var T1 = P + "a receipt the reply wrote itself, directly after its tag, is the receipt: the engine adds no second line",
  T2 = P + "a block of tags followed by a block of their lines prints each once",
  T3 = P + "a receipt written directly before its tag counts too",
  T4 = P + "a quotation inside other prose, or a line past a change of place, is not the receipt: the engine still says it";
var cases = [
  { label: "the engine adds its line beside the reply's own", find: "if(!said[sk]&&atlasKnowledgeWritten(text,item.start,item.end,e.quote)){", replace: "if(false){", mustFail: T1 },
  { label: "blank space after the tag hides the reply's line", find: "rest=text.slice(i);m=/^\\s+/.exec(rest);if(m){i+=m[0].length;continue;}", replace: "rest=text.slice(i);", mustFail: T1 },
  { label: "other tags between hide the reply's line", find: "if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}", replace: "", mustFail: T2 },
  { label: "another feature's receipt line between hides the reply's line", find: "if(m&&atlasKnowledgeLineStart(text,i)){i+=m[0].length;continue;}/* another feature's receipt line */", replace: "", mustFail: T2 },
  { label: "a line written before its tag is printed again", find: "  return before.slice(-quote.length)===quote&&atlasKnowledgeLineStart(before,before.length-quote.length);", replace: "  return false;", mustFail: T3 },
  { label: "a quotation after the tag counts as the receipt", find: "if(rest.slice(0,quote.length)===quote&&atlasKnowledgeLineStart(text,i))return true;", replace: "if(rest.indexOf(quote)>=0)return true;", mustFail: T4 },
  { label: "the end of another sentence before the tag counts as the receipt", find: "  return before.slice(-quote.length)===quote&&atlasKnowledgeLineStart(before,before.length-quote.length);", replace: "  return before.slice(-quote.length)===quote;", mustFail: T4 },
  { label: "a line past a change of place counts as the receipt", find: "if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}", replace: "if(m){i+=m[0].length;continue;}", mustFail: T4 }
];
process.exit(sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: cases }) ? 1 : 0);
