// dev/sabotage-536-reserved-operands.js — proves the #536 guards are guarded. The engine files people, places and items in
// plain objects keyed by what the GM writes, so an operand that is one of JavaScript's built-in object keys read the object
// machinery instead of a record: [NPC:__proto__|dead|enemy] stamped a death every NPC then read, [LOCATION:constructor] made
// every later prompt build throw. applyMuts now takes such a tag out of the reply before anything parses it. Each mutation
// runs in a disposable clone.
//   node dev/sabotage-536-reserved-operands.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#536"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#536 the repro", CENSUS = "#536 the census", LIST = "#536 a reserved word inside a comma list", CLAIM = "#536 a canon claim whose marker";
prove("tag_table.js", [
  { label: "the reserved words are a hand list (a built-in key is missed)",
    find: 'n=Object.getOwnPropertyNames(Object.prototype),i;for(i=0;i<n.length;i++)o[n[i]]=1;return o;})();', replace: 'n=["constructor","__proto__"],i;for(i=0;i<n.length;i++)o[n[i]]=1;return o;})();',
    mustFail: CENSUS },
  { label: "__proto__ inside a sentence passes",
    find: '  if(p)return p[0];\n', replace: '',
    mustFail: LIST },
  { label: "a comma list is read as one operand",
    find: 'parts=s.split(/[|,]/);', replace: 'parts=s.split("|");',
    mustFail: LIST },
  { label: "an operand with spaces around it passes",
    find: 'w=parts[i].trim();if(w&&', replace: 'w=parts[i];if(w&&',
    mustFail: LIST },
  { label: "a capitalised built-in key passes (item keys are lower-cased)",
    find: 'if(w&&(TAG_RESERVED_WORDS[w]||TAG_RESERVED_WORDS[w.toLowerCase()]))return w;', replace: 'if(w&&TAG_RESERVED_WORDS[w])return w;',
    mustFail: CENSUS },
  { label: "a claim under a reserved marker loses its markers only (its body runs as ordinary tags)",
    find: '    if(!w)return m;\n    out.refused.push({claim:true,', replace: '    return m;\n    out.refused.push({claim:true,',
    mustFail: CLAIM },
  { label: "a claim's BEGIN marker is not checked",
    find: 'var w=tagReservedWord(begin)||tagReservedWord(end);', replace: 'var w=tagReservedWord(end);',
    mustFail: CLAIM },
  { label: "a claim's END marker is not checked",
    find: 'var w=tagReservedWord(begin)||tagReservedWord(end);', replace: 'var w=tagReservedWord(begin);',
    mustFail: CLAIM },
  { label: "an ordinary tag with a reserved operand is left in the reply",
    find: '    var w=tagReservedWord(payload);\n    if(!w)return m;', replace: '    var w=tagReservedWord(payload);\n    return m;',
    mustFail: REPRO }
]);
prove("api.js", [
  { label: "applyMuts skips the guard (the reported poison)",
    find: '  var _rsv=tagStripReserved(text);text=_rsv.text;', replace: '  var _rsv={text:text,refused:[]};',
    mustFail: REPRO },
  { label: "a refusal leaves no line in the turn's summary",
    find: 'R.muts.push("\\u26a0 "+_rsl);', replace: '',
    mustFail: REPRO },
  { label: "a refusal leaves no line on the console",
    find: 'if(typeof console!=="undefined")console.warn("[tags] #536: "+_rsl+', replace: 'if(false)console.warn("[tags] #536: "+_rsl+',
    mustFail: REPRO }
]);
process.exit(code ? 1 : 0);
