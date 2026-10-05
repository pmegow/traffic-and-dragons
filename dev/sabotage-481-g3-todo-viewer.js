// dev/sabotage-481-g3-todo-viewer.js — proves the #481 G3 guards are guarded: the TODO viewer is TRULY read-only. The source
// contract bans every write and edit path (Fable's four names plus export/add/edit/delete/complete/restore/toggle/drag) and keeps
// the read handle; the real-browser half loads the live TODO.md and finds no edit control, while rows still expand. The browser
// clauses drive a real page through dev/cdp-browser.js; with no Chrome they are SKIPPED out loud (exit 78 + one SABOTAGE SKIPPED
// line) — never passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g3-todo-viewer.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var failed = 0;
failed += sabotage.prove({ file: "todo-viewer.html", command: ["node", ["dev/tests-481-g3-todo-viewer.js"]], cases: [
  { label: "an in-place save comes back (createWritable)",
    find: "window.__todoViewerTest = {", replace: "function _saveBack(h, out) { return h.createWritable().then(function(w) { return w.write(out); }); }\nwindow.__todoViewerTest = {",
    mustFail: "Fable's contract" },
  { label: "the Renumber button comes back",
    find: "onclick='refresh()'>&#8635; Refresh</button>\"", replace: "onclick='refresh()'>&#8635; Refresh</button>\" + \"<button class='tbtn' onclick='renumber()'>Renumber</button>\"",
    mustFail: "Fable's contract" },
  { label: "rows can be dragged to reorder again",
    find: "\"<tr class='\" + rowCls + \"' data-idx='\"", replace: "\"<tr class='\" + rowCls + \"' draggable='true' data-idx='\"",
    mustFail: "no edit path survives" },
  { label: "the read path loses Refresh",
    find: "function refresh() {", replace: "function reloadFromHandle() {",
    mustFail: "the read handle stays" }
]});
failed += sabotage.prove({ file: "todo-viewer.html", skip: !chrome.path, command: ["node", ["dev/tests-481-g3-todo-viewer-browser.js"]], cases: [
  { label: "the status glyph is a button again (no banned name — only the browser half sees it)",
    find: "<td class='check-cell'><span class='\" + dotCls + \"' title='\" + dotTitle + \"'>\" + dotSym + \"</span></td>",
    replace: "<td class='check-cell'><button class='\" + dotCls + \"' title='\" + dotTitle + \"'>\" + dotSym + \"</button></td>",
    mustFail: "edit controls survive" },
  { label: "a row carries an input again",
    find: "          + taskBody", replace: "          + taskBody + \"<input class='row-note'>\"",
    mustFail: "an input or textarea survives" },
  { label: "a row no longer expands",
    find: "  _tasks[i]._expanded = !_tasks[i]._expanded;", replace: "  _tasks[i]._expanded = false;",
    mustFail: "a row no longer expands" },
  { label: "the seam parses but never renders",
    find: "parse(String(text || \"\")); renderPage(); }", replace: "parse(String(text || \"\")); }",
    mustFail: "the live TODO.md rendered only" },
  { label: "category headings lose their counts",
    find: "        tog.appendChild(count);", replace: "        /* omit count */",
    mustFail: "FAIL category row counts" }
]});
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-481-g3-todo-viewer.js", 5, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
