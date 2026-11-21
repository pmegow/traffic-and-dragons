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
  T5 = P + "a line taken out leaves no gap: the paragraphs it stood between keep one blank line",
  T6 = P + "the sentence with anything after it on its line is the reply's prose: nothing is cut",
  T7 = P + "one directive stated twice with one line of its own: the line is cut once, and the prose after it is whole",
  T8 = P + "a reply of map tags alone, or of tags and their own lines, keeps receipts as its narration: never a turn with nothing to show";
/* #775: the scanner is #768's; what it finds is now TAKEN OUT of the story instead of standing in for the engine's line.
   The "review" clauses guard what the independent review of #775 found. */
var cases = [
  { label: "the reply's own receipt line stays in the story", find: "shown=atlasKnowledgeUnsaid(raw,q.items);/* #775: the story gains no line */", replace: "shown=raw;", mustFail: T1 },
  { label: "blank space after the tag hides the reply's line", find: "rest=text.slice(i);m=/^\\s+/.exec(rest);if(m){i+=m[0].length;continue;}", replace: "rest=text.slice(i);", mustFail: T1 },
  { label: "other tags between hide the reply's line", find: "if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}", replace: "", mustFail: T2 },
  { label: "another feature's receipt line between hides the reply's line", find: "if(m&&atlasKnowledgeLineStart(text,i)){i+=m[0].length;continue;}/* another feature's receipt line */", replace: "", mustFail: T2 },
  { label: "a line written before its tag stays", find: "  return before.slice(-quote.length)===quote&&atlasKnowledgeLineStart(before,i)&&atlasKnowledgeOwnLine(text,i,quote.length)?i:-1;", replace: "  return -1;", mustFail: T3 },
  { label: "a quotation after the tag is cut as if it were the receipt", find: "if(rest.slice(0,quote.length)===quote&&atlasKnowledgeLineStart(text,i)&&atlasKnowledgeOwnLine(text,i,quote.length))return i;", replace: "if(rest.indexOf(quote)>=0)return i+rest.indexOf(quote);", mustFail: T4 },
  { label: "the end of another sentence before the tag is cut as if it were the receipt", find: "  return before.slice(-quote.length)===quote&&atlasKnowledgeLineStart(before,i)&&atlasKnowledgeOwnLine(text,i,quote.length)?i:-1;", replace: "  return before.slice(-quote.length)===quote?i:-1;", mustFail: T4 },
  { label: "a line past a change of place is cut as if it were the receipt", find: "if(m&&!/^(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE)$/.test(m[1])){i+=m[0].length;continue;}", replace: "if(m){i+=m[0].length;continue;}", mustFail: T4 },
  { label: "a line taken out leaves its empty line behind", find: "    if(!text.slice(ls,le).trim()){/* the line held nothing else", replace: "    if(false){/* the line held nothing else", mustFail: T5 },
  { label: "a line taken out from between two blank lines leaves both", find: "&&ne>=0&&!text.slice(ls,ne).trim())text=text.slice(0,ls)+text.slice(ne+1);", replace: "&&false)text=text.slice(0,ls)+text.slice(ne+1);", mustFail: T5 },
  { label: "the sentence cut from beside its tag leaves the space before it", find: "text=text.slice(0,at-1)+text.slice(at);/* ", replace: "void 0;/* ", mustFail: T1 },
  { label: "review: the sentence is cut although prose follows it on its line", find: "  if(after.replace(/\\[[A-Z_]+(?::[^\\[\\]\\r\\n]*)?\\]/g,\"\").trim())return false;\n", replace: "", mustFail: T6 },
  { label: "review: a speaker's line that says the sentence is cut", find: "  while((m=tag.exec(before)))if(/^SAY/.test(m[1]))return false;/* a speaker's line is dialogue, whatever it says */\n", replace: "", mustFail: T6 },
  { label: "review: any line beginning \"You see\" is stepped over as a receipt", find: "m=ATLAS_KNOWLEDGE_RECEIPT_LINE.exec(rest);", replace: "m=/^You (?:see|hear of) [^\\r\\n]*/.exec(rest);", mustFail: T6 },
  { label: "review: one position is cut twice — the prose after it is eaten", find: "if(at>=0&&!seen[at]){seen[at]=1;", replace: "if(at>=0){seen[at]=1;", mustFail: T7 },
  { label: "review: a lone carriage return is left where the last line was cut", find: ":text.slice(0,ls>0?ls-1:0).replace(/\\r$/,\"\");", replace: ":text.slice(0,ls>0?ls-1:0);", mustFail: T7 },
  { label: "review: a reply of map tags alone is left with nothing to show", find: "    if(!cleanTxt(shown).trim())shown=out;", replace: "    ", mustFail: T8 }
];
process.exit(sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: cases }) ? 1 : 0);
