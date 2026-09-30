// dev/sabotage-482-house-owner.js — proves the #482 guards are guarded: a village house belongs to a NAME (the whole name,
// word-bounded, or one of its words in a possessive or after "of"), never to a bare word. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-482-house-owner.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#482"]];
process.exit(sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the first-word rule comes back (The Entity owns every 'the … house')",
    find: "var best=null,bestScore=-1,j;", replace: "var best=null,bestScore=-1,j;for(i=0;i<names.length;i++){var _f=String(names[i]).toLowerCase().split(/\\s+/)[0];if(new RegExp(\"\\\\b\"+esc(_f)+\"\\\\b\").test(s))return names[i];}",
    mustFail: "an article or an adjective is nobody's name" },
  { label: "a bare word of a name is enough (Old Maud owns the old house)",
    find: "if(new RegExp(\"(^|[^a-z0-9])\"+e+\"'(?:s(?![a-z0-9])|\\\\s|$)\").test(s)||", replace: "if(new RegExp(\"(^|[^a-z0-9])\"+e+\"(?![a-z0-9])\").test(s)||",
    mustFail: "an article or an adjective is nobody's name" },
  { label: "the whole name matches inside another word (Ash owns the wash house)",
    find: "if(new RegExp(\"(^|[^a-z0-9])(?:\"+esc(full)+\"|\"+esc(bare)+\")(?![a-z0-9])\").test(s))hit=2;", replace: "if(new RegExp(\"(?:\"+esc(full)+\"|\"+esc(bare)+\")\").test(s))hit=2;",
    mustFail: "an article or an adjective is nobody's name" },
  { label: "a possessive of one word no longer counts (Maud's cottage is nobody's)",
    find: "if(new RegExp(\"(^|[^a-z0-9])\"+e+\"'(?:s(?![a-z0-9])|\\\\s|$)\").test(s)||", replace: "if(false||",
    mustFail: "every way a name owns a house still resolves" },
  { label: "'of' a word no longer counts (the home of Maud is nobody's)",
    find: "||new RegExp(\"(^|[^a-z0-9])of\\\\s+(?:the\\\\s+)?\"+e+\"(?![a-z0-9])\").test(s))hit=1;", replace: ")hit=1;",
    mustFail: "every way a name owns a house still resolves" }
]}));
