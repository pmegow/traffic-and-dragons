// Probe: dev/docs-only.js judge() over made-up staged lists, with the real dev/*.js readers.
var R = "C:/Projects/traffic-and-dragons";
var d = require(R + "/dev/docs-only.js");
var src = d.readers(R);
var cases = [
  [{ status: "A", file: "DOC/notes on things.md" }],
  [{ status: "M", file: "DOC/Contracts/tags.md" }],            // case variant of the excluded folder
  [{ status: "M", file: "DOC/contracts/tags.md" }],
  [{ status: "D", file: "DOC/QA_ACTIVITY.md" }],
  [{ status: "R", file: "DOC/x.md" }],
  [{ status: "M", file: "DOC/beta-guide.html" }],             // a player-facing page linked from home.html and faq.html
  [{ status: "M", file: "DOC/dice-size_681.json" }],
  [{ status: "A", file: "audits/acceptance-2026-10-10/ledger/run.js" }],
  [{ status: "M", file: "TODO.md" }, { status: "M", file: "DOC/TODO_ARCHIVE.md" }],
  [{ status: "M", file: "TODO_Atlas.md" }],
  [{ status: "M", file: "dev/qa-routine.md" }]
];
cases.forEach(function (c) { var v = d.judge(c, src); console.log((v.docsOnly ? "SKIPS SUITE " : "full run    ") + JSON.stringify(c.map(function (x) { return x.status + " " + x.file; })) + " — " + v.why); });
