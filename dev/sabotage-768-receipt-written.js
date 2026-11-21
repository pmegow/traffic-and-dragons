// dev/sabotage-768-receipt-written.js — proves the #768 guards: a receipt the reply wrote itself beside its
// [MAP_REVEAL:] is not printed again, and nothing short of that line suppresses the engine's.
// #775: the engine prints none; that line of the reply's is taken out of the story, and nothing short of it is cut.
//   node dev/sabotage-768-receipt-written.js
var sabotage = require("./sabotage.js");
var P = "FAIL #768 ", CMD = ["node", ["dev/tests-768-receipt-written.js"]];
var T1 = P + "a receipt the reply wrote itself, directly after its tag, is taken out of the story",
  T2 = P + "a block of tags followed by a block of their lines loses each line",
  T3 = P + "a receipt written directly before its tag is taken out too",
  T4 = P + "a quotation inside other prose, or a line past a change of place, is the reply's own prose: it stays, and nothing is added",
  T5 = P + "a line taken out leaves no gap: the paragraphs it stood between keep one blank line";
/* #775: the scanner is #768's; what it finds is now TAKEN OUT of the story instead of standing in for the engine's line. */
var cases = [
  { label: "the reply's own receipt line stays in the story", find: "result.text=atlasKnowledgeUnsaid(raw,items);", replace: "result.text=raw;", mustFail: T1 },
  { label: "blank space after the tag hides the reply's line", find: "rest=text.slice(i);m=/^\\s+/.exec(rest);if(m){i+=m[0].length;continue;}", replace: "rest=text.slice(i);", mustFail: T1 },
  { label: "other tags between hide the reply's line", find: "if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}", replace: "", mustFail: T2 },
  { label: "another feature's receipt line between hides the reply's line", find: "if(m&&atlasKnowledgeLineStart(text,i)){i+=m[0].length;continue;}/* another feature's receipt line */", replace: "", mustFail: T2 },
  { label: "a line written before its tag stays", find: "===quote&&atlasKnowledgeLineStart(before,before.length-quote.length)?before.length-quote.length:-1;", replace: "===quote&&false?0:-1;", mustFail: T3 },
  { label: "a quotation after the tag is cut as if it were the receipt", find: "if(rest.slice(0,quote.length)===quote&&atlasKnowledgeLineStart(text,i))return i;", replace: "if(rest.indexOf(quote)>=0)return i+rest.indexOf(quote);", mustFail: T4 },
  { label: "the end of another sentence before the tag is cut as if it were the receipt", find: "===quote&&atlasKnowledgeLineStart(before,before.length-quote.length)?before.length-quote.length:-1;", replace: "===quote?before.length-quote.length:-1;", mustFail: T4 },
  { label: "a line past a change of place is cut as if it were the receipt", find: "if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}", replace: "if(m){i+=m[0].length;continue;}", mustFail: T4 },
  { label: "a line taken out leaves its empty line behind", find: "    if(!text.slice(ls,le).trim()){/* the line held nothing else", replace: "    if(false){/* the line held nothing else", mustFail: T5 },
  { label: "a line taken out from between two blank lines leaves both", find: "&&ne>=0&&!text.slice(ls,ne).trim())text=text.slice(0,ls)+text.slice(ne+1);", replace: "&&false)text=text.slice(0,ls)+text.slice(ne+1);", mustFail: T5 },
  { label: "the sentence cut from a line of prose leaves two spaces", find: "text=text.slice(0,at)+text.slice(at+1);/* ", replace: "void 0;/* ", mustFail: T1 }
];
process.exit(sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: cases }) ? 1 : 0);
