// dev/sabotage-638-coin-detector.js — proves #638's detector is guarded (Thursday review 2026-10-15: the coin the GM narrates
// against the coin it tags, a read-only post-turn toast). Each rule is mutated back toward its failure: the comparison gated off,
// the follower rule dropped (three gold rings become an amount), the quote strip dropped (a spoken offer becomes a transfer),
// the transfer-verb rule dropped (a quoted price fires with no tag), the toast silenced, and the turn path's call removed.
//   node dev/sabotage-638-coin-detector.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#638 coin narration"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var FIELD = "#638 the two field cases fire", QUIET = "#638 with NO [GOLD:] tag", PATH = "#638 the turn path";
prove("helpers.js", [
  { label: "the comparison is gated off: every reply reads as a match",
    find: "  if(tags.length&&(ok||sums.indexOf(total)>=0))return null;", replace: "  if(tags.length)return null;",
    mustFail: FIELD },
  { label: "the follower rule is dropped: 'three gold rings' and 'the gold light' become amounts",
    find: "(?=\\\\s*(?:$|[^a-z\\\\s])|\\\\s+(?:and|or|to|for|into|from|in|at|on|onto|over|with|each|apiece|more|back|out|down|up|away|total|altogether|worth|of|per|a|an|the|his|her|their|your|my|its|that|which|as|when|while|before|after|than|is|are|was|were|went|go|goes|had|has|have|he|she|they|you|it|we|i)\\\\b)\",\"g\");",
    replace: "\",\"g\");",
    mustFail: QUIET },
  { label: "the quote strip is dropped: a spoken offer counts as a transfer",
    find: ".replace(/\"[^\"\\n]*\"/g,function(m){return new Array(m.length+1).join(\" \");}).replace(/\\u201c[^\\u201d\\n]*\\u201d/g,function(m){return new Array(m.length+1).join(\" \");});",
    replace: ";",
    mustFail: QUIET },
  { label: "the transfer-verb rule is dropped: a quoted price with no tag fires",
    find: "if(COIN_TRANSFER_RE.test(sent))moved=true;}", replace: "moved=true;}",
    mustFail: QUIET },
  { label: "a prose amount is read in gold whatever its unit (the unit table collapses)",
    find: "var key=u===100?\"gp\":u===10?\"sp\":\"cp\";out.push({cp:n*u,", replace: "var key=\"gp\";out.push({cp:n*100,",
    mustFail: FIELD }
]);
prove("game.js", [
  { label: "the toast is silenced (console only)",
    find: "  if(typeof showToast===\"function\")showToast(hit.line,7000);\n", replace: "",
    mustFail: PATH },
  { label: "the turn path no longer calls the detector",
    find: "  if(!_refusal&&typeof coinNarrationToast===\"function\"){try{coinNarrationToast(clean,resp);}catch(_ce){console.warn(\"[coin] #638 the narration check threw \\u2014 skipped, the turn goes on: \"+(_ce&&_ce.message));}}\n", replace: "",
    mustFail: PATH }
]);
process.exit(code);
