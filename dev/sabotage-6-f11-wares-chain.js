// dev/sabotage-6-f11-wares-chain.js — proves the #6 F11 clauses: a chained WARES emission files every ware, and cleanTxt
// strips the orphan tail. Disposable clones via sabotage.js.   node dev/sabotage-6-f11-wares-chain.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#6 the village"]], cases: cases }); }
prove("tag_table.js", [
  { label: "the chain is not split — only the first ware files",
    find: 'var _wseg=_wraw[_wri].slice(7,-1).split("]|"),_wsi;', replace: 'var _wseg=[_wraw[_wri].slice(7,-1).split("]|")[0]],_wsi;',
    mustFail: "#6 F11 a chained WARES emission" }
]);
prove("api.js", [
  { label: "the orphan tail is no longer stripped from the display",
    find: '    .replace(/\\|[^\\[\\]\\n|]{1,120}\\|[^\\[\\]\\n]{0,240}\\]/g,function(_m){', replace: '    .replace(/\\|NEVER\\|MATCHES\\]/g,function(_m){',
    mustFail: "#6 F11 a chained WARES emission" }
]);
process.exit(code);
