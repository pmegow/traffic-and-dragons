// dev/sabotage-481-g8-doc-links.js — proves the #481 G8 guard is guarded: every relative link in the live contract docs must
// land (file + #fragment, GitHub slugs keep "_"), code spans are not links, and run-tests runs the check. Each mutation runs in
// a disposable clone.
//   node dev/sabotage-481-g8-doc-links.js
var sabotage = require("./sabotage.js"), failed = 0;
var CMD = ["node", ["dev/tests-481-g8-doc-links.js"]];
failed += sabotage.prove({ file: "dev/check-doc-links.js", command: CMD, cases: [
  { label: "the slug drops \"_\" (the 13 CLAUDE.md anchors die again, unseen)",
    find: ".replace(/[^\\p{L}\\p{M}\\p{N}\\p{Pc} -]/gu, \"\")", replace: ".replace(/[^\\p{L}\\p{M}\\p{N} -]/gu, \"\")",
    mustFail: "GitHub slugs" },
  { label: "a #fragment is never checked",
    find: "if (!anchorsOf(dest)[decodeURIComponent(frag)]) out.push(", replace: "if (false) out.push(",
    mustFail: "a dead link is named" },
  { label: "a link inside code counts",
    find: "var abs = path.join(root, rel), text = fs.readFileSync(abs, \"utf8\"), code = stripCode(text);", replace: "var abs = path.join(root, rel), text = fs.readFileSync(abs, \"utf8\"), code = text;",
    mustFail: "a dead link is named" }
]});
failed += sabotage.prove({ file: "CLAUDE.md", command: CMD, cases: [
  { label: "an anchor spells \"_\" as \"-\" again",
    find: "](DOC/contracts/items.md#capability_biblejs)", replace: "](DOC/contracts/items.md#capability-biblejs)",
    mustFail: "the live contract docs" }
]});
failed += sabotage.prove({ file: "DOC/contracts/memory.md", command: CMD, cases: [
  { label: "a contract link resolves from the repo root again",
    find: "](../RAG_MEMORY.md)", replace: "](DOC/RAG_MEMORY.md)",
    mustFail: "the live contract docs" }
]});
failed += sabotage.prove({ file: "dev/run-tests.js", command: CMD, cases: [
  { label: "run-tests stops calling the check",
    find: "  var _docLinks = require(\"./check-doc-links.js\").brokenLinks(require(\"path\").join(__dirname, \"..\"));", replace: "  var _docLinks = [];",
    mustFail: "run-tests runs the check" }
]});
process.exit(failed ? 1 : 0);
